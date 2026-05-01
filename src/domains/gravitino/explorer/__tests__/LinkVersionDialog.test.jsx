// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import LinkVersionDialog from "../LinkVersionDialog.jsx";

afterEach(cleanup);

describe("LinkVersionDialog", () => {
  it("не рендерится когда visible=false", () => {
    render(<LinkVersionDialog visible={false} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.queryByText(/link.*version/i)).toBeNull();
  });

  it("рендерится с полями version + modelObject + aliases", () => {
    render(<LinkVersionDialog visible={true} suggestedVersion={5} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByLabelText(/^version$/i)).toBeTruthy();
    expect(screen.getByLabelText(/model.*object|uri/i)).toBeTruthy();
    expect(screen.getByLabelText(/aliases/i)).toBeTruthy();
  });

  it("suggestedVersion как default value", () => {
    render(<LinkVersionDialog visible={true} suggestedVersion={8} onClose={vi.fn()} onSubmit={vi.fn()} />);
    const versionInput = screen.getByLabelText(/^version$/i);
    expect(versionInput.value).toBe("8");
  });

  it("Cancel вызывает onClose без onSubmit", () => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();
    render(<LinkVersionDialog visible={true} onClose={onClose} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /cancel|отмена/i }));
    expect(onClose).toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submit без modelObject — onSubmit не вызывается", () => {
    const onSubmit = vi.fn();
    render(<LinkVersionDialog visible={true} suggestedVersion={5} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.click(screen.getByRole("button", { name: /link|создать/i }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("полный submit отдаёт {version, modelObject, aliases}", () => {
    const onSubmit = vi.fn();
    render(<LinkVersionDialog visible={true} suggestedVersion={5} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/model.*object|uri/i), { target: { value: "s3://models/test/v5.pkl" } });
    fireEvent.change(screen.getByLabelText(/aliases/i), { target: { value: "staging,candidate" } });
    fireEvent.click(screen.getByRole("button", { name: /link/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      version: 5,
      modelObject: "s3://models/test/v5.pkl",
      aliases: ["staging", "candidate"],
    });
  });
});
