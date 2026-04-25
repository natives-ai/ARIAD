// 이 파일은 백엔드 영속화 API와 통신하는 클라이언트를 제공합니다.
import type {
  GetProjectResponse,
  ImportProjectRequest,
  ImportProjectResponse,
  ListProjectsResponse,
  SyncProjectRequest,
  SyncProjectResponse
} from "@scenaairo/shared";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `request_failed:${response.status}`;

    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) {
        message = payload.message;
      }
    } catch {
      // Keep the default fallback when no structured error payload is available.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}

export class CloudPersistenceClient {
  constructor(
    private readonly apiBaseUrl: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args)
  ) {}

  // 클라우드 프로젝트 스냅샷을 조회합니다.
  async getProject(projectId: string): Promise<GetProjectResponse> {
    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/persistence/projects/${projectId}`
    );

    return parseJsonResponse<GetProjectResponse>(response);
  }

  // 로컬 프로젝트를 클라우드에 import 합니다.
  async importProject(
    payload: ImportProjectRequest
  ): Promise<ImportProjectResponse> {
    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/persistence/import`,
      {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      }
    );

    return parseJsonResponse<ImportProjectResponse>(response);
  }

  // 계정의 클라우드 프로젝트 목록을 조회합니다.
  async listProjects(): Promise<ListProjectsResponse> {
    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/persistence/projects`
    );

    return parseJsonResponse<ListProjectsResponse>(response);
  }

  // 배치 동기화 연산을 클라우드에 전송합니다.
  async syncProject(
    projectId: string,
    payload: SyncProjectRequest
  ): Promise<SyncProjectResponse> {
    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/persistence/projects/${projectId}/sync`,
      {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json"
        },
        keepalive: true,
        method: "POST"
      }
    );

    return parseJsonResponse<SyncProjectResponse>(response);
  }
}
