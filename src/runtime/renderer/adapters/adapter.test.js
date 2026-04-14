import { describe, it, expect, beforeEach } from "vitest";
import { registerUIAdapter, getAdaptedComponent, getCapability, supportsVariant } from "./registry.js";
import { mantineAdapter } from "./mantine/index.jsx";
import { antdAdapter } from "./antd/index.jsx";

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

describe("capability surface (§26.4 / §26.6)", () => {
  it("Mantine: primitive.chart объявлена с chartTypes", () => {
    registerUIAdapter(mantineAdapter);
    const cap = getCapability("primitive", "chart");
    expect(cap).toBeDefined();
    expect(cap.chartTypes).toContain("line");
    expect(cap.chartTypes).toContain("pie");
  });

  it("Mantine: statistic объявлена как false — явно не поддерживается", () => {
    registerUIAdapter(mantineAdapter);
    expect(getCapability("primitive", "statistic")).toBe(false);
  });

  it("AntD: candlestick не в chartTypes (не поддерживается)", () => {
    registerUIAdapter(antdAdapter);
    const supported = supportsVariant("primitive", "chart", "chartTypes", "candlestick");
    expect(supported).toBe(false);
  });

  it("AntD: line chartType поддерживается", () => {
    registerUIAdapter(antdAdapter);
    expect(supportsVariant("primitive", "chart", "chartTypes", "line")).toBe(true);
  });

  it("supportsVariant возвращает true для unknown capability (backcompat)", () => {
    registerUIAdapter({ name: "minimal", primitive: { text: () => null } });
    // Нет capabilities → assume supported (не ломаем existing адаптеры)
    expect(supportsVariant("primitive", "text", "variants", "anything")).toBe(true);
  });

  it("supportsVariant с capability=true возвращает true", () => {
    registerUIAdapter(antdAdapter);
    expect(supportsVariant("shell", "modal", "whatever", "x")).toBe(true);
  });

  it("getCapability возвращает null если адаптер не зарегистрирован", () => {
    registerUIAdapter(null);
    expect(getCapability("primitive", "chart")).toBeNull();
  });
});
