// 이 파일은 WorkspaceShell 주요 상호작용 시나리오를 검증하는 테스트를 포함합니다.
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

  // 캔버스 뷰포트 요소를 찾는 함수
  function getCanvasViewport() {
    const viewport = document.querySelector(".canvas-viewport");

    if (!(viewport instanceof HTMLElement)) {
      throw new Error("canvas_viewport_not_found");
    }

    return viewport;
  }

  // 인라인 스타일 px 문자열을 숫자로 파싱합니다.
  function parseCssPixels(value: string) {
    return Number.parseFloat(value.replace("px", ""));
  }

  // 레인 컬럼의 좌표와 폭을 읽어옵니다.
  function getLaneColumnMetrics(level: "major" | "minor" | "detail") {
    const laneColumn = document.querySelector(`.lane-column-${level}`);

    if (!(laneColumn instanceof HTMLElement)) {
      throw new Error(`lane_column_not_found:${level}`);
    }

    return {
      left: parseCssPixels(laneColumn.style.left),
      width: parseCssPixels(laneColumn.style.width)
    };
  }

  // 노드 카드의 좌표와 크기를 읽어옵니다.
  function getNodeCardMetrics(node: HTMLElement) {
    return {
      height: parseCssPixels(node.style.height),
      left: parseCssPixels(node.style.left),
      top: parseCssPixels(node.style.top),
      width: parseCssPixels(node.style.width)
    };
  }

  // 특정 X 좌표와 가장 가까운 연결 포트의 X 좌표를 찾습니다.
  function getClosestConnectionPortLeft(targetX: number) {
    const ports = Array.from(document.querySelectorAll(".connection-port-line"));

    if (ports.length === 0) {
      throw new Error("connection_port_not_found");
    }

    return ports
      .map((port) => parseCssPixels((port as HTMLElement).style.left))
      .sort((left, right) => Math.abs(left - targetX) - Math.abs(right - targetX))[0]!;
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
      expect(screen.queryByText("Owned Episode")).not.toBeInTheDocument();
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

  it("renders node more menu inside the fullscreen canvas container", async () => {
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
      const firstNodeCard = screen
        .getAllByTestId(/node-/)
        .find((element) => element.classList.contains("node-card")) as HTMLElement | undefined;

      if (!firstNodeCard) {
        throw new Error("node_card_not_found");
      }

      await user.click(firstNodeCard);
      await openSelectedNodeMenu(user);

      const keywordButton = await screen.findByRole("button", { name: "Keyword Suggestions" });
      expect(keywordButton.closest(".panel-canvas")).not.toBeNull();
    } finally {
      HTMLElement.prototype.requestFullscreen = originalRequestFullscreen;
      document.exitFullscreen = originalExitFullscreen;
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        value: null
      });
    }
  });

  it("resizes the selected node while the canvas is fullscreen", async () => {
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
      const selectedNode = await getSelectedNodeCard();

      await user.click(selectedNode);
      fireEvent.pointerDown(
        within(selectedNode).getByRole("button", { name: "Resize horizontally" }),
        {
          button: 0,
          clientX: 100,
          clientY: 100
        }
      );
      fireEvent.pointerMove(window, { clientX: 148, clientY: 100 });
      fireEvent.pointerUp(window);

      await waitFor(() => {
        expect(selectedNode.style.width).toBe("316px");
      });
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

  it("pins selected keywords first when refreshing the cloud", async () => {
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
  });

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

  it("uses ctrl+wheel on the canvas viewport to zoom the canvas itself", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ message: "not_found" }), {
        headers: {
          "Content-Type": "application/json"
        },
        status: 404
      })
    ) as typeof fetch;

    render(<WorkspaceShell />);

    const zoomReadout = await screen.findByRole("button", { name: "Reset Zoom" });
    const majorLane = await screen.findByTestId("lane-major");
    const canvasViewport = majorLane.closest(".canvas-viewport");

    if (!(canvasViewport instanceof HTMLElement)) {
      throw new Error("canvas_viewport_not_found");
    }

    expect(zoomReadout).toHaveTextContent("100%");

    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 160,
      clientY: 160,
      ctrlKey: true,
      deltaY: -120
    });

    canvasViewport.dispatchEvent(wheelEvent);

    await waitFor(() => {
      expect(zoomReadout).toHaveTextContent("118%");
    });
    expect(wheelEvent.defaultPrevented).toBe(true);
  });

  it("uses ctrl+wheel on a node input inside the canvas to zoom the canvas itself", async () => {
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

    const zoomReadout = await screen.findByRole("button", { name: "Reset Zoom" });
    const selectedNodeCard = await getSelectedNodeCard();
    const inlineInput = within(selectedNodeCard).getByRole("textbox");

    await user.click(inlineInput);

    expect(inlineInput).toHaveFocus();
    expect(zoomReadout).toHaveTextContent("100%");

    const wheelEvent = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: 180,
      clientY: 180,
      ctrlKey: true,
      deltaY: -120
    });

    inlineInput.dispatchEvent(wheelEvent);

    await waitFor(() => {
      expect(zoomReadout).toHaveTextContent("118%");
    });
    expect(wheelEvent.defaultPrevented).toBe(true);
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

  it("highlights the selected episode and its containing folder in the sidebar", async () => {
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

    const folderItem = (await screen.findByText("Act One")).closest(".sidebar-folder-item") as HTMLElement;

    await user.click(within(folderItem).getByRole("button", { name: "More Act One" }));
    await user.click(await screen.findByRole("button", { name: "Add Episodes" }));
    await user.click(
      within(document.querySelector(".sidebar-folder-picker") as HTMLElement).getByRole("button", {
        name: /Episode 12/
      })
    );
    await user.click(
      within(document.querySelector(".sidebar-folder-picker") as HTMLElement).getByRole("button", {
        name: /Episode 11/
      })
    );
    await user.click(document.body);

    await waitFor(() => {
      expect(folderItem).toHaveClass("is-active");
      expect(
        within(folderItem)
          .getByRole("button", { name: "Episode 12" })
          .closest(".sidebar-episode-item")
      ).toHaveClass("is-active");
    });

    await user.click(within(folderItem).getByRole("button", { name: "Episode 11" }));

    await waitFor(() => {
      expect(folderItem).toHaveClass("is-active");
      expect(
        within(folderItem)
          .getByRole("button", { name: "Episode 11" })
          .closest(".sidebar-episode-item")
      ).toHaveClass("is-active");
      expect(
        within(folderItem)
          .getByRole("button", { name: "Episode 12" })
          .closest(".sidebar-episode-item")
      ).not.toHaveClass("is-active");
    });
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
    const canvasViewport = getCanvasViewport();
    await user.click(canvasViewport);

    pressWorkspaceKey("c", { ctrlKey: true }, canvasViewport);
    pressWorkspaceKey("v", { ctrlKey: true }, canvasViewport);

    expect(await screen.findByTestId("node-count")).toHaveTextContent("Nodes: 2");
    expect(within(screen.getByTestId("history-controls")).getByRole("button", { name: "Undo" })).toBeEnabled();

    pressWorkspaceKey("z", { ctrlKey: true }, canvasViewport);

    expect(await screen.findByTestId("node-count")).toHaveTextContent("Nodes: 1");

    pressWorkspaceKey("z", { ctrlKey: true, shiftKey: true }, canvasViewport);

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
      expect(screen.getByTestId("node-count")).toHaveTextContent("Nodes: 3");
    });

    pressWorkspaceKey("Escape");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    pressWorkspaceKey("Delete");

    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    pressWorkspaceKey("Escape");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("restores resized node dimensions after delete undo and keeps redo consistent", async () => {
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
    await screen.findByTestId("node-count");
    await waitFor(() => {
      expect(document.querySelector(".timeline-start-anchor")).not.toBeNull();
      expect(document.querySelector(".timeline-end-handle")).not.toBeNull();
    });

    const selectedNode = (await screen.findByTestId("selected-node-title")).closest(
      ".node-card"
    ) as HTMLElement;
    const canvasViewport = getCanvasViewport();

    await user.click(canvasViewport);
    await user.click(selectedNode);

    fireEvent.pointerDown(
      within(selectedNode).getByRole("button", { name: "Resize horizontally" }),
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

    pressWorkspaceKey("Delete", {}, canvasViewport);

    const deleteDialog = await screen.findByRole("dialog");
    await user.click(within(deleteDialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => {
      expect(screen.getByTestId("node-count")).toHaveTextContent("Nodes: 0");
    });

    pressWorkspaceKey("z", { ctrlKey: true }, canvasViewport);

    await waitFor(() => {
      expect(screen.getByTestId("node-count")).toHaveTextContent("Nodes: 1");
    });

    const restoredNode = (await screen.findByTestId("selected-node-title")).closest(
      ".node-card"
    ) as HTMLElement;

    expect(restoredNode.style.width).toBe("316px");

    pressWorkspaceKey("y", { ctrlKey: true }, canvasViewport);
    await waitFor(() => {
      expect(screen.getByTestId("node-count")).toHaveTextContent("Nodes: 0");
    });

    pressWorkspaceKey("z", { ctrlKey: true }, canvasViewport);
    await waitFor(() => {
      expect(screen.getByTestId("node-count")).toHaveTextContent("Nodes: 1");
    });

    const restoredAfterRedoNode = (await screen.findByTestId("selected-node-title")).closest(
      ".node-card"
    ) as HTMLElement;

    expect(restoredAfterRedoNode.style.width).toBe("316px");
  });

  it("sizes the first major node to timeline span and shrinks timeline after deletion", async () => {
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
    await screen.findByTestId("node-count");

    function getTimelineSpan() {
      const startAnchor = document.querySelector(".timeline-start-anchor");
      const endHandle = document.querySelector(".timeline-end-handle");

      if (!(startAnchor instanceof HTMLElement) || !(endHandle instanceof HTMLElement)) {
        throw new Error("timeline_anchor_not_found");
      }

      const startTop = Number.parseFloat(startAnchor.style.top.replace("px", ""));
      const endTop = Number.parseFloat(endHandle.style.top.replace("px", ""));

      return {
        endTop,
        span: Math.round(endTop - startTop)
      };
    }

    const initialTimeline = getTimelineSpan();
    const selectedNode = (await screen.findByTestId("selected-node-title")).closest(
      ".node-card"
    ) as HTMLElement;

    await user.click(selectedNode);
    pressWorkspaceKey("Delete");

    const deleteDialog = await screen.findByRole("dialog");
    await user.click(within(deleteDialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByTestId("node-count")).toHaveTextContent("Nodes: 0");
    });

    const shrunkTimeline = getTimelineSpan();
    expect(shrunkTimeline.endTop).toBeLessThan(initialTimeline.endTop);

    await user.click(screen.getByRole("button", { name: "Create Node" }));
    await user.click(screen.getByTestId("lane-major"));

    await waitFor(() => {
      expect(screen.getByTestId("node-count")).toHaveTextContent("Nodes: 1");
    });

    const recreatedMajorNode = (await screen.findByTestId("selected-node-title")).closest(
      ".node-card"
    ) as HTMLElement;

    expect(recreatedMajorNode.style.height).toBe(`${shrunkTimeline.span}px`);
  });

  it("disables timeline-end drag when start and end are the same major node", async () => {
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

    const getMajorNodes = () =>
      screen
        .getAllByTestId(/node-/)
        .filter((element) => element.classList.contains("node-card-level-major")) as HTMLElement[];

    await waitFor(() => {
      expect(getMajorNodes()).toHaveLength(1);
    });

    expect(await screen.findByRole("button", { name: "Move timeline end" })).toBeDisabled();

    await createEmptyMajorNode(user);

    await waitFor(() => {
      expect(getMajorNodes()).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Move timeline end" })).toBeEnabled();
    });
  });

  it("keeps major start/end markers after resizing major nodes", async () => {
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

    const getMajorNodes = () =>
      screen
        .getAllByTestId(/node-/)
        .filter((element) => element.classList.contains("node-card-level-major")) as HTMLElement[];

    await waitFor(() => {
      expect(getMajorNodes()).toHaveLength(2);
    });

    const startNodeBefore = getMajorNodes().find((element) =>
      element.classList.contains("is-start-node")
    );
    const endNodeBefore = getMajorNodes().find((element) =>
      element.classList.contains("is-end-node")
    );

    if (!startNodeBefore || !endNodeBefore) {
      throw new Error("missing_start_or_end_major_node");
    }

    const startNodeId = startNodeBefore.getAttribute("data-testid");
    const endNodeId = endNodeBefore.getAttribute("data-testid");

    if (!startNodeId || !endNodeId || startNodeId === endNodeId) {
      throw new Error("invalid_major_anchor_nodes");
    }

    await user.click(endNodeBefore);
    fireEvent.pointerDown(
      within(endNodeBefore).getByRole("button", { name: "Resize vertically" }),
      {
        button: 0,
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 100, clientY: 136 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(screen.getByTestId(startNodeId)).toHaveClass("is-start-node");
      expect(screen.getByTestId(endNodeId)).toHaveClass("is-end-node");
    });
  });

  it("keeps resized end major node aligned to timeline center and end anchor", async () => {
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

    const endNodeBefore = document.querySelector(".node-card-level-major.is-end-node");

    if (!(endNodeBefore instanceof HTMLElement)) {
      throw new Error("end_major_node_not_found");
    }

    await user.click(endNodeBefore);
    fireEvent.pointerDown(
      within(endNodeBefore).getByRole("button", { name: "Resize horizontally" }),
      {
        button: 0,
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 420, clientY: 100 });
    fireEvent.pointerUp(window);

    fireEvent.pointerDown(
      within(endNodeBefore).getByRole("button", { name: "Resize vertically" }),
      {
        button: 0,
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 100, clientY: 240 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(parseCssPixels(endNodeBefore.style.width)).toBeGreaterThan(268);
      expect(parseCssPixels(endNodeBefore.style.height)).toBeGreaterThan(102);
    });

    const endNodeAfter = document.querySelector(".node-card-level-major.is-end-node");
    const timelineStartAnchor = document.querySelector(".timeline-start-anchor");
    const timelineEndHandle = screen.getByRole("button", { name: "Move timeline end" });

    if (!(endNodeAfter instanceof HTMLElement)) {
      throw new Error("resized_end_major_node_not_found");
    }

    if (!(timelineStartAnchor instanceof HTMLElement)) {
      throw new Error("timeline_start_anchor_not_found");
    }

    if (!(timelineEndHandle instanceof HTMLElement)) {
      throw new Error("timeline_end_handle_not_found");
    }

    const majorLane = getLaneColumnMetrics("major");
    const timelineCenterX = majorLane.left + parseCssPixels(timelineStartAnchor.style.left);
    const endNodeCenterX =
      parseCssPixels(endNodeAfter.style.left) + parseCssPixels(endNodeAfter.style.width) / 2;
    const timelineEndY = parseCssPixels(timelineEndHandle.style.top);
    const endNodeBottomY =
      parseCssPixels(endNodeAfter.style.top) + parseCssPixels(endNodeAfter.style.height);

    expect(Math.abs(endNodeCenterX - timelineCenterX)).toBeLessThan(0.6);
    expect(Math.abs(endNodeBottomY - timelineEndY)).toBeLessThan(0.6);
  });

  it("keeps three major nodes separated after large end-node resize", async () => {
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
    await createEmptyMajorNode(user);

    const endMajorNodeBefore = document.querySelector(".node-card-level-major.is-end-node");

    if (!(endMajorNodeBefore instanceof HTMLElement)) {
      throw new Error("end_major_node_not_found");
    }

    await user.click(endMajorNodeBefore);
    fireEvent.pointerDown(
      within(endMajorNodeBefore).getByRole("button", { name: "Resize vertically" }),
      {
        button: 0,
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 100, clientY: 760 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(parseCssPixels(endMajorNodeBefore.style.height)).toBeGreaterThan(500);
    });

    const endMajorNodeAfter = document.querySelector(".node-card-level-major.is-end-node");
    const middleMajorNode = Array.from(document.querySelectorAll(".node-card-level-major")).find(
      (nodeElement) =>
        !nodeElement.classList.contains("is-start-node") &&
        !nodeElement.classList.contains("is-end-node")
    );

    if (!(endMajorNodeAfter instanceof HTMLElement)) {
      throw new Error("end_major_node_after_resize_not_found");
    }

    if (!(middleMajorNode instanceof HTMLElement)) {
      throw new Error("middle_major_node_not_found");
    }

    const endMetrics = getNodeCardMetrics(endMajorNodeAfter);
    const middleMetrics = getNodeCardMetrics(middleMajorNode);
    const upperNodeBottom =
      endMetrics.top < middleMetrics.top
        ? endMetrics.top + endMetrics.height
        : middleMetrics.top + middleMetrics.height;
    const lowerNodeTop =
      endMetrics.top < middleMetrics.top ? middleMetrics.top : endMetrics.top;

    expect(upperNodeBottom + 17).toBeLessThanOrEqual(lowerNodeTop + 0.6);
  });

  it("hides resize handles for fixed nodes", async () => {
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

    const selectedNode = await getSelectedNodeCard();
    await user.click(selectedNode);
    await openSelectedNodeMenu(user);
    await user.click(await screen.findByRole("button", { name: "Fixed" }));

    await waitFor(() => {
      expect(selectedNode).toHaveClass("is-fixed");
    });

    expect(
      within(selectedNode).queryByRole("button", { name: "Resize horizontally" })
    ).not.toBeInTheDocument();
    expect(
      within(selectedNode).queryByRole("button", { name: "Resize vertically" })
    ).not.toBeInTheDocument();
    expect(
      within(selectedNode).queryByRole("button", { name: "Resize diagonally" })
    ).not.toBeInTheDocument();
  });

  it("keeps vertical resize shrink delta consistent with expansion delta", async () => {
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

    const selectedNode = await getSelectedNodeCard();

    await user.click(selectedNode);
    fireEvent.pointerDown(
      within(selectedNode).getByRole("button", { name: "Resize vertically" }),
      {
        button: 0,
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 100, clientY: 148 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(selectedNode.style.height).toBe("150px");
    });

    fireEvent.pointerDown(
      within(selectedNode).getByRole("button", { name: "Resize vertically" }),
      {
        button: 0,
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 100, clientY: 76 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(selectedNode.style.height).toBe("126px");
    });
  });

  it("preserves manual vertical shrink after pointer up on text-expanded nodes", async () => {
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

    const selectedNode = await getSelectedNodeCard();
    await user.click(selectedNode);
    fireEvent.pointerDown(
      within(selectedNode).getByRole("button", { name: "Resize vertically" }),
      {
        button: 0,
        clientX: 100,
        clientY: 120
      }
    );
    fireEvent.pointerMove(window, { clientX: 100, clientY: 220 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(parseCssPixels(selectedNode.style.height)).toBeGreaterThan(180);
    });

    const expandedHeight = parseCssPixels(selectedNode.style.height);
    const inlineInput = within(selectedNode).getByRole("textbox");
    const inlineEditor = inlineInput.closest(".node-inline-editor");

    if (!(inlineEditor instanceof HTMLElement)) {
      throw new Error("inline_editor_not_found");
    }

    Object.defineProperty(inlineEditor, "scrollHeight", {
      configurable: true,
      get: () => 220
    });
    Object.defineProperty(inlineInput, "scrollHeight", {
      configurable: true,
      get: () => 220
    });

    fireEvent.pointerDown(
      within(selectedNode).getByRole("button", { name: "Resize vertically" }),
      {
        button: 0,
        clientX: 100,
        clientY: 220
      }
    );
    fireEvent.pointerMove(window, { clientX: 100, clientY: 120 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(parseCssPixels(selectedNode.style.height)).toBeLessThan(expandedHeight - 60);
    });

    const shrunkHeight = parseCssPixels(selectedNode.style.height);

    await waitFor(() => {
      expect(parseCssPixels(selectedNode.style.height)).toBe(shrunkHeight);
    });
  });

  it("keeps node height stable while typing when editor scrollHeight follows card height", async () => {
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

    const selectedNode = await getSelectedNodeCard();
    await user.click(selectedNode);

    const inlineInput = within(selectedNode).getByRole("textbox");
    const inlineEditor = inlineInput.closest(".node-inline-editor");
    const previewElement =
      inlineInput.closest(".node-inline-input-shell")?.querySelector(".node-inline-preview");

    if (!(inlineEditor instanceof HTMLElement)) {
      throw new Error("inline_editor_not_found");
    }

    if (!(previewElement instanceof HTMLElement)) {
      throw new Error("inline_preview_not_found");
    }

    Object.defineProperty(previewElement, "scrollHeight", {
      configurable: true,
      get: () => 64
    });
    Object.defineProperty(inlineInput, "scrollHeight", {
      configurable: true,
      get: () => 64
    });
    Object.defineProperty(inlineEditor, "scrollHeight", {
      configurable: true,
      get: () => parseCssPixels(selectedNode.style.height)
    });

    fireEvent.change(inlineInput, {
      target: {
        value: "a"
      }
    });

    await waitFor(() => {
      expect(parseCssPixels(selectedNode.style.height)).toBeGreaterThan(102);
    });

    const firstTypedHeight = parseCssPixels(selectedNode.style.height);

    fireEvent.change(inlineInput, {
      target: {
        value: "ab"
      }
    });
    fireEvent.change(inlineInput, {
      target: {
        value: "abc"
      }
    });
    fireEvent.change(inlineInput, {
      target: {
        value: "abcd"
      }
    });
    fireEvent.change(inlineInput, {
      target: {
        value: "abcde"
      }
    });

    await waitFor(() => {
      expect(parseCssPixels(selectedNode.style.height)).toBe(firstTypedHeight);
    });
  });

  it("does not grow node height on key-only interactions when preview height tracks the card", async () => {
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

    const selectedNode = await getSelectedNodeCard();
    await user.click(selectedNode);

    const inlineInput = within(selectedNode).getByRole("textbox");
    const previewElement =
      inlineInput.closest(".node-inline-input-shell")?.querySelector(".node-inline-preview");

    if (!(previewElement instanceof HTMLElement)) {
      throw new Error("inline_preview_not_found");
    }

    Object.defineProperty(previewElement, "scrollHeight", {
      configurable: true,
      get: () => parseCssPixels(selectedNode.style.height)
    });
    Object.defineProperty(inlineInput, "scrollHeight", {
      configurable: true,
      get: () => 64
    });

    const baselineHeight = parseCssPixels(selectedNode.style.height);

    fireEvent.keyUp(inlineInput, { key: "ArrowDown" });
    fireEvent.keyUp(inlineInput, { key: "ArrowUp" });
    fireEvent.keyUp(inlineInput, { key: "Escape" });
    fireEvent.keyUp(inlineInput, { key: "Control" });

    await waitFor(() => {
      expect(parseCssPixels(selectedNode.style.height)).toBe(baselineHeight);
    });
  });

  it("keeps resized minor nodes centered, shifts connection ports, and expands lane width", async () => {
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

    await user.click(await screen.findByRole("button", { name: "Create Node" }));
    await user.click(await screen.findByTestId("lane-minor"));

    const selectedNode = await getSelectedNodeCard();
    expect(selectedNode).toHaveClass("node-card-level-minor");

    const minorLaneBefore = getLaneColumnMetrics("minor");
    const selectedNodeBefore = getNodeCardMetrics(selectedNode);
    const selectedNodeCenterBefore = selectedNodeBefore.left + selectedNodeBefore.width / 2;
    const minorLaneCenterBefore = minorLaneBefore.left + minorLaneBefore.width / 2;
    const childPortLeftBefore = getClosestConnectionPortLeft(selectedNodeCenterBefore);

    expect(Math.abs(selectedNodeCenterBefore - minorLaneCenterBefore)).toBeLessThan(0.6);

    fireEvent.pointerDown(
      within(selectedNode).getByRole("button", { name: "Resize horizontally" }),
      {
        button: 0,
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 340, clientY: 100 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(parseCssPixels(selectedNode.style.width)).toBeGreaterThan(selectedNodeBefore.width);
    });

    const minorLaneAfter = getLaneColumnMetrics("minor");
    const selectedNodeAfter = getNodeCardMetrics(selectedNode);
    const selectedNodeCenterAfter = selectedNodeAfter.left + selectedNodeAfter.width / 2;
    const minorLaneCenterAfter = minorLaneAfter.left + minorLaneAfter.width / 2;
    const childPortLeftAfter = getClosestConnectionPortLeft(selectedNodeCenterAfter);

    expect(minorLaneAfter.width).toBeGreaterThan(minorLaneBefore.width);
    expect(selectedNodeAfter.left + selectedNodeAfter.width).toBeLessThanOrEqual(
      minorLaneAfter.left + minorLaneAfter.width + 0.6
    );
    expect(Math.abs(selectedNodeCenterAfter - minorLaneCenterAfter)).toBeLessThan(0.6);
    expect(Math.abs(childPortLeftAfter - selectedNodeCenterAfter)).toBeLessThan(0.6);
    expect(childPortLeftAfter).toBeGreaterThan(childPortLeftBefore);
  });

  it("keeps oversized horizontal resize inside the minor lane bounds", async () => {
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

    await user.click(await screen.findByRole("button", { name: "Create Node" }));
    await user.click(await screen.findByTestId("lane-minor"));

    const selectedNode = await getSelectedNodeCard();
    expect(selectedNode).toHaveClass("node-card-level-minor");

    await user.click(selectedNode);
    fireEvent.pointerDown(
      within(selectedNode).getByRole("button", { name: "Resize horizontally" }),
      {
        button: 0,
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 6200, clientY: 100 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(parseCssPixels(selectedNode.style.width)).toBeGreaterThan(268);
    });

    const minorLaneAfter = getLaneColumnMetrics("minor");
    const selectedNodeAfter = getNodeCardMetrics(selectedNode);

    expect(selectedNodeAfter.left).toBeGreaterThanOrEqual(minorLaneAfter.left - 0.6);
    expect(selectedNodeAfter.left + selectedNodeAfter.width).toBeLessThanOrEqual(
      minorLaneAfter.left + minorLaneAfter.width + 0.6
    );
  });

  it("allows the selected node to resize horizontally, vertically, and diagonally", async () => {
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

    fireEvent.pointerDown(
      within(selectedNode).getByRole("button", { name: "Resize horizontally" }),
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

    fireEvent.pointerDown(
      within(selectedNode).getByRole("button", { name: "Resize vertically" }),
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

    fireEvent.pointerDown(
      within(selectedNode).getByRole("button", { name: "Resize diagonally" }),
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
  });

  it("keeps node position fixed while resizing", async () => {
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

    await user.click(selectedNode);

    const leftBefore = parseCssPixels(selectedNode.style.left);
    const topBefore = parseCssPixels(selectedNode.style.top);

    fireEvent.pointerDown(
      within(selectedNode).getByRole("button", { name: "Resize vertically" }),
      {
        clientX: 100,
        clientY: 100
      }
    );
    fireEvent.pointerMove(window, { clientX: 100, clientY: 148 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(parseCssPixels(selectedNode.style.height)).toBeGreaterThan(102);
      expect(parseCssPixels(selectedNode.style.left)).toBe(leftBefore);
      expect(parseCssPixels(selectedNode.style.top)).toBe(topBefore);
    });
  });

  it("starts node movement only after pointer drag crosses the activation threshold", async () => {
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

    await user.click(await screen.findByRole("button", { name: "Create Node" }));
    await user.click(await screen.findByTestId("lane-minor"));

    const selectedMinorNode = await getSelectedNodeCard();
    const nodeTestId = selectedMinorNode.getAttribute("data-testid");

    if (!nodeTestId) {
      throw new Error("selected_minor_node_testid_missing");
    }

    const getMinorNode = () => screen.getByTestId(nodeTestId);
    const before = getNodeCardMetrics(getMinorNode());

    fireEvent.pointerDown(getMinorNode(), {
      button: 0,
      clientX: before.left + 32,
      clientY: before.top + 24
    });
    fireEvent.pointerMove(window, {
      clientX: before.left + 35,
      clientY: before.top + 26
    });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(getNodeCardMetrics(getMinorNode()).left).toBe(before.left);
      expect(getNodeCardMetrics(getMinorNode()).top).toBe(before.top);
    });

    fireEvent.pointerDown(getMinorNode(), {
      button: 0,
      clientX: before.left + 32,
      clientY: before.top + 24
    });
    fireEvent.pointerMove(window, {
      clientX: before.left + 92,
      clientY: before.top + 104
    });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      const after = getNodeCardMetrics(getMinorNode());

      expect(after.left).toBe(before.left);
      expect(after.top).toBeGreaterThan(before.top + 50);
    });
  });
});
