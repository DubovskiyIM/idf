// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import MetadataObjectsPane from "../MetadataObjectsPane.jsx";

afterEach(cleanup);

const WORLD = {
  catalogs: [{ id: "c1", name: "hive", tags: ["ALPHA"], policies: ["pii-mask"] }],
  schemas: [{ id: "s1", name: "hr", catalogId: "c1", tags: ["ALPHA"], policies: [] }],
  tables: [{ id: "t1", name: "users", schemaId: "s1", tags: [], policies: ["pii-mask"] }],
  filesets: [],
  topics: [],
  models: [],
};

describe("MetadataObjectsPane", () => {
  it("kind=tag ALPHA — list catalog hive + schema hive.hr", () => {
    render(<MetadataObjectsPane kind="tag" name="ALPHA" world={WORLD} onUnlink={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /Metadata Objects/i })).toBeTruthy();
    expect(screen.getByText("hive")).toBeTruthy();
    expect(screen.getByText("hive.hr")).toBeTruthy();
    expect(screen.queryByText("hive.hr.users")).toBeNull(); // table без ALPHA
  });

  it("kind=policy pii-mask — list catalog + table", () => {
    render(<MetadataObjectsPane kind="policy" name="pii-mask" world={WORLD} onUnlink={vi.fn()} />);
    expect(screen.getByText("hive")).toBeTruthy();
    expect(screen.getByText("hive.hr.users")).toBeTruthy();
    expect(screen.queryByText("hive.hr")).toBeNull();
  });

  it("Unlink-кнопка вызывает onUnlink({entityType, entity, kind, name})", () => {
    const onUnlink = vi.fn();
    render(<MetadataObjectsPane kind="tag" name="ALPHA" world={WORLD} onUnlink={onUnlink} />);
    const unlinks = screen.getAllByRole("button", { name: /unlink/i });
    fireEvent.click(unlinks[0]);
    expect(onUnlink).toHaveBeenCalledWith(expect.objectContaining({ kind: "tag", name: "ALPHA" }));
  });

  it("empty (нет ассоциаций) → empty state", () => {
    render(<MetadataObjectsPane kind="tag" name="GHOST" world={WORLD} onUnlink={vi.fn()} />);
    expect(screen.getByText(/нет.*объект|no.*object/i)).toBeTruthy();
  });
});
