/**
 * salience-fit-weights.test.mjs
 *
 * Unit-тесты для pairwiseLoss и fitWeightsCoordDescent.
 * Toy-кейс из плана: 2 пары, после fit tier3Promotion > creatorMain.
 */

import { describe, it, expect } from "vitest";
import { pairwiseLoss, fitWeightsCoordDescent } from "./salience-fit-weights.mjs";

describe("pairwiseLoss", () => {
  it("возвращает 0 если winner явно лидирует", () => {
    const features = {
      A: { tier3Promotion: 1, creatorMain: 0 },
      B: { tier3Promotion: 0, creatorMain: 1 },
    };
    const weights = { tier3Promotion: 100, creatorMain: 10 };
    const pairs = [{ winner: "A", losers: ["B"] }];
    const loss = pairwiseLoss({ features, pairs, weights });
    // score(A)=100, score(B)=10, margin=1 => max(0, 1-(100-10)) = 0
    expect(loss).toBe(0);
  });

  it("возвращает margin если winner равен loser", () => {
    const features = {
      A: { tier3Promotion: 1 },
      B: { tier3Promotion: 1 },
    };
    const weights = { tier3Promotion: 50 };
    const pairs = [{ winner: "A", losers: ["B"] }];
    const loss = pairwiseLoss({ features, pairs, weights, margin: 1 });
    // score(A)=50, score(B)=50, max(0, 1-0) = 1
    expect(loss).toBe(1);
  });

  it("суммирует по нескольким losers", () => {
    const features = {
      A: { x: 1 },
      B: { x: 0 },
      C: { x: 0 },
    };
    const weights = { x: 100 };
    const pairs = [{ winner: "A", losers: ["B", "C"] }];
    const loss = pairwiseLoss({ features, pairs, weights });
    // A=100, B=0, C=0 => margin violations: 0+0 = 0
    expect(loss).toBe(0);
  });

  it("учитывает L2 регуляризацию", () => {
    const features = { A: { x: 1 }, B: { x: 0 } };
    const weights = { x: 10 };
    const pairs = [{ winner: "A", losers: ["B"] }];
    const lossNoReg = pairwiseLoss({ features, pairs, weights, lambda: 0 });
    const lossWithReg = pairwiseLoss({ features, pairs, weights, lambda: 0.1 });
    // L2 добавляет 0.1 * 10^2 = 10
    expect(lossWithReg).toBeCloseTo(lossNoReg + 0.1 * 10 * 10);
  });

  it("пропускает winner/loser с отсутствующими features", () => {
    const features = { A: { x: 1 } };
    const pairs = [{ winner: "A", losers: ["B_MISSING"] }];
    const weights = { x: 10 };
    // B отсутствует — пара пропускается, loss = 0
    const loss = pairwiseLoss({ features, pairs, weights });
    expect(loss).toBe(0);
  });
});

describe("fitWeightsCoordDescent", () => {
  it("подбирает веса чтобы tier3Promotion > creatorMain", () => {
    // Toy-кейс из плана: A(tier3) > B(creator), A(tier3) > C(creator)
    const features = {
      A: { tier3Promotion: 1, creatorMain: 0 },
      B: { tier3Promotion: 0, creatorMain: 1 },
      C: { tier3Promotion: 0, creatorMain: 1 },
    };
    const pairs = [{ winner: "A", losers: ["B", "C"] }];
    const initial = { tier3Promotion: 50, creatorMain: 50 };
    const fitted = fitWeightsCoordDescent({ features, pairs, initial });
    expect(fitted.tier3Promotion).toBeGreaterThan(fitted.creatorMain);
  });

  it("loss после fit <= loss до fit", () => {
    const features = {
      confirm: { tier3Promotion: 1, creatorMain: 0 },
      create:  { tier3Promotion: 0, creatorMain: 1 },
    };
    const pairs = [{ winner: "confirm", losers: ["create"] }];
    const initial = { tier3Promotion: 50, creatorMain: 50 };
    const startLoss = pairwiseLoss({ features, pairs, weights: initial });
    const fitted = fitWeightsCoordDescent({ features, pairs, initial });
    const finalLoss = pairwiseLoss({ features, pairs, weights: fitted });
    expect(finalLoss).toBeLessThanOrEqual(startLoss);
  });

  it("корректно обрабатывает уже разделённые пары (loss=0 сразу)", () => {
    const features = {
      A: { edit: 1, remove: 0 },
      B: { edit: 0, remove: 1 },
    };
    const pairs = [{ winner: "A", losers: ["B"] }];
    const initial = { edit: 90, remove: 10 };
    // Уже разделены: score(A)=90 >> score(B)=10
    const fitted = fitWeightsCoordDescent({ features, pairs, initial });
    const loss = pairwiseLoss({ features, pairs, weights: fitted });
    expect(loss).toBe(0);
  });

  it("L2 регуляризация не ломает сходимость", () => {
    const features = {
      confirm: { tier3Promotion: 1 },
      remove:  { removeMain: 1 },
    };
    const pairs = [{ winner: "confirm", losers: ["remove"] }];
    const initial = { tier3Promotion: 50, removeMain: 50 };
    const fitted = fitWeightsCoordDescent({ features, pairs, initial, lambda: 0.01 });
    // tier3 должен быть выше removeMain после fit
    expect(fitted.tier3Promotion).toBeGreaterThanOrEqual(fitted.removeMain);
  });

  it("возвращает копию весов (не мутирует initial)", () => {
    const features = {
      A: { x: 1 },
      B: { x: 0 },
    };
    const pairs = [{ winner: "A", losers: ["B"] }];
    const initial = { x: 50 };
    const initialCopy = { ...initial };
    fitWeightsCoordDescent({ features, pairs, initial });
    expect(initial).toEqual(initialCopy);
  });
});
