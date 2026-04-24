import type {
  GetProjectResponse,
  ImportProjectRequest,
  ImportProjectResponse,
  ListProjectsResponse,
  SyncProjectRequest,
  SyncProjectResponse
} from "@ariad/shared";

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

  async getProject(accountId: string, projectId: string): Promise<GetProjectResponse> {
    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/persistence/accounts/${accountId}/projects/${projectId}`
    );

    return parseJsonResponse<GetProjectResponse>(response);
  }

  async importProject(
    accountId: string,
    payload: ImportProjectRequest
  ): Promise<ImportProjectResponse> {
    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/persistence/accounts/${accountId}/import`,
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

  async listProjects(accountId: string): Promise<ListProjectsResponse> {
    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/persistence/accounts/${accountId}/projects`
    );

    return parseJsonResponse<ListProjectsResponse>(response);
  }

  async syncProject(
    accountId: string,
    projectId: string,
    payload: SyncProjectRequest
  ): Promise<SyncProjectResponse> {
    const response = await this.fetchImpl(
      `${this.apiBaseUrl}/persistence/accounts/${accountId}/projects/${projectId}/sync`,
      {
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json"
        },
        method: "POST"
      }
    );

    return parseJsonResponse<SyncProjectResponse>(response);
  }
}
