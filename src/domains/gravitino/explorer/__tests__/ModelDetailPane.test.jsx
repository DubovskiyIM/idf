// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ModelDetailPane from "../ModelDetailPane.jsx";

afterEach(cleanup);

const MODEL = {
  id: "model_price", name: "price_optimizer", comment: "Pricing optimizer",
  latestVersion: 7,
  properties: { framework: "lightgbm", "team": "ml-prod" },
  schemaId: "s_ml",
};
const VERSIONS = [
  { id: "mv_price_v7", version: 7, modelObject: "mlflow://models/price/7", aliases: ["production", "champion"], properties: { rmse: "0.142" }, modelId: "model_price" },
  { id: "mv_price_v6", version: 6, modelObject: "mlflow://models/price/6", aliases: ["candidate"],              properties: {},                  modelId: "model_price" },
];

describe("ModelDetailPane", () => {
  it("header показывает model name + comment + latestVersion", () => {
    render(<ModelDetailPane model={MODEL} world={{ model_versions: VERSIONS }} onLinkVersion={vi.fn()} />);
    expect(screen.getAllByText("price_optimizer").length).toBeGreaterThan(0);
    expect(screen.getByText(/Pricing optimizer/)).toBeTruthy();
    expect(screen.getAllByText(/v7|version.*7|latest.*7/i).length).toBeGreaterThan(0);
  });

  it("Versions tab default — таблица versions", () => {
    render(<ModelDetailPane model={MODEL} world={{ model_versions: VERSIONS }} onLinkVersion={vi.fn()} />);
    expect(screen.getByRole("tab", { name: /versions/i })).toBeTruthy();
    expect(screen.getByText("mlflow://models/price/7")).toBeTruthy();
    expect(screen.getByText("production")).toBeTruthy();
  });

  it("кнопка Link Version вызывает onLinkVersion", () => {
    const onLinkVersion = vi.fn();
    render(<ModelDetailPane model={MODEL} world={{ model_versions: VERSIONS }} onLinkVersion={onLinkVersion} />);
    fireEvent.click(screen.getByRole("button", { name: /link.*version/i }));
    expect(onLinkVersion).toHaveBeenCalled();
  });

  it("Properties tab показывает key-value", () => {
    render(<ModelDetailPane model={MODEL} world={{ model_versions: VERSIONS }} onLinkVersion={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /properties/i }));
    expect(screen.getByText("framework")).toBeTruthy();
    expect(screen.getByText("lightgbm")).toBeTruthy();
  });

  it("model без versions → empty state", () => {
    render(<ModelDetailPane model={MODEL} world={{ model_versions: [] }} onLinkVersion={vi.fn()} />);
    expect(screen.getByText(/нет версий|no versions/i)).toBeTruthy();
  });
});
