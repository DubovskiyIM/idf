// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import EmptyState from "../EmptyState.jsx";

afterEach(cleanup);

describe("EmptyState", () => {
  it("рендерит icon + title + description", () => {
    render(<EmptyState icon="files" title="Нет файлов" description="Этот fileset пуст" />);
    expect(screen.getByText("Нет файлов")).toBeTruthy();
    expect(screen.getByText("Этот fileset пуст")).toBeTruthy();
    expect(screen.getByLabelText(/empty.*files|empty.*illustration/i)).toBeTruthy();
  });

  it("опциональная action-кнопка вызывает onAction", () => {
    const onAction = vi.fn();
    render(<EmptyState icon="catalogs" title="Нет catalogs" actionLabel="+ Create Catalog" onAction={onAction} />);
    fireEvent.click(screen.getByRole("button", { name: /create catalog/i }));
    expect(onAction).toHaveBeenCalled();
  });

  it("неизвестный icon — fallback (no crash)", () => {
    render(<EmptyState icon="weird" title="x" />);
    expect(screen.getByText("x")).toBeTruthy();
  });
});
