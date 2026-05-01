// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CreateTagDialog from "../CreateTagDialog.jsx";

afterEach(cleanup);

describe("CreateTagDialog", () => {
  it("не рендерится visible=false", () => {
    render(<CreateTagDialog visible={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/create tag/i)).toBeNull();
  });

  it("рендерит Name + Comment + Color + Properties", () => {
    render(<CreateTagDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText(/must start with a letter|alphanumeric/i)).toBeTruthy();
    expect(screen.getByText(/comment/i)).toBeTruthy();
    expect(screen.getByText(/color/i)).toBeTruthy();
    expect(screen.getByText(/properties/i)).toBeTruthy();
  });

  it("Submit disabled пока name пуст", () => {
    render(<CreateTagDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^submit$/i }).disabled).toBe(true);
  });

  it("полный submit отдаёт {name, comment, color, properties}", () => {
    const onSubmit = vi.fn();
    render(<CreateTagDialog visible={true} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText(/must start/i), { target: { value: "ALPHA" } });
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "ALPHA", color: expect.stringMatching(/^#/) }));
  });

  it("+ Add Property добавляет пустую строку K/V", () => {
    render(<CreateTagDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const before = screen.getAllByPlaceholderText(/^key$/i).length;
    fireEvent.click(screen.getByRole("button", { name: /add property/i }));
    const after = screen.getAllByPlaceholderText(/^key$/i).length;
    expect(after).toBe(before + 1);
  });
});
