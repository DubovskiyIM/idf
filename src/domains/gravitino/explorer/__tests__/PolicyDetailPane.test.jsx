// @vitest-environment jsdom
import { afterEach, describe, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import PolicyDetailPane from "../PolicyDetailPane.jsx";

afterEach(cleanup);

const POLICY_MASK = {
  id: "p1", name: "pii-mask", policyType: "data_masking", enabled: true,
  comment: "Mask PII columns at read",
  content: { columns: ["email", "ssn", "phone"], algorithm: "format-preserving" },
  inherited: false,
  properties: { team: "compliance" },
};
const POLICY_RETENTION = {
  id: "p2", name: "retention-365d", policyType: "data_lifecycle", enabled: true,
  comment: "Delete after 365 days",
  content: { days: 365, action: "hard_delete" },
  inherited: false,
  properties: {},
};

describe("PolicyDetailPane", () => {
  it("header показывает name + policyType + enabled-badge", () => {
    render(<PolicyDetailPane policy={POLICY_MASK} />);
    expect(screen.getAllByText("pii-mask").length).toBeGreaterThan(0);
    expect(screen.getByText(/data_masking|masking/i)).toBeTruthy();
    expect(screen.getByText(/enabled|active/i)).toBeTruthy();
  });

  it("disabled policy → красный/grey indicator", () => {
    render(<PolicyDetailPane policy={{ ...POLICY_MASK, enabled: false }} />);
    expect(screen.getByText(/disabled|inactive/i)).toBeTruthy();
  });

  it("Rules tab default — показывает структурированный content + JSON", () => {
    render(<PolicyDetailPane policy={POLICY_MASK} />);
    expect(screen.getByRole("tab", { name: /rules/i })).toBeTruthy();
    // Human-readable chips для data_masking — текст может быть и в chip, и в JSON.
    expect(screen.getAllByText(/email/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/format-preserving/).length).toBeGreaterThan(0);
    // JSON block тоже виден
    expect(screen.getAllByText(/columns/i).length).toBeGreaterThan(0);
  });

  it("data_lifecycle policy показывает days + action", () => {
    render(<PolicyDetailPane policy={POLICY_RETENTION} />);
    expect(screen.getAllByText(/365/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/hard_delete/).length).toBeGreaterThan(0);
  });

  it("Properties tab показывает key-value", () => {
    render(<PolicyDetailPane policy={POLICY_MASK} />);
    fireEvent.click(screen.getByRole("tab", { name: /properties/i }));
    expect(screen.getByText("team")).toBeTruthy();
    expect(screen.getByText("compliance")).toBeTruthy();
  });

  it("policy с пустым content → empty state в Rules tab", () => {
    render(<PolicyDetailPane policy={{ id: "p0", name: "empty", policyType: "custom", enabled: true, content: {} }} />);
    expect(screen.getByText(/нет правил|no rules/i)).toBeTruthy();
  });
});
