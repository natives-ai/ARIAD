// 이 파일은 WorkspaceShell 공통 UI 보조 함수를 제공합니다.
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import type { StoryObjectCategory } from "@scenaairo/shared";

import { copy } from "../../copy";
import type { WorkspacePersistenceState } from "../../persistence/controller";

export function toMessage(error: unknown) {
  return error instanceof Error ? error.message : "recommendation_failed";
}

export function describeCloudStatus(state: WorkspacePersistenceState) {
  switch (state.syncStatus) {
    case "booting":
      return "Preparing the local cache and persistence registry.";
    case "guest-local":
      return state.linkage?.cloudLinked
        ? "Guest mode is using the local working cache. Sign in to reconnect to the linked cloud project."
        : copy.persistence.guestMode;
    case "importing":
      return "Importing local work into the account-backed canonical workspace.";
    case "syncing":
      return "Syncing the local working cache to the canonical cloud project.";
    case "synced":
      return `Synced to ${state.linkage?.linkedAccountId ?? state.session.accountId}. Local cache remains active for recovery.`;
    case "error":
      return `Local cache is still available, but cloud sync needs attention: ${state.lastError ?? "unknown_error"}.`;
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
