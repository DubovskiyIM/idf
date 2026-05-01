// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CreateCatalogDialog from "../CreateCatalogDialog.jsx";

afterEach(cleanup);

describe("CreateCatalogDialog", () => {
  it("не рендерится когда visible=false", () => {
    render(<CreateCatalogDialog visible={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/create catalog/i)).toBeNull();
  });

  it("рендерится когда visible=true с базовыми полями", () => {
    render(<CreateCatalogDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/^name$/i)).toBeTruthy();
    expect(screen.getByLabelText(/comment/i)).toBeTruthy();
    expect(screen.getByLabelText(/type/i)).toBeTruthy();
  });

  it("выбор type=relational + provider=hive показывает hive-specific поля", () => {
    render(<CreateCatalogDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: "relational" } });
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: "hive" } });
    expect(screen.getByLabelText(/metastore uri/i)).toBeTruthy();
    expect(screen.getByLabelText(/warehouse dir/i)).toBeTruthy();
  });

  it("смена provider на jdbc-postgresql переключает поля", () => {
    render(<CreateCatalogDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: "relational" } });
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: "jdbc-postgresql" } });
    expect(screen.getByLabelText(/jdbc url/i)).toBeTruthy();
    expect(screen.getByLabelText(/^user$/i)).toBeTruthy();
    expect(screen.queryByLabelText(/metastore uri/i)).toBeNull();
  });

  it("Cancel вызывает onClose без onSubmit", () => {
    const onClose = vi.fn();
    const onSubmit = vi.fn();
    render(<CreateCatalogDialog visible={true} onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel|отмена/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submit без обязательных полей — onSubmit не вызывается", () => {
    const onSubmit = vi.fn();
    render(<CreateCatalogDialog visible={true} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /create|создать/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("полный submit отдаёт shape {type, provider, name, comment, properties}", () => {
    const onSubmit = vi.fn();
    render(<CreateCatalogDialog visible={true} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "test_catalog" } });
    fireEvent.change(screen.getByLabelText(/comment/i), { target: { value: "test" } });
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: "fileset" } });
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: "hadoop" } });
    fireEvent.change(screen.getByLabelText(/location/i), { target: { value: "s3://test-bucket" } });
    fireEvent.click(screen.getByRole("button", { name: /create|создать/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      type: "fileset",
      provider: "hadoop",
      name: "test_catalog",
      comment: "test",
      properties: { location: "s3://test-bucket" },
    });
  });

  it("Test Connection кнопка появляется после выбора provider (C4)", () => {
    render(<CreateCatalogDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /test connection/i })).toBeNull();
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: "relational" } });
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: "hive" } });
    expect(screen.getByRole("button", { name: /test connection/i })).toBeTruthy();
  });

  it("Test Connection с валидным URI → success message (async, C4)", async () => {
    render(<CreateCatalogDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: "relational" } });
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: "hive" } });
    fireEvent.change(screen.getByLabelText(/metastore uri/i), { target: { value: "thrift://hms.prod:9083" } });
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    await new Promise(r => setTimeout(r, 800));
    expect(screen.getByText(/connection.*ok|✓/i)).toBeTruthy();
  });

  it("Test Connection с невалидным URI → failure message (C4)", async () => {
    render(<CreateCatalogDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/type/i), { target: { value: "relational" } });
    fireEvent.change(screen.getByLabelText(/provider/i), { target: { value: "hive" } });
    fireEvent.change(screen.getByLabelText(/metastore uri/i), { target: { value: "garbage" } });
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    await new Promise(r => setTimeout(r, 800));
    expect(screen.getByText(/failed|invalid|✗/i)).toBeTruthy();
  });
});
