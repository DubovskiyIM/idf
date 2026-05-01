// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import FilesetDetailPane from "../FilesetDetailPane.jsx";

afterEach(cleanup);

const FS = {
  id: "f1", name: "raw_landing", type: "EXTERNAL",
  storageLocation: "s3://prod-landing",
  comment: "External vendor feeds",
  properties: { format: "parquet" },
};
const FILES = [
  { id: "ff1", filesetId: "f1", path: "vendor_a/orders.parquet", size: 12_485_730, modifiedAt: "2026-04-30T14:22:01Z" },
  { id: "ff2", filesetId: "f1", path: "vendor_b/clicks.json",   size: 88_341_204, modifiedAt: "2026-04-30T13:15:44Z" },
  { id: "ff3", filesetId: "other", path: "skip.txt", size: 100, modifiedAt: "2026-04-30T13:15:44Z" },
];

describe("FilesetDetailPane", () => {
  it("header показывает name + storageLocation", () => {
    render(<FilesetDetailPane fileset={FS} world={{ fileset_files: FILES }} />);
    expect(screen.getAllByText("raw_landing").length).toBeGreaterThan(0);
    expect(screen.getByText(/s3:\/\/prod-landing/)).toBeTruthy();
  });

  it("Files tab — таблица только filesetId-matching файлов", () => {
    render(<FilesetDetailPane fileset={FS} world={{ fileset_files: FILES }} />);
    expect(screen.getByText("vendor_a/orders.parquet")).toBeTruthy();
    expect(screen.getByText("vendor_b/clicks.json")).toBeTruthy();
    expect(screen.queryByText("skip.txt")).toBeNull();
  });

  it("size форматируется human-readable (KB/MB/GB)", () => {
    render(<FilesetDetailPane fileset={FS} world={{ fileset_files: FILES }} />);
    // 12_485_730 bytes ≈ 11.9 MB
    expect(screen.getByText(/1[12]\.\d MB/)).toBeTruthy();
  });

  it("Properties tab показывает key-value", () => {
    render(<FilesetDetailPane fileset={FS} world={{ fileset_files: FILES }} />);
    fireEvent.click(screen.getByRole("tab", { name: /properties/i }));
    expect(screen.getByText("format")).toBeTruthy();
    expect(screen.getByText("parquet")).toBeTruthy();
  });

  it("fileset без файлов → empty state", () => {
    render(<FilesetDetailPane fileset={{ ...FS, id: "empty" }} world={{ fileset_files: [] }} />);
    expect(screen.getByText(/нет файлов|no files/i)).toBeTruthy();
  });
});
