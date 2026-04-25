import { spawn } from "node:child_process";
import { loadBackendRuntimeEnv } from "./load-env.mjs";

const forceCompat = process.env.SCENAAIRO_FORCE_COMPAT === "1";
const startupWindowMs = 4000;

function mirrorStream(stream, write, chunks) {
  if (!stream) {
    return;
  }

  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    chunks.push(chunk);
    if (chunks.length > 200) {
      chunks.shift();
    }
    write(chunk);
  });
}

function quoteWindowsArg(argument) {
  if (argument.length === 0) {
    return '""';
  }

  if (!/[\s"&<>|^]/.test(argument)) {
    return argument;
  }

  return `"${argument.replace(/"/g, '""')}"`;
}

function getYarnSpawnConfig(commandArgs) {
  if (process.platform !== "win32") {
    return {
      command: "yarn",
      args: commandArgs
    };
  }

  return {
    command: "cmd.exe",
    args: [
      "/d",
      "/s",
      "/c",
      ["yarn.cmd", ...commandArgs].map(quoteWindowsArg).join(" ")
    ]
  };
}

function startYarnCommand(commandArgs, options = {}) {
  const stdoutChunks = [];
  const stderrChunks = [];
  const { command, args } = getYarnSpawnConfig(commandArgs);
  let child;

  try {
    child = spawn(command, args, {
      cwd: process.cwd(),
      env: options.env ?? process.env,
      stdio: ["inherit", "pipe", "pipe"],
      windowsHide: false
    });
  } catch (error) {
    const result = {
      code: 1,
      kind: "error",
      output: error instanceof Error ? error.message : String(error)
    };

    return {
      waitForExit: async () => result,
      waitForStartup: async () => result
    };
  }

  mirrorStream(child.stdout, (chunk) => process.stdout.write(chunk), stdoutChunks);
  mirrorStream(child.stderr, (chunk) => process.stderr.write(chunk), stderrChunks);

  const output = () => `${stdoutChunks.join("")}\n${stderrChunks.join("")}`;

  const exitPromise = new Promise((resolve) => {
    child.on("error", (error) => {
      resolve({
        code: 1,
        kind: "error",
        output: error instanceof Error ? error.message : String(error)
      });
    });

    child.on("exit", (code, signal) => {
      resolve({
        code: code ?? 1,
        kind: "exit",
        output: output(),
        signal
      });
    });
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.once("SIGINT", forwardSignal);
  process.once("SIGTERM", forwardSignal);

  const waitForExit = async () => {
    const result = await exitPromise;
    process.off("SIGINT", forwardSignal);
    process.off("SIGTERM", forwardSignal);
    return result;
  };

  const waitForStartup = async () => {
    if (options.longRunning !== true) {
      return waitForExit();
    }

    return Promise.race([
      waitForExit(),
      new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            code: 0,
            kind: "running",
            output: output()
          });
        }, startupWindowMs);
      })
    ]);
  };

  return {
    waitForExit,
    waitForStartup
  };
}

async function runBuild(commandArgs, env) {
  const session = startYarnCommand(commandArgs, { env });
  const result = await session.waitForStartup();
  if (result.code !== 0) {
    if (result.output && result.output.trim().length > 0) {
      process.stderr.write(
        result.output.endsWith("\n") ? result.output : `${result.output}\n`
      );
    }
    if (shouldUseCompat(result.output)) {
      process.stderr.write(
        "[SCENAAIRO] This shell blocks child process spawn. Try manual compat start:\n" +
          "  yarn workspace @scenaairo/shared build\n" +
          "  yarn workspace @scenaairo/recommendation build\n" +
          "  yarn workspace @scenaairo/backend build\n" +
          "  yarn node backend/dist/server.js\n"
      );
    }
    process.exit(result.code);
  }
}

function shouldUseCompat(message) {
  return /spawn EPERM/i.test(message);
}

async function runLongRunningCommand(commandArgs, env = process.env) {
  const session = startYarnCommand(commandArgs, {
    env,
    longRunning: true
  });
  const startupResult = await session.waitForStartup();

  if (startupResult.kind === "running") {
    const exitResult = await session.waitForExit();
    process.exit(exitResult.code ?? 0);
  }

  return startupResult;
}

async function runCompatBackend(runtimeEnv) {
  process.stderr.write(
    "[SCENAAIRO] Backend dev server hit a spawn restriction. Falling back to compatible dist mode.\n"
  );

  await runBuild(["workspace", "@scenaairo/shared", "build"], runtimeEnv);
  await runBuild(["workspace", "@scenaairo/recommendation", "build"], runtimeEnv);
  await runBuild(["workspace", "@scenaairo/backend", "build"], runtimeEnv);

  const result = await runLongRunningCommand(["node", "backend/dist/server.js"], runtimeEnv);
  process.exit(result.code ?? 1);
}

async function main() {
  const runtimeEnv = loadBackendRuntimeEnv(process.env, process.cwd());

  if (forceCompat) {
    await runCompatBackend(runtimeEnv);
    return;
  }

  const result = await runLongRunningCommand(
    ["workspace", "@scenaairo/backend", "dev"],
    runtimeEnv
  );

  if (shouldUseCompat(result.output)) {
    await runCompatBackend(runtimeEnv);
    return;
  }

  if (result.code !== 0 && result.output && result.output.trim().length > 0) {
    process.stderr.write(
      result.output.endsWith("\n") ? result.output : `${result.output}\n`
    );
  }

  process.exit(result.code ?? 1);
}

await main();
