import { describe, it, expect, beforeEach } from "vitest";
import { registerUIAdapter, getAdaptedComponent } from "./registry.js";
import { mantineAdapter } from "./mantine/index.jsx";

describe("UI adapter registry", () => {
  beforeEach(() => {
    registerUIAdapter(mantineAdapter);
  });

  it("registers Mantine adapter", () => {
    expect(mantineAdapter.name).toBe("mantine");
  });

  it("resolves parameter.datetime", () => {
    const Comp = getAdaptedComponent("parameter", "datetime");
    expect(Comp).toBeDefined();
    expect(typeof Comp).toBe("function");
  });

  it("resolves parameter.text", () => {
    const Comp = getAdaptedComponent("parameter", "text");
    expect(Comp).toBeDefined();
    expect(typeof Comp).toBe("function");
  });

  it("resolves button.intent", () => {
    const Comp = getAdaptedComponent("button", "intent");
    expect(Comp).toBeDefined();
    expect(typeof Comp).toBe("function");
  });

  it("resolves shell.modal", () => {
    const Comp = getAdaptedComponent("shell", "modal");
    expect(Comp).toBeDefined();
    expect(typeof Comp).toBe("function");
  });

  it("resolves shell.tabs", () => {
    const Comp = getAdaptedComponent("shell", "tabs");
    expect(Comp).toBeDefined();
    expect(typeof Comp).toBe("function");
  });

  it("returns null for unknown kind/type", () => {
    expect(getAdaptedComponent("parameter", "nonexistent")).toBeNull();
    expect(getAdaptedComponent("unknown", "anything")).toBeNull();
  });
});
