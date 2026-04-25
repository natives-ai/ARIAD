// 이 파일은 백엔드 콘솔 로그를 읽기 쉬운 단일 포맷으로 출력합니다.

export type BackendLogLevel = "error" | "warn" | "info" | "debug";

export interface BackendLogger {
  debug(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
}

interface CreateBackendLoggerOptions {
  level: BackendLogLevel;
  scope: string;
}

const logLevelPriority: Record<BackendLogLevel, number> = {
  debug: 3,
  error: 0,
  info: 2,
  warn: 1
};

// 현재 로그 레벨 정책에서 출력 가능한 레벨인지 판단합니다.
function canWriteLog(configuredLevel: BackendLogLevel, targetLevel: BackendLogLevel) {
  return logLevelPriority[targetLevel] <= logLevelPriority[configuredLevel];
}

// 사람이 읽기 쉬운 타임스탬프 문자열을 생성합니다.
function formatTimestamp(date: Date) {
  return date.toISOString().replace("T", " ").replace("Z", "");
}

// 메타데이터를 단일 JSON 문자열로 안전하게 변환합니다.
function formatMetadata(metadata?: Record<string, unknown>) {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "";
  }

  try {
    return ` ${JSON.stringify(metadata)}`;
  } catch {
    return ' {"metadata":"serialization_failed"}';
  }
}

// 공통 포맷으로 콘솔 로그를 출력합니다.
function writeLog(
  scope: string,
  configuredLevel: BackendLogLevel,
  level: BackendLogLevel,
  message: string,
  metadata?: Record<string, unknown>
) {
  if (!canWriteLog(configuredLevel, level)) {
    return;
  }

  const prefix = `[${formatTimestamp(new Date())}][SCENAAIRO][${scope}][${level.toUpperCase()}]`;
  const line = `${prefix} ${message}${formatMetadata(metadata)}`;

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

// 스코프와 레벨이 고정된 백엔드 로거를 생성합니다.
export function createBackendLogger(options: CreateBackendLoggerOptions): BackendLogger {
  return {
    debug(message, metadata) {
      writeLog(options.scope, options.level, "debug", message, metadata);
    },
    error(message, metadata) {
      writeLog(options.scope, options.level, "error", message, metadata);
    },
    info(message, metadata) {
      writeLog(options.scope, options.level, "info", message, metadata);
    },
    warn(message, metadata) {
      writeLog(options.scope, options.level, "warn", message, metadata);
    }
  };
}
