// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import RegisterJobTemplateDialog from "../RegisterJobTemplateDialog.jsx";
afterEach(cleanup);
describe("RegisterJobTemplateDialog", () => {
  it("Submit disabled пока не введён name + executable", () => {
    render(<RegisterJobTemplateDialog visible={true} onSubmit={vi.fn()} onClose={vi.fn()} />);
    const submitBtn = screen.getByRole("button", { name: /submit/i });
    expect(submitBtn.disabled).toBe(true);
  });
  it("полный submit отдаёт {name, executable, ...}", () => {
    const onSubmit = vi.fn();
    render(<RegisterJobTemplateDialog visible={true} onSubmit={onSubmit} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/my-spark-job/i), { target: { value: "my-job" } });
    fireEvent.change(screen.getByPlaceholderText(/my_script\.sh/i), { target: { value: "/path/x.sh" } });
    fireEvent.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "my-job" }));
  });
});
