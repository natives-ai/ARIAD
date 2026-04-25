// 이 파일은 백엔드 호환 실행 경로를 단계별 로그와 함께 시작합니다.

import { spawn } from "node:child_process";
import { loadBackendRuntimeEnv } from "./load-env.mjs";

// Windows cmd 인자에서 공백/특수문자를 안전하게 감쌉니다.
function quoteWindowsArg(argument) {
  if (argument.length === 0) {
    return '""';
  }

  if (!/[\s"&<>|^]/.test(argument)) {
    return argument;
  }

  return `"${argument.replace(/"/g, '""')}"`;
}

// 현재 OS에 맞는 yarn 실행 커맨드/인자를 구성합니다.
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

// 단일 yarn 명령을 실행하고 실패 시 종료 코드를 유지합니다.
async function runCommand(commandArgs, env) {
  const { command, args } = getYarnSpawnConfig(commandArgs);

  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      windowsHide: false
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if ((code ?? 1) !== 0) {
        reject(new Error(`command_failed:${commandArgs.join(" ")}`));
        return;
      }
      resolve(undefined);
    });
  });
}

// 호환 백엔드 실행 절차를 단계별로 출력하고 마지막 서버를 기동합니다.
async function main() {
  const runtimeEnv = loadBackendRuntimeEnv(process.env, process.cwd());

  console.log("[SCENAAIRO] 1/4 shared build");
  await runCommand(["workspace", "@scenaairo/shared", "build"], runtimeEnv);

  console.log("[SCENAAIRO] 2/4 recommendation build");
  await runCommand(["workspace", "@scenaairo/recommendation", "build"], runtimeEnv);

  console.log("[SCENAAIRO] 3/4 backend build");
  await runCommand(["workspace", "@scenaairo/backend", "build"], runtimeEnv);

  console.log("[SCENAAIRO] 4/4 backend run");
  console.log("[SCENAAIRO] Backend process is foreground; stop with Ctrl+C.");
  await runCommand(["node", "backend/dist/server.js"], runtimeEnv);
}

try {
  await main();
} catch (error) {
  if (error instanceof Error) {
    console.error(`[SCENAAIRO] compat start failed: ${error.message}`);
  } else {
    console.error("[SCENAAIRO] compat start failed.");
  }
  process.exit(1);
}
