import { expect, test, type Page } from "@playwright/test";

const modifierKey = process.platform === "darwin" ? "Meta" : "Control";

async function openSelectedNodeMenu(page: Page) {
  const selectedNode = page.locator(".node-card.is-selected").first();
  await selectedNode.getByRole("button", { name: /More/i }).click();
}

test("supports the core canvas v1 structure flows", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("ARIAD");
  await expect(page.getByRole("heading", { name: "ARIAD" })).toBeVisible();
  await expect(page.getByText("Canvas")).toBeVisible();
  await expect(page.getByTestId("session-mode")).toHaveText("guest");
  await expect(page.getByTestId("node-count")).toHaveText("Nodes: 1");
  const majorLaneNodes = page.locator(".node-card.node-card-level-major");

  await page.getByRole("button", { name: "Create Node" }).click();
  await page.getByTestId("lane-minor").click({
    force: true,
    position: {
      x: 140,
      y: 160
    }
  });
  await majorLaneNodes.first().click();

  await expect(page.getByTestId("node-count")).toHaveText("Nodes: 2");

  const minorLaneNodes = page.locator(".node-card.node-card-level-minor");

  await expect(minorLaneNodes).toHaveCount(1);
  const minorLaneBox = await page.getByTestId("lane-minor").boundingBox();
  const minorNodeBox = await minorLaneNodes.first().boundingBox();

  expect(minorLaneBox).not.toBeNull();
  expect(minorNodeBox).not.toBeNull();

  if (!minorLaneBox || !minorNodeBox) {
    throw new Error("Minor lane placement proof was not available.");
  }

  expect(minorNodeBox.x).toBeGreaterThanOrEqual(minorLaneBox.x - 1);
  expect(minorNodeBox.x + minorNodeBox.width).toBeLessThanOrEqual(
    minorLaneBox.x + minorLaneBox.width + 1
  );

  await page.getByRole("button", { name: "Create Node" }).click();
  await page.getByTestId("lane-detail").click({
    position: {
      x: 180,
      y: 180
    }
  });

  await expect(page.getByTestId("node-count")).toHaveText("Nodes: 3");

  const detailLaneNodes = page.locator(".node-card.node-card-level-detail");

  await expect(detailLaneNodes).toHaveCount(1);
  const detailLaneBox = await page.getByTestId("lane-detail").boundingBox();
  const detailNodeBox = await detailLaneNodes.first().boundingBox();

  expect(detailLaneBox).not.toBeNull();
  expect(detailNodeBox).not.toBeNull();

  if (!detailLaneBox || !detailNodeBox) {
    throw new Error("Detail lane placement proof was not available.");
  }

  expect(detailNodeBox.x).toBeGreaterThanOrEqual(detailLaneBox.x - 1);
  expect(detailNodeBox.x + detailNodeBox.width).toBeLessThanOrEqual(
    detailLaneBox.x + detailLaneBox.width + 1
  );

  await page.getByRole("button", { name: "Create Node" }).click();
  await page.getByTestId("lane-major").click({
    position: {
      x: 160,
      y: 280
    }
  });

  await expect(page.getByTestId("node-count")).toHaveText("Nodes: 4");

  await expect(majorLaneNodes).toHaveCount(2);
  const timelineStartAnchor = page.locator(".timeline-start-anchor");
  const newestMajorNode = majorLaneNodes.nth(1);
  const timelineAnchorBox = await timelineStartAnchor.boundingBox();
  const newestMajorNodeBox = await newestMajorNode.boundingBox();

  if (!timelineAnchorBox || !newestMajorNodeBox) {
    throw new Error("Major-lane magnetic center proof was not available.");
  }

  const timelineCenterX = timelineAnchorBox.x + timelineAnchorBox.width / 2;
  const newestMajorCenterX = newestMajorNodeBox.x + newestMajorNodeBox.width / 2;

  expect(Math.abs(newestMajorCenterX - timelineCenterX)).toBeLessThanOrEqual(4);

  const firstMajorNodeTestId = await majorLaneNodes.first().getAttribute("data-testid");

  expect(firstMajorNodeTestId).not.toBeNull();

  if (!firstMajorNodeTestId) {
    throw new Error("The first major node test id was not available.");
  }

  const firstMajorNode = page.getByTestId(firstMajorNodeTestId);
  const firstMajorBox = await firstMajorNode.boundingBox();

  expect(firstMajorBox).not.toBeNull();

  if (!firstMajorBox) {
    throw new Error("The first major node did not expose a bounding box.");
  }

  const firstMajorCenterX = firstMajorBox.x + firstMajorBox.width / 2;

  expect(Math.abs(firstMajorCenterX - timelineCenterX)).toBeLessThanOrEqual(4);

  const currentMinorNode = page.locator(".node-card.node-card-level-minor").first();

  await currentMinorNode.click();
  await page.keyboard.press(`${modifierKey}+KeyC`);
  await page.keyboard.press(`${modifierKey}+KeyV`);
  await expect(page.getByTestId("node-count")).toHaveText("Nodes: 6");
  await page.keyboard.press(`${modifierKey}+KeyZ`);
  await expect(page.getByTestId("node-count")).toHaveText("Nodes: 4");
  await currentMinorNode.click();
  await currentMinorNode.getByRole("button", { name: /More/i }).click();
  await page.getByRole("button", { name: "Rewire" }).click();
  await majorLaneNodes.nth(0).click();

  await currentMinorNode.getByRole("button", { name: /More/i }).click();
  await page.getByRole("button", { name: "Important" }).click();
  await currentMinorNode.getByRole("button", { name: /More/i }).click();
  await page.getByRole("button", { name: "Fixed" }).click();
  await expect(page.getByRole("button", { name: "Temporary Drawer" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Send to Drawer" })).toHaveCount(0);

  const restoredMinorNode = page.locator(".node-card.node-card-level-minor").first();

  await restoredMinorNode.click();
  await restoredMinorNode.getByRole("button", { name: /More/i }).click();
  await page.getByRole("button", { name: "Delete" }).click();

  const deleteDialog = page.getByRole("dialog");

  await expect(
    deleteDialog.getByText(
      "This node and all of its child nodes will be deleted together. Do you want to delete them?"
    )
  ).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Delete" }).click();

  await expect(page.getByTestId("node-count")).toHaveText("Nodes: 2");

  await page.getByRole("button", { name: "More Profile" }).click();
  await page.getByRole("button", { name: "Sign In" }).click();

  await expect(page.getByTestId("session-mode")).toHaveText("authenticated");
  await page.getByRole("button", { name: "More Profile" }).click();
  await expect(page.getByTestId("cloud-status-sidebar")).toContainText(
    "Synced to demo-account"
  );

  await page.reload();

  await expect(page.getByTestId("session-mode")).toHaveText("authenticated");
  await expect(page.getByTestId("node-count")).toHaveText("Nodes: 2");
});

test("supports the explicit keyword-first recommendation flow", async ({ page }) => {
  await page.goto("/");

  const selectedTitle = page.getByTestId("selected-node-title");

  await page.getByRole("button", { name: "Create Node" }).click();
  await page.getByTestId("lane-major").click({
    position: {
      x: 160,
      y: 280
    }
  });

  await expect(selectedTitle).toContainText("Empty node");

  await openSelectedNodeMenu(page);
  await page.getByRole("button", { name: "Keyword Suggestions" }).click();
  await expect(page.getByTestId("keyword-cloud")).toBeVisible();

  await expect(
    page.getByRole("button", { name: "Refresh Cloud" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sentence Suggestions" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save Keywords" })).toHaveCount(0);

  const firstKeyword = page.getByTestId("keyword-suggestion-0");
  const chosenKeyword = (await firstKeyword.textContent())?.trim() ?? "";

  expect(chosenKeyword).not.toBe("");

  await firstKeyword.click();

  await expect(
    page
      .locator(".node-card.node-card-level-major")
      .nth(1)
      .locator(".node-inline-keyword")
      .getByText(chosenKeyword, { exact: true })
  ).toBeVisible();

  await page.reload();

  await page
    .locator(".node-card.node-card-level-major")
    .nth(1)
    .click();
  await expect(
    page
      .locator(".node-card.node-card-level-major")
      .nth(1)
      .locator(".node-inline-keyword")
      .getByText(chosenKeyword, { exact: true })
  ).toBeVisible();
});

test("prevents minor-lane nodes from overlapping when placed in the same area", async ({
  page
}) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Create Node" }).click();
  await page.getByTestId("lane-minor").click({
    position: {
      x: 140,
      y: 160
    }
  });

  const minorLaneNodes = page.locator(".node-card.node-card-level-minor");
  await expect(minorLaneNodes).toHaveCount(1);

  await minorLaneNodes.first().click();
  await page.keyboard.press(`${modifierKey}+C`);
  await page.keyboard.press(`${modifierKey}+V`);

  await expect(minorLaneNodes).toHaveCount(2);

  const firstMinorNodeBox = await minorLaneNodes.first().boundingBox();
  const secondMinorNodeBox = await minorLaneNodes.nth(1).boundingBox();

  if (!firstMinorNodeBox || !secondMinorNodeBox) {
    throw new Error("Minor-lane overlap proof was not available.");
  }

  const nodesOverlap =
    !(
      firstMinorNodeBox.x + firstMinorNodeBox.width <= secondMinorNodeBox.x ||
      secondMinorNodeBox.x + secondMinorNodeBox.width <= firstMinorNodeBox.x ||
      firstMinorNodeBox.y + firstMinorNodeBox.height <= secondMinorNodeBox.y ||
      secondMinorNodeBox.y + secondMinorNodeBox.height <= firstMinorNodeBox.y
    );

  expect(nodesOverlap).toBe(false);
});

test("supports reference-object creation and detail editing", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "New Object" }).first().click();

  const detailEditor = page.getByTestId("detail-editor");

  await detailEditor.getByLabel("Object Name").fill("Cafe Exit");
  await detailEditor
    .getByLabel("Information")
    .fill("A stable location anchor for the confrontation beat.");
  await detailEditor.getByRole("button", { name: "New Object" }).click();

  const objectList = page.getByTestId("object-list");

  await page.getByTestId("object-search").fill("cafe");
  await expect(objectList.locator(".object-row-name", { hasText: "Cafe Exit" })).toBeVisible();
  await expect(
    objectList.locator(".object-row-name", { hasText: "Heroine's Mother" })
  ).toHaveCount(0);
  await page.getByTestId("object-search").clear();

  const cafeExitRow = page.locator(".object-row", {
    has: page.locator(".object-row-name", { hasText: "Cafe Exit" })
  });
  await page.locator(".object-row-name", { hasText: "Cafe Exit" }).click();
  await expect(cafeExitRow.locator(".object-row-count")).toHaveText("(0)");
  await cafeExitRow.getByRole("button", { name: "More Cafe Exit" }).click();
  await expect(
    page.getByRole("button", { name: "Insert Into Selected Node" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove From Selected Node" })
  ).toHaveCount(0);
  await page.locator(".object-row-name", { hasText: "Cafe Exit" }).click();
  await detailEditor
    .getByLabel("Information")
    .fill("A sharpened location anchor for the confrontation beat.");
  await detailEditor.getByRole("button", { name: "Save Object" }).click();

  await expect(detailEditor.getByLabel("Information")).toHaveValue(
    "A sharpened location anchor for the confrontation beat."
  );

  await page.reload();

  await expect(page.locator(".object-row-name", { hasText: "Cafe Exit" })).toBeVisible();
  await expect(page.getByTestId("detail-editor")).toHaveCount(0);
});

