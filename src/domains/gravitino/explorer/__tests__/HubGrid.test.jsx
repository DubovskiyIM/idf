// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import HubGrid from "../HubGrid.jsx";

afterEach(cleanup);

const TILES = [
  { projectionId: "user_list", label: "Users",  description: "User accounts",   icon: "👤" },
  { projectionId: "group_list", label: "Groups", description: "User groups",     icon: "👥" },
  { projectionId: "role_list", label: "Roles",  description: "RBAC roles",      icon: "🎭" },
];

describe("HubGrid", () => {
  it("рендерит title + все tiles с label/description", () => {
    render(<HubGrid title="Access Control" subtitle="IAM resources" tiles={TILES} />);
    expect(screen.getByText("Access Control")).toBeTruthy();
    expect(screen.getByText("IAM resources")).toBeTruthy();
    expect(screen.getByText("Users")).toBeTruthy();
    expect(screen.getByText("User accounts")).toBeTruthy();
    expect(screen.getByText("Groups")).toBeTruthy();
    expect(screen.getByText("Roles")).toBeTruthy();
  });

  it("каждый tile — ссылка на /gravitino/<projectionId>", () => {
    render(<HubGrid title="t" tiles={TILES} />);
    const userLink = screen.getByRole("link", { name: /users/i });
    expect(userLink.getAttribute("href")).toBe("/gravitino/user_list");
    const groupLink = screen.getByRole("link", { name: /groups/i });
    expect(groupLink.getAttribute("href")).toBe("/gravitino/group_list");
  });

  it("icons рендерятся", () => {
    render(<HubGrid title="t" tiles={TILES} />);
    expect(screen.getByText("👤")).toBeTruthy();
    expect(screen.getByText("👥")).toBeTruthy();
    expect(screen.getByText("🎭")).toBeTruthy();
  });
});
