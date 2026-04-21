import { describe, expect, it } from "vitest";

import { englishCopy } from "./i18n/index.js";

describe("shared baseline", () => {
  it("exposes canonical english workspace copy", () => {
    expect(englishCopy.workspace.title).toBe("SCENAAIRO Workspace");
    expect(englishCopy.auth.callbackTitle).toBe("Auth Callback");
  });
});
