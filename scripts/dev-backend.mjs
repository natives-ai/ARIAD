import { spawn } from "node:child_process";

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

async function runBuild(commandArgs) {
  const session = startYarnCommand(commandArgs);
  const result = await session.waitForStartup();
  if (result.code !== 0) {
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

async function runCompatBackend() {
  process.stderr.write(
    "[SCENAAIRO] Backend dev server hit a spawn restriction. Falling back to compatible dist mode.\n"
  );

  await runBuild(["workspace", "@scenaairo/shared", "build"]);
  await runBuild(["workspace", "@scenaairo/recommendation", "build"]);
  await runBuild(["workspace", "@scenaairo/backend", "build"]);

  const result = await runLongRunningCommand(["node", "backend/dist/server.js"]);
  process.exit(result.code ?? 1);
}

async function main() {
  if (forceCompat) {
    await runCompatBackend();
    return;
  }

  const result = await runLongRunningCommand(["workspace", "@scenaairo/backend", "dev"]);

  if (shouldUseCompat(result.output)) {
    await runCompatBackend();
    return;
  }

  process.exit(result.code ?? 1);
}

await main();
