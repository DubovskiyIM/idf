// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import RoleDetailPane from "../RoleDetailPane.jsx";

afterEach(cleanup);

const ROLE = {
  id: "r1", name: "data_engineer",
  securableObjects: [
    { fullName: "metalake_prod", type: "metalake", privileges: [
      { name: "USE_METALAKE",   condition: "ALLOW" },
      { name: "CREATE_CATALOG", condition: "ALLOW" },
    ]},
    { fullName: "catalog_hive_prod", type: "catalog", privileges: [
      { name: "USE_CATALOG",    condition: "ALLOW" },
      { name: "CREATE_SCHEMA",  condition: "ALLOW" },
      { name: "DROP_SCHEMA",    condition: "DENY" },
    ]},
  ],
  properties: { team: "platform" },
};

describe("RoleDetailPane", () => {
  it("header показывает role name", () => {
    render(<RoleDetailPane role={ROLE} />);
    expect(screen.getAllByText("data_engineer").length).toBeGreaterThan(0);
  });

  it("Privileges tab default — показывает securable objects сгруппированными по type", () => {
    render(<RoleDetailPane role={ROLE} />);
    expect(screen.getByRole("tab", { name: /privileges/i })).toBeTruthy();
    expect(screen.getByText("metalake_prod")).toBeTruthy();
    expect(screen.getByText("catalog_hive_prod")).toBeTruthy();
    expect(screen.getByText("USE_METALAKE")).toBeTruthy();
    expect(screen.getByText("CREATE_SCHEMA")).toBeTruthy();
  });

  it("DENY privilege показан с warning-цветом", () => {
    render(<RoleDetailPane role={ROLE} />);
    const denyChip = screen.getByText(/DROP_SCHEMA/);
    // Сам chip или его wrapper должен быть красный (#FF3E1D ↔ rgb(255,62,29)).
    // jsdom нормализует hex в rgb-нотацию через computed style.
    const color = denyChip.style.color || denyChip.parentElement?.style.color || "";
    expect(color).toMatch(/FF3E1D|red|255,\s*62,\s*29|#FF/i);
  });

  it("Properties tab показывает key-value", () => {
    render(<RoleDetailPane role={ROLE} />);
    fireEvent.click(screen.getByRole("tab", { name: /properties/i }));
    expect(screen.getByText("team")).toBeTruthy();
    expect(screen.getByText("platform")).toBeTruthy();
  });

  it("role без securableObjects → empty state", () => {
    render(<RoleDetailPane role={{ id: "r0", name: "empty_role", securableObjects: [] }} />);
    expect(screen.getByText(/нет привилегий|no privileges/i)).toBeTruthy();
  });
});
