// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CatalogsTable from "../CatalogsTable.jsx";

afterEach(cleanup);

const TAGS = [
  { id: "t1", name: "PII" },
  { id: "t2", name: "Financial" },
  { id: "t3", name: "GDPR" },
];
const POLICIES = [
  { id: "p1", name: "pii-mask" },
  { id: "p2", name: "retention-365d" },
];
const CATALOGS = [
  { id: "c1", name: "hive_warehouse", type: "relational", provider: "hive", comment: "Hive WH", tags: ["PII", "Financial"], policies: ["pii-mask"] },
  { id: "c2", name: "iceberg_lakehouse", type: "relational", provider: "iceberg", comment: "Iceberg", tags: [], policies: [] },
];

describe("CatalogsTable", () => {
  it("Tags колонка показывает chips", () => {
    render(<CatalogsTable catalogs={CATALOGS} availableTags={TAGS} availablePolicies={POLICIES} onAssociate={vi.fn()} />);
    expect(screen.getByText("PII")).toBeTruthy();
    expect(screen.getByText("Financial")).toBeTruthy();
  });

  it("Policies колонка показывает chips", () => {
    render(<CatalogsTable catalogs={CATALOGS} availableTags={TAGS} availablePolicies={POLICIES} onAssociate={vi.fn()} />);
    expect(screen.getByText("pii-mask")).toBeTruthy();
  });

  it("catalog без tags — '+ Associate Tag' кнопка", () => {
    render(<CatalogsTable catalogs={CATALOGS} availableTags={TAGS} availablePolicies={POLICIES} onAssociate={vi.fn()} />);
    // c2 (iceberg) пустой — должна быть кнопка
    const buttons = screen.getAllByRole("button", { name: /associate tag/i });
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("click + Associate Tag → AssociatePopover открывается", () => {
    render(<CatalogsTable catalogs={CATALOGS} availableTags={TAGS} availablePolicies={POLICIES} onAssociate={vi.fn()} />);
    const buttons = screen.getAllByRole("button", { name: /associate tag/i });
    fireEvent.click(buttons[0]);
    expect(screen.getByRole("dialog", { name: /associate tag/i })).toBeTruthy();
  });

  it("popover Apply → onAssociate(catalogId, 'tags', names)", () => {
    const onAssociate = vi.fn();
    render(<CatalogsTable catalogs={CATALOGS} availableTags={TAGS} availablePolicies={POLICIES} onAssociate={onAssociate} />);
    // c2 — iceberg, второй row, нет тагов
    const buttons = screen.getAllByRole("button", { name: /associate tag/i });
    fireEvent.click(buttons[buttons.length - 1]); // последний = iceberg
    fireEvent.click(screen.getByLabelText("GDPR"));
    fireEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(onAssociate).toHaveBeenCalledWith("c2", "tags", ["GDPR"]);
  });
});
