// 이 파일은 백엔드의 MySQL 준비 상태를 점검하는 헬퍼를 제공합니다.

import mysql from "mysql2/promise";

import type { MySqlConfig } from "../config/env.js";

export interface MySqlReadinessResult {
  checkedAt: string;
  detail: string | null;
  durationMs: number;
  reachable: boolean;
}

// Promise 작업을 제한 시간 안에서 실행합니다.
async function withTimeout<T>(operation: Promise<T>, timeoutMs: number) {
  return await new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("mysql_readiness_timeout"));
    }, timeoutMs);

    operation
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

// MySQL에 짧은 쿼리를 보내 연결 가능 여부를 점검합니다.
export async function probeMySqlReadiness(
  mysqlConfig: MySqlConfig,
  timeoutMs: number
): Promise<MySqlReadinessResult> {
  const startedAt = Date.now();

  try {
    const connection = await withTimeout(
      mysql.createConnection({
        database: mysqlConfig.database,
        host: mysqlConfig.host,
        password: mysqlConfig.password,
        port: mysqlConfig.port,
        user: mysqlConfig.user
      }),
      timeoutMs
    );

    try {
      await withTimeout(connection.query("SELECT 1"), timeoutMs);
    } finally {
      await connection.end();
    }

    return {
      checkedAt: new Date().toISOString(),
      detail: null,
      durationMs: Date.now() - startedAt,
      reachable: true
    };
  } catch (error) {
    return {
      checkedAt: new Date().toISOString(),
      detail: error instanceof Error ? error.message : "mysql_readiness_failed",
      durationMs: Date.now() - startedAt,
      reachable: false
    };
  }
}