test("supports @mention object reuse and creation inside node text", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Create Node" }).click();
  await page.getByTestId("lane-major").click({
    position: {
      x: 160,
      y: 280
    }
  });

  const mentionedNode = page.locator(".node-card.node-card-level-major").nth(1);
  const inlineInput = mentionedNode.getByRole("textbox");

  await inlineInput.fill("She dropped the coffee to his @h");
  await page.locator(".object-mention-menu").getByRole("button", { name: "Heroine's Mother" }).click();

  await expect(
    mentionedNode.locator(".node-object-mention").getByText("Heroine's Mother", {
      exact: true
    })
  ).toBeVisible();
  await expect(
    page
      .locator(".object-row", {
        has: page.locator(".object-row-name", { hasText: "Heroine's Mother" })
      })
      .locator(".object-row-count")
  ).toHaveText("(2)");

  await inlineInput.fill("She dropped the coffee to his @coat@");

  await expect(
    mentionedNode.locator(".node-object-mention").getByText("coat", { exact: true })
  ).toBeVisible();
  await expect(page.locator(".object-row-name", { hasText: "coat" })).toBeVisible();
  await expect(
    page
      .locator(".object-row", {
        has: page.locator(".object-row-name", { hasText: "coat" })
      })
      .locator(".object-row-count")
  ).toHaveText("(1)");

  await inlineInput.fill("Heroine's Mother");
  await page
    .locator(".object-mention-menu")
    .getByRole("button", { name: 'Use "Heroine\'s Mother" as object' })
    .click();

  await expect(
    mentionedNode.locator(".node-object-mention").getByText("Heroine's Mother", {
      exact: true
    })
  ).toBeVisible();
});

