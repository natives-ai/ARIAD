import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { AppRoutes } from "./AppRoutes";

describe("frontend routes baseline", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the ARIAD landing page", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "Lock the next episode structure before the deadline locks you."
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See how ARIAD works" })).toHaveAttribute(
      "href",
      "/explanation"
    );
    expect(screen.getByRole("link", { name: "Start structuring an episode" })).toHaveAttribute(
      "href",
      "/workspace"
    );
  });

  it("renders the explanation page", () => {
    render(
      <MemoryRouter initialEntries={["/explanation"]}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(
      screen.getByRole("heading", {
        name: "ARIAD is a canvas-based structure editor for the episode you need to finish next."
      })
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Why ARIAD is not just a chat box" })).toBeInTheDocument();
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
    expect(await screen.findByTestId("node-count")).toHaveTextContent("Nodes: 1");
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
