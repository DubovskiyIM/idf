// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import JobStatusBadge from "../JobStatusBadge.jsx";

afterEach(cleanup);

describe("JobStatusBadge", () => {
  it("success — зелёный с label Success", () => {
    render(<JobStatusBadge status="success" />);
    expect(screen.getByText(/success/i)).toBeTruthy();
  });

  it("failed — красный с label Failed", () => {
    render(<JobStatusBadge status="failed" />);
    expect(screen.getByText(/failed/i)).toBeTruthy();
  });

  it("running — синий", () => {
    render(<JobStatusBadge status="running" />);
    expect(screen.getByText(/running/i)).toBeTruthy();
  });

  it("queued — серый", () => {
    render(<JobStatusBadge status="queued" />);
    expect(screen.getByText(/queued/i)).toBeTruthy();
  });

  it("неизвестный status — fallback", () => {
    render(<JobStatusBadge status="weird" />);
    expect(screen.getByText(/weird/i)).toBeTruthy();
  });
});
