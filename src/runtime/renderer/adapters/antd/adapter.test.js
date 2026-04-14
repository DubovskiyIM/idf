import { describe, it, expect, beforeEach } from "vitest";
import { registerUIAdapter, getAdaptedComponent } from "../registry.js";
import { antdAdapter } from "./index.jsx";

describe("AntD UI adapter", () => {
  beforeEach(() => {
    registerUIAdapter(antdAdapter);
  });

  it("registers with name 'antd'", () => {
    expect(antdAdapter.name).toBe("antd");
  });

  it("covers all parameter types (contract parity with mantine/shadcn)", () => {
    for (const type of ["text", "textarea", "email", "url", "tel", "number", "datetime", "select"]) {
      const Comp = getAdaptedComponent("parameter", type);
      expect(Comp, `parameter/${type}`).toBeTruthy();
      expect(typeof Comp).toBe("function");
    }
  });

  it("covers all button types", () => {
    for (const type of ["primary", "secondary", "danger", "intent", "overflow"]) {
      const Comp = getAdaptedComponent("button", type);
      expect(Comp, `button/${type}`).toBeTruthy();
    }
  });

  it("covers shell modal + tabs", () => {
    expect(getAdaptedComponent("shell", "modal")).toBeTruthy();
    expect(getAdaptedComponent("shell", "tabs")).toBeTruthy();
  });

  it("covers all primitives including statistic and chart (new kinds)", () => {
    for (const type of ["heading", "text", "badge", "avatar", "paper", "statistic", "chart", "sparkline"]) {
      const Comp = getAdaptedComponent("primitive", type);
      expect(Comp, `primitive/${type}`).toBeTruthy();
    }
  });

  it("exposes icon.resolve as function", () => {
    expect(typeof antdAdapter.icon.resolve).toBe("function");
    // Known mapping
    expect(antdAdapter.icon.resolve("✎")).toBeTruthy();
    // Unknown falls through
    expect(antdAdapter.icon.resolve("__nonexistent__")).toBeNull();
  });

  it("returns null for unknown kind/type", () => {
    expect(getAdaptedComponent("parameter", "nonexistent")).toBeNull();
    expect(getAdaptedComponent("unknown", "anything")).toBeNull();
  });
});
