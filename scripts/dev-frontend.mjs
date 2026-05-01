// 이 파일은 프론트엔드 개발 서버와 호환 서버 기동을 관리합니다.
/* global process, setTimeout */
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";

const forceCompat = process.env.SCENAAIRO_FORCE_COMPAT === "1";
const startupWindowMs = 4000;

// 자식 프로세스 출력을 현재 프로세스로 복사합니다.
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

// Windows cmd 인자 quoting을 처리합니다.
function quoteWindowsArg(argument) {
  if (argument.length === 0) {
    return '""';
  }

  if (!/[\s"&<>|^]/.test(argument)) {
    return argument;
  }

  return `"${argument.replace(/"/g, '""')}"`;
}

// 실행 환경에 맞는 yarn spawn 구성을 만듭니다.
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

// yarn 명령을 시작하고 시작/종료 대기 함수를 반환합니다.
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

// spawn 제한 오류인지 확인합니다.
function shouldUseCompat(message) {
  return /spawn EPERM/i.test(message);
}

// 프론트엔드 인자를 호환 서버 환경 변수로 변환합니다.
function getCompatEnv(frontendArgs) {
  const env = {
    ...process.env
  };

  for (let index = 0; index < frontendArgs.length; index += 1) {
    const current = frontendArgs[index];
    const next = frontendArgs[index + 1];

    if ((current === "--host" || current === "-H") && next) {
      env.SCENAAIRO_FRONTEND_HOST = next;
      index += 1;
      continue;
    }

    if ((current === "--port" || current === "-p") && next) {
      env.SCENAAIRO_FRONTEND_PORT = next;
      index += 1;
    }
  }

  return env;
}

// 장기 실행 명령의 초기 기동 결과를 확인합니다.
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

// 호환 서버 환경 변수를 현재 프로세스에 반영합니다.
function applyCompatEnv(compatEnv) {
  if (compatEnv.SCENAAIRO_FRONTEND_HOST) {
    process.env.SCENAAIRO_FRONTEND_HOST = compatEnv.SCENAAIRO_FRONTEND_HOST;
  }

  if (compatEnv.SCENAAIRO_FRONTEND_PORT) {
    process.env.SCENAAIRO_FRONTEND_PORT = compatEnv.SCENAAIRO_FRONTEND_PORT;
  }
}

// spawn 제한 환경에서는 현재 프로세스에서 호환 서버를 시작합니다.
async function runCompatFrontend(compatEnv) {
  const distEntry = "frontend/dist/service.html";
  applyCompatEnv(compatEnv);

  if (existsSync(distEntry)) {
    process.stderr.write(
      "[SCENAAIRO] Frontend dev server hit a spawn restriction. Serving built dist in-process.\n"
    );

    const { startDistServer } = await import("../frontend/scripts/serve-dist.mjs");
    startDistServer();
    return;
  }

  process.stderr.write(
    "[SCENAAIRO] Frontend dev server hit a spawn restriction. Serving standalone bundle in-process.\n"
  );

  const { startStandaloneServer } = await import("./serve-standalone.mjs");
  startStandaloneServer();
}

// 개발 서버 진입점을 실행합니다.
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
