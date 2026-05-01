// 이 파일은 WorkspaceShell 공통 UI 보조 함수를 제공합니다.
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import type { StoryObjectCategory } from "@scenaairo/shared";

import { copy } from "../../copy";
import type { WorkspacePersistenceState } from "../../persistence/controller";

export function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "recommendation_failed";
}

// 동기화 상태를 사용자에게 보여줄 짧은 문구로 바꿉니다.
export function describeCloudStatus(state: WorkspacePersistenceState) {
  switch (state.syncStatus) {
    case "booting":
      return "Preparing the local cache and persistence registry.";
    case "guest-local":
      return state.linkage?.cloudLinked
        ? "Guest mode is using the local working cache. Sign in to reconnect to the linked cloud project."
        : copy.persistence.guestMode;
    case "authenticated-empty":
      return copy.persistence.authenticatedEmptyState;
    case "importing":
      return "Connecting to your account-backed workspace and importing local changes if needed.";
    case "syncing":
      return "Syncing local work to the account-backed cloud workspace.";
    case "synced":
      return "Local cache remains active for recovery.";
    case "error": {
      const lastErrorCode = state.lastError?.split(":")[0];
      const friendlyError =
        lastErrorCode === "account_mismatch"
          ? "The project is linked to a different account. Sign in with the correct account, then use Recover From Cloud if needed."
          : lastErrorCode === "authentication_required"
            ? "Session is not authenticated. Sign in again to continue cloud sync."
            : lastErrorCode === "mysql_not_configured" ||
              lastErrorCode === "mysql_unavailable"
              ? "DB-backed workspace is unavailable right now. Keeping local cache active."
              : null;

      return `Local cache is still available, but cloud sync needs attention: ${
        friendlyError ?? (state.lastError ?? "unknown_error")
      }.`;
    }
  }
}
export function formatObjectCategory(category: StoryObjectCategory) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

// 전체화면 상태를 반영해 오버레이 포털 루트를 선택하는 함수
export function renderViewportOverlay(content: ReactNode) {
  const fullscreenRoot = document.fullscreenElement;
  const overlayRoot = fullscreenRoot instanceof Element ? fullscreenRoot : document.body;

  return createPortal(content, overlayRoot);
}
