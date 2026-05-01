// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import RunJobDialog from "../RunJobDialog.jsx";
afterEach(cleanup);
const TEMPLATES = [
  { id: "jt1", name: "builtin-iceberg-rewrite-data-files", description: "Iceberg rewrite", config: { kind: "spark" } },
  { id: "jt2", name: "builtin-sparkpi", description: "SparkPi", config: { kind: "spark" } },
];
describe("RunJobDialog", () => {
  it("не рендерится visible=false", () => {
    render(<RunJobDialog visible={false} templates={TEMPLATES} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByText(/template name/i)).toBeNull();
  });
  it("рендерит select с templates", () => {
    render(<RunJobDialog visible={true} templates={TEMPLATES} onSubmit={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByText(/template name/i)).toBeTruthy();
    const options = screen.getAllByRole("option");
    expect(options.some(o => o.textContent.includes("builtin-iceberg-rewrite-data-files"))).toBe(true);
  });
  it("Submit отдаёт {templateId}", () => {
    const onSubmit = vi.fn();
    render(<RunJobDialog visible={true} templates={TEMPLATES} onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ templateId: "jt1" }));
  });
});
