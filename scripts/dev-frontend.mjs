import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const forceCompat = process.env.ARIAD_FORCE_COMPAT === "1";
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

function shouldUseCompat(message) {
  return /spawn EPERM/i.test(message);
}

function getCompatEnv(frontendArgs) {
  const env = {
    ...process.env
  };

  for (let index = 0; index < frontendArgs.length; index += 1) {
    const current = frontendArgs[index];
    const next = frontendArgs[index + 1];

    if ((current === "--host" || current === "-H") && next) {
      env.ARIAD_FRONTEND_HOST = next;
      index += 1;
      continue;
    }

    if ((current === "--port" || current === "-p") && next) {
      env.ARIAD_FRONTEND_PORT = next;
      index += 1;
    }
  }

  return env;
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

async function runCompatFrontend(compatEnv) {
  const distEntry = "frontend/dist/service.html";

  if (existsSync(distEntry)) {
    process.stderr.write(
      "[ARIAD] Frontend dev server hit a spawn restriction. Falling back to the built dist server.\n"
    );

    const result = await runLongRunningCommand(
      ["node", "frontend/scripts/serve-dist.mjs"],
      compatEnv
    );
    process.exit(result.code ?? 1);
    return;
  }

  process.stderr.write(
    "[ARIAD] Frontend dev server hit a spawn restriction. Falling back to the standalone bundle server.\n"
  );

  const result = await runLongRunningCommand(["node", "scripts/serve-standalone.mjs"], compatEnv);
  process.exit(result.code ?? 1);
}

async function main() {
  const forwardedArgs = process.argv.slice(2);
  const frontendArgs =
    forwardedArgs.length > 0
      ? forwardedArgs
      : ["--host", "127.0.0.1", "--port", "5173"];
  const compatEnv = getCompatEnv(frontendArgs);

  if (forceCompat) {
    await runCompatFrontend(compatEnv);
    return;
  }

  const result = await runLongRunningCommand(
    ["workspace", "@scenaairo/frontend", "dev", ...frontendArgs],
    compatEnv
  );

  if (shouldUseCompat(result.output)) {
    await runCompatFrontend(compatEnv);
    return;
  }

  process.exit(result.code ?? 1);
}

await main();
