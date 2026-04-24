import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceShell } from "./WorkspaceShell";

describe("workspace shell recommendation flow", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  async function createEmptyMajorNode(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      await screen.findByRole("button", { name: "Create Node" })
    );
    await user.click(await screen.findByTestId("lane-major"));
  }

  async function openSelectedNodeMenu(user: ReturnType<typeof userEvent.setup>) {
    const selectedNodeCard = (await screen.findByTestId("selected-node-title")).closest(
      ".node-card"
    ) as HTMLElement;

    await user.click(within(selectedNodeCard).getByRole("button", { name: /More/i }));

    return selectedNodeCard;
  }

  async function getSelectedNodeCard() {
    return (await screen.findByTestId("selected-node-title")).closest(".node-card") as HTMLElement;
  }

  function pressWorkspaceKey(
    key: string,
    options: Pick<KeyboardEventInit, "ctrlKey" | "metaKey" | "shiftKey"> = {},
    target: Window | Document | HTMLElement = window
  ) {
    fireEvent.keyDown(target, {
      key,
      ...options
    });
  }

  it("applies selected keywords directly into the node and persists them", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.endsWith("/recommendation/keywords")) {
        return new Response(
          JSON.stringify({
            suggestions: [
              {
                label: "pressure spike",
                reason: "Sharpens the mother-driven turn."
              },
              {
                label: "hard choice",
                reason: "Keeps the beat structural."
              }
            ]
          }),
          {
            headers: {
              "Content-Type": "application/json"
            },
            status: 200
          }
        );
      }

      return new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      });
    });

    globalThis.fetch = fetchMock as typeof fetch;

    const user = userEvent.setup();
    const { unmount } = render(<WorkspaceShell />);

    await createEmptyMajorNode(user);

    await openSelectedNodeMenu(user);

    const keywordButton = await screen.findByRole("button", {
      name: "Keyword Suggestions"
    });

    await user.click(keywordButton);

    expect(await screen.findByTestId("keyword-cloud")).toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", { name: /pressure spike/i })
    );

    const selectedNodeCard = (await screen.findByTestId("selected-node-title")).closest(
      ".node-card"
    ) as HTMLElement;
    const inlineInput = within(selectedNodeCard).getByRole("textbox");

    expect(
      within(selectedNodeCard).getByText("pressure spike", {
        selector: ".node-inline-keyword"
      })
    ).toBeInTheDocument();
    expect(screen.getByTestId("keyword-suggestion-0")).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.queryByPlaceholderText("Type the beat")).not.toBeInTheDocument();

    await user.click(inlineInput);
    await user.keyboard("{Backspace}");

    await waitFor(() => {
      expect(
        within(selectedNodeCard).queryByText("pressure spike", {
          selector: ".node-inline-keyword"
        })
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("keyword-cloud")).not.toBeInTheDocument();
    });

    await openSelectedNodeMenu(user);
    await user.click(await screen.findByRole("button", { name: "Keyword Suggestions" }));
    expect(screen.getByTestId("keyword-suggestion-0")).toHaveAttribute("aria-pressed", "false");

    await user.click(screen.getByTestId("keyword-suggestion-0"));

    expect(
      within(selectedNodeCard).getByText("pressure spike", {
        selector: ".node-inline-keyword"
      })
    ).toBeInTheDocument();

    unmount();

    render(<WorkspaceShell />);

    expect((await screen.findAllByText("pressure spike")).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps object detail editing available while the canvas is fullscreen", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();
    const originalRequestFullscreen = HTMLElement.prototype.requestFullscreen;
    const originalExitFullscreen = document.exitFullscreen;
    let fullscreenElement: Element | null = null;

    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => fullscreenElement
    });

    HTMLElement.prototype.requestFullscreen = vi.fn(async () => {
      fullscreenElement = document.querySelector(".panel-canvas");
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    document.exitFullscreen = vi.fn(async () => {
      fullscreenElement = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    try {
      render(<WorkspaceShell />);

      await user.click(await screen.findByRole("button", { name: "Enter Fullscreen" }));
      await user.click(await screen.findByRole("button", { name: "Heroine's Mother" }));

      expect(await screen.findByTestId("detail-editor")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Close Details" })).toBeInTheDocument();
    } finally {
      HTMLElement.prototype.requestFullscreen = originalRequestFullscreen;
      document.exitFullscreen = originalExitFullscreen;
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        value: null
      });
    }
  });

  it("removes keyword cloud save and sentence controls in the immediate-apply flow", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          suggestions: [
            {
              label: "pressure spike",
              reason: "Sharpens the mother-driven turn."
            }
          ]
        }),
        {
          headers: {
            "Content-Type": "application/json"
          },
          status: 200
        }
      )
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    await createEmptyMajorNode(user);

    await openSelectedNodeMenu(user);
    await user.click(await screen.findByRole("button", { name: "Keyword Suggestions" }));

    expect(screen.queryByRole("button", { name: "Sentence Suggestions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save Keywords" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Refresh Cloud" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("closes the keyword cloud when clicking outside of it", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          suggestions: [
            {
              label: "pressure spike",
              reason: "Sharpens the mother-driven turn."
            }
          ]
        }),
        {
          headers: {
            "Content-Type": "application/json"
          },
          status: 200
        }
      )
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    await createEmptyMajorNode(user);
    await openSelectedNodeMenu(user);
    await user.click(await screen.findByRole("button", { name: "Keyword Suggestions" }));

    expect(await screen.findByTestId("keyword-cloud")).toBeInTheDocument();

    await user.click(document.body);

    await waitFor(() => {
      expect(screen.queryByTestId("keyword-cloud")).not.toBeInTheDocument();
    });
  });

  it("stops node typing when clicking outside the inline editor", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    await createEmptyMajorNode(user);

    const selectedNodeCard = await getSelectedNodeCard();
    const inlineInput = within(selectedNodeCard).getByRole("textbox");

    await user.type(inlineInput, "Alpha beat");
    expect(inlineInput).toHaveFocus();

    await user.click(document.body);

    expect(inlineInput).not.toHaveFocus();

    await user.keyboard("beta");

    expect(inlineInput).toHaveValue("Alpha beat");
  });

  it("keeps keyword cloud order stable while selecting and pins selected keywords on refresh", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          suggestions: [
            {
              label: "pressure spike",
              reason: "Sharpens the mother-driven turn."
            },
            {
              label: "hard choice",
              reason: "Keeps the beat structural."
            },
            {
              label: "public fallout",
              reason: "Adds visible consequence."
            },
            {
              label: "episode hook",
              reason: "Keeps the major beat active."
            },
            {
              label: "relationship shift",
              reason: "Moves the emotional axis."
            }
          ]
        }),
        {
          headers: {
            "Content-Type": "application/json"
          },
          status: 200
        }
      )
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    await createEmptyMajorNode(user);
    await openSelectedNodeMenu(user);
    await user.click(await screen.findByRole("button", { name: "Keyword Suggestions" }));

    await user.click(screen.getByRole("button", { name: "public fallout" }));
    await user.click(screen.getByRole("button", { name: "relationship shift" }));

    expect(screen.getByTestId("keyword-suggestion-0")).toHaveTextContent("pressure spike");
    expect(screen.getByTestId("keyword-suggestion-1")).toHaveTextContent("hard choice");
    expect(screen.getByTestId("keyword-suggestion-2")).toHaveTextContent("public fallout");
    expect(screen.getByTestId("keyword-suggestion-4")).toHaveTextContent("relationship shift");
    expect(screen.getByTestId("keyword-suggestion-2")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("keyword-suggestion-4")).toHaveAttribute("aria-pressed", "true");
    expect(document.activeElement).not.toHaveClass("node-inline-input");

    const previousThirdLabel = screen.getByTestId("keyword-suggestion-2").textContent?.trim();

    await user.click(screen.getByRole("button", { name: "Refresh Cloud" }));

    await waitFor(() => {
      expect(screen.getByTestId("keyword-suggestion-0")).toHaveTextContent("public fallout");
      expect(screen.getByTestId("keyword-suggestion-1")).toHaveTextContent("relationship shift");
    });

    expect(screen.getByTestId("keyword-suggestion-2").textContent?.trim()).not.toBe(
      previousThirdLabel
    );
  });

  it("creates and reuses reference objects without opening the detail panel by default", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    expect(screen.queryByTestId("detail-editor")).not.toBeInTheDocument();

    await user.click((await screen.findAllByRole("button", { name: "New Object" }))[0]!);

    const createEditor = await screen.findByTestId("detail-editor");

    await user.type(within(createEditor).getByLabelText("Object Name"), "Cafe Exit");
    await user.type(
      within(createEditor).getByLabelText("Information"),
      "A stable location anchor for the confrontation beat."
    );
    await user.click(within(createEditor).getByRole("button", { name: "New Object" }));

    await user.type(screen.getByTestId("object-search"), "cafe");

    const objectList = screen.getByTestId("object-list");

    expect(within(objectList).queryByRole("button", { name: "Heroine's Mother" })).not.toBeInTheDocument();
    await user.click(within(objectList).getByRole("button", { name: "Cafe Exit" }));

    await user.clear(screen.getByTestId("object-search"));

    const cafeExitRow = (await screen.findByRole("button", { name: "Cafe Exit" })).closest(
      ".object-row"
    ) as HTMLElement;

    expect(within(cafeExitRow).getByText("(0)")).toBeInTheDocument();
    await user.click(within(cafeExitRow).getByRole("button", { name: "More Cafe Exit" }));
    expect(
      screen.queryByRole("button", { name: "Insert Into Selected Node" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove From Selected Node" })
    ).not.toBeInTheDocument();
  });

  it("creates and reuses object mentions from inline node text", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    await createEmptyMajorNode(user);

    const selectedNodeCard = await getSelectedNodeCard();
    const inlineInput = within(selectedNodeCard).getByRole("textbox");

    await user.type(inlineInput, "She dropped the coffee to his @h");

    const mentionMenu = document.querySelector(".object-mention-menu") as HTMLElement;

    expect(mentionMenu).not.toBeNull();

    await user.click(
      within(mentionMenu).getByRole("button", {
        name: "Heroine's Mother"
      })
    );

    await waitFor(() => {
      expect(
        within(selectedNodeCard).getByText("Heroine's Mother", {
          selector: ".node-object-mention"
        })
      ).toBeInTheDocument();
    });

    const heroineRow = screen
      .getByText("Heroine's Mother", { selector: ".object-row-name" })
      .closest(".object-row");

    expect(heroineRow).not.toBeNull();
    expect(heroineRow as HTMLElement).toHaveTextContent("(2)");
    const refreshedInlineInput = within(selectedNodeCard).getByRole("textbox");

    await user.clear(refreshedInlineInput);
    await user.type(refreshedInlineInput, "She dropped the coffee to his @coat@");

    await waitFor(() => {
      expect(
        within(selectedNodeCard).getByText("coat", {
          selector: ".node-object-mention"
        })
      ).toBeInTheDocument();
    });

    const coatRow = await screen.findByText("coat", { selector: ".object-row-name" });
    const coatObjectRow = coatRow.closest(".object-row");

    expect(coatObjectRow).not.toBeNull();
    expect(coatObjectRow as HTMLElement).toHaveTextContent("(1)");

    await user.clear(refreshedInlineInput);
    await user.type(refreshedInlineInput, "She checks the @lantern ");

    await waitFor(() => {
      expect(
        within(selectedNodeCard).getByText("lantern", {
          selector: ".node-object-mention"
        })
      ).toBeInTheDocument();
    });

    await user.clear(refreshedInlineInput);
    await user.type(refreshedInlineInput, "She checks the @door{enter}");

    await waitFor(() => {
      expect(
        within(selectedNodeCard).getByText("door", {
          selector: ".node-object-mention"
        })
      ).toBeInTheDocument();
    });
  }, 10000);

  it("offers existing object names as inline object conversions without @ typing", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    await createEmptyMajorNode(user);

    const selectedNodeCard = await getSelectedNodeCard();
    const inlineInput = within(selectedNodeCard).getByRole("textbox");

    await user.type(inlineInput, "Heroine's Mother");

    const mentionMenu = document.querySelector(".object-mention-menu") as HTMLElement;

    expect(mentionMenu).not.toBeNull();

    await user.click(
      within(mentionMenu).getByRole("button", {
        name: 'Use "Heroine\'s Mother" as object'
      })
    );

    await waitFor(() => {
      expect(
        within(selectedNodeCard).getByText("Heroine's Mother", {
          selector: ".node-object-mention"
        })
      ).toBeInTheDocument();
    });
  });

  it("updates the canvas zoom readout from the heading controls", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    const zoomOut = await screen.findByRole("button", { name: "Zoom Out" });
    const zoomIn = screen.getByRole("button", { name: "Zoom In" });
    const zoomReadout = screen.getByRole("button", { name: "Reset Zoom" });

    expect(zoomReadout).toHaveTextContent("100%");

    await user.click(zoomIn);
    expect(zoomReadout).toHaveTextContent("110%");

    await user.click(zoomOut);
    expect(zoomReadout).toHaveTextContent("100%");
  });

  it("opens the right panel only when object detail editing is chosen", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = vi.fn();

    try {
      render(<WorkspaceShell />);

      expect(await screen.findByTestId("selected-node-title")).toBeInTheDocument();
      expect(screen.queryByTestId("detail-editor")).not.toBeInTheDocument();

      await user.click(await screen.findByRole("button", { name: "Heroine's Mother" }));

      const detailEditor = await screen.findByTestId("detail-editor");

      expect(screen.queryByText("Right Panel")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Close Details" })).toBeInTheDocument();
      expect(within(detailEditor).getByLabelText("Object Name")).toBeInTheDocument();
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
  });

  it("supports sidebar collapse, folder creation, episode rename, and scoped pinning", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    expect(await screen.findByRole("heading", { name: "ARIAD" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New Episode/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close Sidebar" }));

    expect(await screen.findByRole("button", { name: "Open Sidebar" })).toBeInTheDocument();
    expect(screen.queryByText("New Episode")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open Sidebar" }));
    await user.click(screen.getByRole("button", { name: /New Folder/i }));
    await user.type(screen.getByPlaceholderText("Name this folder"), "Season One");
    await user.click(screen.getByRole("button", { name: "Create Folder" }));

    expect(await screen.findByText("Season One")).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "More Episode 12" }));
    await user.click(await screen.findByRole("button", { name: "Add to Folder" }));
    await user.click(
      within(document.querySelector(".sidebar-folder-picker") as HTMLElement).getByRole("button", {
        name: "Season One"
      })
    );
    await user.click(await screen.findByRole("button", { name: "More Episode 12" }));
    await user.click(await screen.findByRole("button", { name: "Rename" }));

    const renameInput = await screen.findByDisplayValue("Episode 12");

    await user.clear(renameInput);
    await user.type(renameInput, "ARIAD pilot");
    await user.click(screen.getByRole("button", { name: "Save Episode" }));

    const renamedEpisodeRow = (await screen.findByRole("button", { name: "ARIAD pilot" })).closest(
      ".sidebar-episode-item"
    ) as HTMLElement;

    await user.click(within(renamedEpisodeRow).getByRole("button", { name: "Pin ARIAD pilot" }));

    expect(
      within(renamedEpisodeRow).getByRole("button", { name: "Unpin ARIAD pilot" })
    ).toBeInTheDocument();
  });

  it("dismisses episode and object popovers on repeated toggle and outside click", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    await user.click(await screen.findByRole("button", { name: "More Episode 12" }));
    expect(await screen.findByRole("button", { name: "Rename" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More Episode 12" }));
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "More Episode 12" }));
    expect(await screen.findByRole("button", { name: "Rename" })).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole("button", { name: "Rename" })).not.toBeInTheDocument();

    const objectRow = (await screen.findByRole("button", { name: "Heroine's Mother" })).closest(
      ".object-row"
    ) as HTMLElement;

    await user.click(within(objectRow).getByRole("button", { name: "More Heroine's Mother" }));
    expect(await screen.findByRole("button", { name: "Rename Object" })).toBeInTheDocument();

    await user.click(within(objectRow).getByRole("button", { name: "More Heroine's Mother" }));
    expect(screen.queryByRole("button", { name: "Rename Object" })).not.toBeInTheDocument();

    await user.click(within(objectRow).getByRole("button", { name: "More Heroine's Mother" }));
    expect(await screen.findByRole("button", { name: "Rename Object" })).toBeInTheDocument();
    await user.click(document.body);
    expect(screen.queryByRole("button", { name: "Rename Object" })).not.toBeInTheDocument();

    await user.click(within(objectRow).getByRole("button", { name: "Heroine's Mother" }));
    expect(await screen.findByTestId("detail-editor")).toBeInTheDocument();
  });

  it("sorts, pins, and deletes objects from the compact top bar list", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    await user.click(await screen.findByRole("button", { name: "New Object" }));

    let detailEditor = await screen.findByTestId("detail-editor");

    await user.type(within(detailEditor).getByLabelText("Object Name"), "Cafe Exit");
    await user.click(within(detailEditor).getByRole("button", { name: "New Object" }));

    await user.click((await screen.findAllByRole("button", { name: "New Object" }))[0]!);
    detailEditor = await screen.findByTestId("detail-editor");
    await user.type(within(detailEditor).getByLabelText("Object Name"), "Bakery Stair");
    await user.click(within(detailEditor).getByRole("button", { name: "New Object" }));

    const objectList = await screen.findByTestId("object-list");
    const nameButtons = within(objectList)
      .getAllByRole("button")
      .filter((button) => button.classList.contains("object-row-surface"));

    expect(nameButtons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Bakery Stair",
      "Cafe Exit",
      "Heroine's Mother"
    ]);

    await user.selectOptions(screen.getByTestId("object-sort"), "name-asc");

    const alphabetizedButtons = within(objectList)
      .getAllByRole("button")
      .filter((button) => button.classList.contains("object-row-surface"));

    expect(alphabetizedButtons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Bakery Stair",
      "Cafe Exit",
      "Heroine's Mother"
    ]);

    const cafeRow = (await screen.findByRole("button", { name: "Cafe Exit" })).closest(
      ".object-row"
    ) as HTMLElement;

    await user.click(within(cafeRow).getByRole("button", { name: "More Cafe Exit" }));
    await user.click(await screen.findByRole("button", { name: "Pin Object" }));

    const pinnedButtons = within(objectList)
      .getAllByRole("button")
      .filter((button) => button.classList.contains("object-row-surface"));

    expect(pinnedButtons.map((button) => button.getAttribute("aria-label"))?.[0]).toBe(
      "Cafe Exit"
    );

    await user.click(within(cafeRow).getByRole("button", { name: "More Cafe Exit" }));
    await user.click(await screen.findByRole("button", { name: "Delete Object" }));

    expect(screen.queryByRole("button", { name: "Cafe Exit" })).not.toBeInTheDocument();
  });

  it("keeps the object library separated by active episode", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    await user.click(await screen.findByRole("button", { name: "New Object" }));

    const detailEditor = await screen.findByTestId("detail-editor");

    await user.type(within(detailEditor).getByLabelText("Object Name"), "Cafe Exit");
    await user.click(within(detailEditor).getByRole("button", { name: "New Object" }));

    const objectList = await screen.findByTestId("object-list");

    expect(within(objectList).getByRole("button", { name: "Cafe Exit" })).toBeInTheDocument();
    expect(
      within(objectList).getByRole("button", { name: "Heroine's Mother" })
    ).toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Episode 11" }));

    await waitFor(() => {
      expect(within(objectList).queryByRole("button", { name: "Cafe Exit" })).not.toBeInTheDocument();
    });
    expect(
      within(objectList).queryByRole("button", { name: "Heroine's Mother" })
    ).not.toBeInTheDocument();

    await user.click(await screen.findByRole("button", { name: "Episode 12" }));

    expect(await within(objectList).findByRole("button", { name: "Cafe Exit" })).toBeInTheDocument();
    expect(
      within(objectList).getByRole("button", { name: "Heroine's Mother" })
    ).toBeInTheDocument();
  });

  it("moves episodes into folders, dissolves them, and enables folder-scoped sort mode", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    await user.click(await screen.findByRole("button", { name: /New Folder/i }));
    await user.type(screen.getByPlaceholderText("Name this folder"), "Act One");
    await user.click(screen.getByRole("button", { name: "Create Folder" }));

    expect(await screen.findByText("Act One")).toBeInTheDocument();

    const folderItem = screen.getByText("Act One").closest(".sidebar-folder-item") as HTMLElement;
    const folderCard = within(folderItem).getByText("Act One").closest(".sidebar-folder-card") as HTMLElement;
    const episode12Item = screen
      .getByRole("button", { name: "Episode 12" })
      .closest(".sidebar-episode-item") as HTMLElement;

    fireEvent.dragStart(episode12Item);
    fireEvent.dragOver(folderCard);
    fireEvent.drop(folderCard);

    expect(within(folderItem).getByRole("button", { name: "Episode 12" })).toBeInTheDocument();

    await user.click(within(folderItem).getByRole("button", { name: "More Act One" }));
    await user.click(await screen.findByRole("button", { name: "Add Episodes" }));
    await user.click(
      within(document.querySelector(".sidebar-folder-picker") as HTMLElement).getByRole("button", {
        name: /Episode 11/
      })
    );
    await user.click(
      within(document.querySelector(".sidebar-folder-picker") as HTMLElement).getByRole("button", {
        name: /Episode 10/
      })
    );
    await user.click(document.body);

    expect(within(folderItem).getByRole("button", { name: "Episode 11" })).toBeInTheDocument();
    expect(within(folderItem).getByRole("button", { name: "Episode 10" })).toBeInTheDocument();

    await user.click(within(folderItem).getByRole("button", { name: "More Act One" }));
    await user.click(await screen.findByRole("button", { name: "Sort" }));

    const folderEpisodes = within(folderItem)
      .getAllByRole("button")
      .filter((button) => button.classList.contains("sidebar-episode-link"));
    const folderEpisodeItems = folderEpisodes.map(
      (button) => button.closest(".sidebar-episode-item") as HTMLElement
    );

    expect(folderEpisodeItems.every((item) => item.getAttribute("draggable") === "true")).toBe(
      true
    );

    await user.click(within(folderItem).getByRole("button", { name: "More Episode 11" }));
    await user.click(await screen.findByRole("button", { name: "Dissolve" }));

    expect(within(folderItem).queryByRole("button", { name: "Episode 11" })).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Episode 11" })).toBeInTheDocument();
  });

  it("persists object detail edits across reload", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    const { unmount } = render(<WorkspaceShell />);

    await user.click((await screen.findAllByRole("button", { name: "New Object" }))[0]!);

    let detailEditor = await screen.findByTestId("detail-editor");

    await user.type(within(detailEditor).getByLabelText("Object Name"), "Cafe Exit");
    await user.type(
      within(detailEditor).getByLabelText("Information"),
      "A stable location anchor for the confrontation beat."
    );
    await user.click(within(detailEditor).getByRole("button", { name: "New Object" }));

    const objectNameButton = await screen.findByRole("button", { name: "Cafe Exit" });
    const objectRow = objectNameButton.closest(".object-row") as HTMLElement;

    await user.click(within(objectRow).getByRole("button", { name: "Cafe Exit" }));

    detailEditor = await screen.findByTestId("detail-editor");

    await user.clear(within(detailEditor).getByLabelText("Information"));
    await user.type(
      within(detailEditor).getByLabelText("Information"),
      "A sharpened location anchor for the confrontation beat."
    );
    await user.click(within(detailEditor).getByRole("button", { name: "Save Object" }));

    expect(
      await screen.findAllByText("A sharpened location anchor for the confrontation beat.")
    ).not.toHaveLength(0);

    unmount();
    render(<WorkspaceShell />);

    const restoredObjectButton = await screen.findByRole("button", { name: "Cafe Exit" });
    const restoredObjectRow = restoredObjectButton.closest(".object-row") as HTMLElement;

    expect(within(restoredObjectRow).getByRole("button", { name: "Cafe Exit" })).toBeInTheDocument();
    await user.click(within(restoredObjectRow).getByRole("button", { name: "Cafe Exit" }));
    expect(await screen.findByDisplayValue("A sharpened location anchor for the confrontation beat.")).toBeInTheDocument();
  }, 10000);

  it("persists inline node edits across reload and exposes fold plus visual-state actions", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    const { unmount } = render(<WorkspaceShell />);

    expect(await screen.findByTestId("selected-node-title")).toBeInTheDocument();
    expect(screen.queryByTestId("detail-editor")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create Node" }));
    await user.click(await screen.findByTestId("lane-minor"));
    await user.click(screen.getByRole("button", { name: "Create Node" }));
    await user.click(await screen.findByTestId("lane-detail"));
    pressWorkspaceKey("Escape");

    const minorNode = screen
      .getAllByTestId(/node-/)
      .find((element) => element.classList.contains("node-card-level-minor")) as
      | HTMLElement
      | undefined;

    expect(minorNode).toBeDefined();

    await user.click(minorNode!);

    const activeMinorNode = await screen.findByTestId(minorNode!.getAttribute("data-testid")!);
    await waitFor(() => {
      expect(activeMinorNode).toHaveClass("is-selected");
    });

    await user.click(within(activeMinorNode).getByRole("button", { name: /More/i }));
    await user.click(await screen.findByRole("button", { name: "Important" }));
    await user.click(within(activeMinorNode).getByRole("button", { name: /More/i }));
    await user.click(await screen.findByRole("button", { name: "Fixed" }));

    await waitFor(() => {
      expect(activeMinorNode).toHaveClass("is-important");
      expect(activeMinorNode).toHaveClass("is-fixed");
      expect(activeMinorNode).toHaveAttribute("draggable", "false");
    });

    await user.click(within(activeMinorNode).getByRole("button", { name: "Fold" }));

    await waitFor(() => {
      expect(
        screen
          .queryAllByTestId(/node-/)
          .filter((element) => element.classList.contains("node-card-level-detail"))
      ).toHaveLength(0);
    });
    expect(within(activeMinorNode).getByRole("button", { name: "Unfold" })).toBeInTheDocument();

    await user.click(within(activeMinorNode).getByRole("button", { name: "Unfold" }));
    const inlineInput = within(activeMinorNode).getByPlaceholderText("Type the beat");
    await user.clear(inlineInput);
    await user.type(inlineInput, "Minor beat stays visually locked for later revision.");
    fireEvent.blur(inlineInput);

    unmount();
    render(<WorkspaceShell />);
    await screen.findByTestId("node-count");

    const restoredMinorNode = screen
      .getAllByTestId(/node-/)
      .find((element) => element.classList.contains("node-card-level-minor")) as
      | HTMLElement
      | undefined;

    expect(restoredMinorNode).toBeDefined();

    await user.click(restoredMinorNode!);
    expect(await screen.findByTestId("selected-node-title")).toHaveTextContent(
      "Minor beat stays visually locked for later revision."
    );
  }, 10000);

  it("supports keyboard copy, paste, undo, redo, and escape for the selected node", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    expect(await screen.findByTestId("node-count")).toHaveTextContent("Nodes: 1");

    pressWorkspaceKey("c", { ctrlKey: true });
    pressWorkspaceKey("v", { ctrlKey: true });

    expect(await screen.findByTestId("node-count")).toHaveTextContent("Nodes: 2");
    expect(within(screen.getByTestId("history-controls")).getByRole("button", { name: "Undo" })).toBeEnabled();

    pressWorkspaceKey("z", { ctrlKey: true });

    expect(await screen.findByTestId("node-count")).toHaveTextContent("Nodes: 1");

    pressWorkspaceKey("z", { ctrlKey: true, shiftKey: true });

    expect(await screen.findByTestId("node-count")).toHaveTextContent("Nodes: 2");

    await openSelectedNodeMenu(user);
    await user.click(await screen.findByRole("button", { name: "Keyword Suggestions" }));

    expect(await screen.findByTestId("keyword-cloud")).toBeInTheDocument();

    pressWorkspaceKey("Escape");

    expect(screen.queryByTestId("keyword-cloud")).not.toBeInTheDocument();

    const selectedNodeCard = (await screen.findByTestId("selected-node-title")).closest(
      ".node-card"
    ) as HTMLElement;
    const inlineInput = within(selectedNodeCard).getByRole("textbox");

    await user.click(inlineInput);
    pressWorkspaceKey("c", { ctrlKey: true }, inlineInput);
    pressWorkspaceKey("v", { ctrlKey: true }, inlineInput);

    expect(await screen.findByTestId("node-count")).toHaveTextContent("Nodes: 3");

    const pastedSelectedNodeCard = (await screen.findByTestId("selected-node-title")).closest(
      ".node-card"
    ) as HTMLElement;
    const pastedInlineInput = within(pastedSelectedNodeCard).getByRole("textbox");

    pressWorkspaceKey("z", { ctrlKey: true }, pastedInlineInput);

    await waitFor(() => {
      expect(screen.getByTestId("node-count")).toHaveTextContent("Nodes: 2");
    });

    pressWorkspaceKey("Escape");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    pressWorkspaceKey("Delete");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    pressWorkspaceKey("Escape");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("allows the selected node to resize from every edge and corner", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    const user = userEvent.setup();

    render(<WorkspaceShell />);

    const selectedNode = (await screen.findByTestId("selected-node-title")).closest(
      ".node-card"
    ) as HTMLElement;

    expect(selectedNode.style.width).toBe("268px");
    expect(selectedNode.style.height).toBe("102px");

    await user.click(selectedNode);

    fireEvent.mouseDown(
      within(selectedNode).getByRole("button", { name: "Resize from right" }),
      {
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 148, clientY: 100 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(selectedNode.style.width).toBe("316px");
    });

    fireEvent.mouseDown(
      within(selectedNode).getByRole("button", { name: "Resize from bottom" }),
      {
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 100, clientY: 136 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(selectedNode.style.height).toBe("138px");
    });

    fireEvent.mouseDown(
      within(selectedNode).getByRole("button", { name: "Resize from bottom right" }),
      {
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 132, clientY: 124 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(selectedNode.style.width).toBe("348px");
      expect(selectedNode.style.height).toBe("162px");
    });

    const leftBefore = selectedNode.style.left;
    const topBefore = selectedNode.style.top;

    fireEvent.mouseDown(
      within(selectedNode).getByRole("button", { name: "Resize from left" }),
      {
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 76, clientY: 100 });
    await waitFor(() => {
      expect(selectedNode.style.width).toBe("372px");
      expect(selectedNode.style.left).not.toBe(leftBefore);
    });
    fireEvent.pointerUp(window);

    fireEvent.mouseDown(
      within(selectedNode).getByRole("button", { name: "Resize from top" }),
      {
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 100, clientY: 88 });
    await waitFor(() => {
      expect(selectedNode.style.height).toBe("174px");
      expect(selectedNode.style.top).not.toBe(topBefore);
    });
    fireEvent.pointerUp(window);

    expect(within(selectedNode).getByRole("button", { name: "Resize from top left" })).toBeInTheDocument();
    expect(within(selectedNode).getByRole("button", { name: "Resize from top right" })).toBeInTheDocument();
    expect(
      within(selectedNode).getByRole("button", { name: "Resize from bottom left" })
    ).toBeInTheDocument();
  });
});
