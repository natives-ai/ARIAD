import type { PersistedEntityKind } from "@scenaairo/shared";

export function createStableId(kind: PersistedEntityKind): string {
  return `${kind}_${crypto.randomUUID()}`;
}
