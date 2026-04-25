// 이 파일은 Google 계정과 서버 세션을 MySQL에 저장하는 인증 저장소를 제공합니다.

import { createHash, randomUUID } from "node:crypto";

import mysql from "mysql2/promise";
import type { Pool, RowDataPacket } from "mysql2/promise";

import type { MySqlConfig } from "../config/env.js";
import type { VerifiedGoogleIdentity } from "./google-id-token.js";

interface CloudSessionRow extends RowDataPacket {
  account_id: string;
  display_name: string | null;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  session_id: string;
}

interface UpsertedGoogleAccount {
  accountId: string;
  displayName: string;
}

interface CreatedSessionRecord {
  expiresAt: Date;
  sessionId: string;
}

interface ActiveSessionRecord {
  accountId: string;
  displayName: string;
  sessionId: string;
}

// Google sub를 내부 계정 ID 규칙으로 변환합니다.
function buildGoogleAccountId(subject: string) {
  return `google:${subject}`;
}

// user-agent를 고정 길이 해시로 정규화합니다.
function hashUserAgent(userAgent: string | null) {
  if (!userAgent || userAgent.trim().length === 0) {
    return null;
  }

  return createHash("sha256").update(userAgent).digest("hex");
}

// DB에서 읽은 날짜 값을 Date 객체로 변환합니다.
function toDate(value: Date | string) {
  if (value instanceof Date) {
    return value;
  }

  return new Date(value);
}

// Google 계정 upsert와 세션 lifecycle을 담당하는 MySQL 저장소입니다.
export class MySqlAuthStore {
  private readonly pool: Pool;

  private schemaReady: Promise<void> | null = null;

  // 인증 저장소용 MySQL 커넥션 풀을 초기화합니다.
  constructor(mysqlConfig: MySqlConfig) {
    this.pool = mysql.createPool({
      connectionLimit: 10,
      database: mysqlConfig.database,
      host: mysqlConfig.host,
      password: mysqlConfig.password,
      port: mysqlConfig.port,
      user: mysqlConfig.user
    });
  }

  // 인증 관련 최소 테이블 스키마를 보장합니다.
  private async ensureSchema() {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        await this.pool.execute(
          `CREATE TABLE IF NOT EXISTS cloud_accounts (
            account_id VARCHAR(191) NOT NULL,
            auth_provider VARCHAR(32) NOT NULL DEFAULT 'unknown',
            provider_subject VARCHAR(191) NULL,
            email VARCHAR(320) NULL,
            display_name VARCHAR(255) NULL,
            avatar_url MEDIUMTEXT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (account_id),
            UNIQUE KEY uq_cloud_accounts_provider_subject (auth_provider, provider_subject),
            UNIQUE KEY uq_cloud_accounts_email (email)
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        );

        await this.pool.execute(
          `CREATE TABLE IF NOT EXISTS cloud_sessions (
            session_id VARCHAR(191) NOT NULL,
            account_id VARCHAR(191) NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expires_at DATETIME NOT NULL,
            revoked_at DATETIME NULL,
            user_agent_hash VARCHAR(64) NULL,
            PRIMARY KEY (session_id),
            INDEX idx_cloud_sessions_account_id (account_id),
            INDEX idx_cloud_sessions_expires_at (expires_at),
            CONSTRAINT fk_cloud_sessions_account
              FOREIGN KEY (account_id)
              REFERENCES cloud_accounts (account_id)
              ON DELETE CASCADE
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        );
      })();
    }

    await this.schemaReady;
  }

  // Google 사용자 정보를 account shell에 upsert합니다.
  async upsertGoogleAccount(identity: VerifiedGoogleIdentity): Promise<UpsertedGoogleAccount> {
    await this.ensureSchema();

    const accountId = buildGoogleAccountId(identity.sub);
    await this.pool.execute(
      `INSERT INTO cloud_accounts (
        account_id,
        auth_provider,
        provider_subject,
        email,
        display_name,
        avatar_url
      ) VALUES (?, 'google', ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        account_id = VALUES(account_id),
        email = VALUES(email),
        display_name = VALUES(display_name),
        avatar_url = VALUES(avatar_url),
        updated_at = CURRENT_TIMESTAMP`,
      [
        accountId,
        identity.sub,
        identity.email,
        identity.name,
        identity.picture
      ]
    );

    return {
      accountId,
      displayName: identity.name ?? identity.email ?? "Google User"
    };
  }

  // 계정에 대한 새로운 세션을 생성합니다.
  async createSession(
    accountId: string,
    sessionTtlSeconds: number,
    userAgent: string | null,
    now: Date
  ): Promise<CreatedSessionRecord> {
    await this.ensureSchema();

    const ttlMs = Math.max(sessionTtlSeconds, 1) * 1000;
    const sessionId = randomUUID();
    const expiresAt = new Date(now.getTime() + ttlMs);

    await this.pool.execute(
      `INSERT INTO cloud_sessions (
        session_id,
        account_id,
        expires_at,
        user_agent_hash
      ) VALUES (?, ?, ?, ?)`,
      [sessionId, accountId, expiresAt, hashUserAgent(userAgent)]
    );

    return {
      expiresAt,
      sessionId
    };
  }

  // 세션 ID로 활성 세션을 조회합니다.
  async getActiveSession(sessionId: string, now: Date): Promise<ActiveSessionRecord | null> {
    await this.ensureSchema();

    const [rows] = await this.pool.query<CloudSessionRow[]>(
      `SELECT
         s.session_id,
         s.account_id,
         s.expires_at,
         s.revoked_at,
         a.display_name
       FROM cloud_sessions s
       LEFT JOIN cloud_accounts a
         ON a.account_id = s.account_id
       WHERE s.session_id = ?
       LIMIT 1`,
      [sessionId]
    );

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0]!;
    if (row.revoked_at !== null) {
      return null;
    }

    if (toDate(row.expires_at).getTime() <= now.getTime()) {
      return null;
    }

    return {
      accountId: row.account_id,
      displayName: row.display_name ?? "Google User",
      sessionId: row.session_id
    };
  }

  // 세션을 폐기 상태로 표시합니다.
  async revokeSession(sessionId: string, now: Date) {
    await this.ensureSchema();
    await this.pool.execute(
      `UPDATE cloud_sessions
       SET revoked_at = ?
       WHERE session_id = ?
         AND revoked_at IS NULL`,
      [now, sessionId]
    );
  }

  // 저장소 사용이 끝나면 커넥션 풀을 정리합니다.
  async close() {
    await this.pool.end();
  }
}
