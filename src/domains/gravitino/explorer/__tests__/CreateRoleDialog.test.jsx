// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import CreateRoleDialog from "../CreateRoleDialog.jsx";

afterEach(cleanup);

describe("CreateRoleDialog", () => {
  it("рендерит Securable Object accordion + privileges", () => {
    render(<CreateRoleDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(screen.getByText(/securable object/i)).toBeTruthy();
    expect(screen.getByText(/^Type$/i)).toBeTruthy();
    expect(screen.getByText(/full name/i)).toBeTruthy();
  });

  it("change Type → privileges list обновляется", () => {
    render(<CreateRoleDialog visible={true} onClose={vi.fn()} onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/^type$/i), { target: { value: "schema" } });
    fireEvent.click(screen.getByPlaceholderText(/add allow privileges/i));
    expect(screen.getByText(/use schema/i)).toBeTruthy();
  });

  it("полный submit отдаёт {name, securableObjects}", () => {
    const onSubmit = vi.fn();
    render(<CreateRoleDialog visible={true} onClose={vi.fn()} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText(/role name/i), { target: { value: "data_engineer" } });
    fireEvent.change(screen.getByLabelText(/^type$/i), { target: { value: "schema" } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: "sales" } });
    fireEvent.click(screen.getByPlaceholderText(/add allow privileges/i));
    fireEvent.click(screen.getByRole("checkbox", { name: /use schema/i }));
    fireEvent.click(screen.getByRole("button", { name: /^submit$/i }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      name: "data_engineer",
      securableObjects: expect.arrayContaining([expect.objectContaining({ type: "schema", name: "sales" })]),
    }));
  });
});
