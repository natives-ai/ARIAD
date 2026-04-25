// 이 파일은 backend 런타임에 사용할 .env 값을 읽어 process env 객체를 구성합니다.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

// .env 한 줄을 key/value 쌍으로 파싱합니다.
function parseEnvLine(line) {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const equalsIndex = trimmed.indexOf("=");

  if (equalsIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, equalsIndex).trim();
  let value = trimmed.slice(equalsIndex + 1).trim();

  if (!key) {
    return null;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

// .env 파일을 읽어 key/value 맵으로 반환합니다.
function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {};
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  const entries = {};

  for (const line of lines) {
    const parsed = parseEnvLine(line);

    if (!parsed) {
      continue;
    }

    entries[parsed.key] = parsed.value;
  }

  return entries;
}

// shell env 우선순위를 보존하면서 backend 런타임용 env 객체를 구성합니다.
export function loadBackendRuntimeEnv(baseEnv = process.env, cwd = process.cwd()) {
  const rootEnvPath = path.join(cwd, ".env");
  const backendEnvPath = path.join(cwd, "backend", ".env");
  const initialShellKeys = new Set(Object.keys(baseEnv).filter((key) => baseEnv[key] !== undefined));
  const result = { ...baseEnv };

  const mergeFromFile = (entries) => {
    for (const [key, value] of Object.entries(entries)) {
      if (initialShellKeys.has(key)) {
        continue;
      }

      result[key] = value;
    }
  };

  mergeFromFile(parseEnvFile(rootEnvPath));
  mergeFromFile(parseEnvFile(backendEnvPath));

  return result;
}
