import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AppRoutes } from "./AppRoutes";

describe("frontend routes baseline", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the landing page at the root route", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "Your story is just one clue away"
      })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open workspace" })[0]).toHaveAttribute(
      "href",
      "/workspace"
    );
    expect(screen.getByRole("heading", { name: "Why use ARIAD before drafting scenes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Three things before the canvas" })).toBeInTheDocument();
  });

  it("renders the landing page at the service entry route", () => {
    render(
      <MemoryRouter initialEntries={["/service.html"]}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "Your story is just one clue away"
      })
    ).toBeInTheDocument();
  });

  it("renders the merged landing page at the legacy explanation route", () => {
    render(
      <MemoryRouter initialEntries={["/explanation"]}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "Your story is just one clue away"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("Ask AI through keyword clouds")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open workspace" })[0]).toHaveAttribute(
      "href",
      "/workspace"
    );
  });

  it("renders the workspace shell", async () => {
    render(
      <MemoryRouter initialEntries={["/workspace"]}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "ARIAD Workspace" })).toBeInTheDocument();
    expect(await screen.findByText("Canvas")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Create Node" })).toBeInTheDocument();
    expect(await screen.findByText("Major Event Lane")).toBeInTheDocument();
    expect(await screen.findByText("Minor Event Lane")).toBeInTheDocument();
    expect(await screen.findByText("Minor Detail Lane")).toBeInTheDocument();
    expect(await screen.findByTestId("node-count")).toHaveTextContent("Nodes: 0");
    expect(screen.queryByRole("button", { name: "Temporary Drawer" })).not.toBeInTheDocument();
  });

  it("renders the auth callback route", () => {
    render(
      <MemoryRouter initialEntries={["/auth/callback?code=demo&state=reader"]}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: "Auth Callback" })).toBeInTheDocument();
    expect(screen.getByText("demo")).toBeInTheDocument();
    expect(screen.getByText("reader")).toBeInTheDocument();
  });
});
