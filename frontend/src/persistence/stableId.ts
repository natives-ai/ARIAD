import type { PersistedEntityKind } from "@ariad/shared";

export function createStableId(kind: PersistedEntityKind): string {
  return `${kind}_${crypto.randomUUID()}`;
}