test("supports keyboard copy, paste, undo, redo, and escape safeguards", async ({
  page
}) => {
  await page.goto("/");

  await expect(page.getByTestId("node-count")).toHaveText("Nodes: 1");

  await page.keyboard.press(`${modifierKey}+C`);
  await page.keyboard.press(`${modifierKey}+V`);

  await expect(page.getByTestId("node-count")).toHaveText("Nodes: 2");
  await expect(
    page.getByTestId("history-controls").getByRole("button", { name: "Undo" })
  ).toBeEnabled();

  await page.keyboard.press(`${modifierKey}+Z`);

  await expect(page.getByTestId("node-count")).toHaveText("Nodes: 1");

  await page.keyboard.press(`${modifierKey}+Shift+Z`);

  await expect(page.getByTestId("node-count")).toHaveText("Nodes: 2");

  await openSelectedNodeMenu(page);
  await page.getByRole("button", { name: "Keyword Suggestions" }).click();
  await expect(page.getByTestId("keyword-cloud")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("keyword-cloud")).toHaveCount(0);

  await page.keyboard.press("Delete");
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("renders the auth callback baseline route", async ({ page }) => {
  await page.goto("/auth/callback?code=demo-code&state=demo-state");

  await expect(page.getByRole("heading", { name: "Auth Callback" })).toBeVisible();
  await expect(page.getByText("demo-code")).toBeVisible();
  await expect(page.getByText("demo-state")).toBeVisible();
});
