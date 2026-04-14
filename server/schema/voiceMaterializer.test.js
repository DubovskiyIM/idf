import { describe, it, expect } from "vitest";
import { materializeAsVoice, renderVoiceSsml, renderVoicePlain } from "./voiceMaterializer.cjs";

const viewer = { id: "u1", name: "Анна", email: "anna@example.com" };

const portfolios = [
  { id: "pf1", userId: "u1", name: "Основной",  baseCurrency: "RUB", totalValue: 2_500_000, pnl: 187_000 },
  { id: "pf2", userId: "u1", name: "ИИС",       baseCurrency: "RUB", totalValue: 310_000,   pnl: -8_000 },
  { id: "pf3", userId: "u1", name: "Growth",    baseCurrency: "USD", totalValue: 78_000,    pnl: 12_400 },
  { id: "pf4", userId: "u1", name: "Дополнит.", baseCurrency: "RUB", totalValue: 50_000,    pnl: 1_000 },
  { id: "pf5", userId: "other", name: "Чужой",  baseCurrency: "USD", totalValue: 999,       pnl: 0 },
];

const transactions = [
  { id: "t1", portfolioId: "pf1", message: "Купил 100 SBER", timestamp: 1700000000000 },
  { id: "t2", portfolioId: "pf1", message: "Продал 50 GAZP", timestamp: 1700000001000 },
];

const world = { portfolios, transactions };

// ───────────────────────────────────────────────────────────
describe("materializeAsVoice — catalog", () => {
  const proj = {
    id: "my_portfolios", kind: "catalog", mainEntity: "Portfolio",
    name: "Мои портфели",
    witnesses: ["name", "baseCurrency", "totalValue", "pnl"],
    filter: "userId === 'u1'",
  };

  it("возвращает script с meta + turns", () => {
    const script = materializeAsVoice(proj, world, viewer, { domain: "invest" });
    expect(script.title).toBe("Мои портфели");
    expect(script.meta.materialization).toBe("voice");
    expect(script.meta.locale).toBe("ru-RU");
    expect(script.turns.length).toBeGreaterThan(0);
    // Первый turn — system prompt
    expect(script.turns[0].role).toBe("system");
  });

  it("озвучивает количество элементов и top-3", () => {
    const script = materializeAsVoice(proj, world, viewer, {});
    const assistant = script.turns.find(t => t.role === "assistant");
    expect(assistant.text).toContain("4 элемента");
    expect(assistant.text).toContain("Основной");
    expect(assistant.text).toContain("первый");
    expect(assistant.text).toContain("второй");
    expect(assistant.text).toContain("третий");
  });

  it("обрезает до TOP_ITEMS и упоминает остаток", () => {
    const script = materializeAsVoice(proj, world, viewer, {});
    const assistant = script.turns.find(t => t.role === "assistant");
    // 4 свои → top 3, ещё 1
    expect(assistant.text).toContain("И ещё 1");
  });

  it("money-поля произносятся human-friendly (2 keyFacts на item)", () => {
    const script = materializeAsVoice(proj, world, viewer, {});
    const text = script.turns.find(t => t.role === "assistant").text;
    // catalog brevity: name + 2 keyFacts (baseCurrency, totalValue)
    expect(text).toMatch(/2.5 миллионов рублей/);
    expect(text).toMatch(/310 тысяч рублей/);
  });

  it("detail озвучивает pnl при расширенном witness slice", () => {
    const detailProj = {
      id: "pf_detail", kind: "detail", mainEntity: "Portfolio",
      idParam: "portfolioId", name: "Портфель",
      witnesses: ["name", "baseCurrency", "totalValue", "pnl"],
    };
    const script = materializeAsVoice(detailProj, world, viewer, {
      routeParams: { portfolioId: "pf1" },
    });
    const text = script.turns.find(t => t.role === "assistant").text;
    // detail берёт witnesses.slice(0,4), pnl попадает
    expect(text).toMatch(/187 тысяч рублей/);
  });

  it("пустой mainEntity → 'пока ничего нет'", () => {
    const script = materializeAsVoice(proj, { portfolios: [] }, viewer, {});
    const text = script.turns.find(t => t.role === "assistant").text;
    expect(text).toContain("пока ничего нет");
  });
});

// ───────────────────────────────────────────────────────────
describe("materializeAsVoice — detail", () => {
  const proj = {
    id: "portfolio_detail", kind: "detail", mainEntity: "Portfolio",
    idParam: "portfolioId", name: "Портфель",
    witnesses: ["name", "baseCurrency", "totalValue", "pnl"],
    subCollections: [
      { collection: "transactions", entity: "Transaction", foreignKey: "portfolioId" },
    ],
  };

  it("озвучивает title + facts + sub-collection упоминание", () => {
    const script = materializeAsVoice(proj, world, viewer, {
      routeParams: { portfolioId: "pf1" },
    });
    const text = script.turns.find(t => t.role === "assistant").text;
    expect(text).toContain("Основной");
    expect(text).toContain("RUB");
    expect(text).toContain("стоимость: 2.5 миллионов рублей");
    expect(text).toContain("одна секция");
  });

  it("несуществующий id → 'не найдена'", () => {
    const script = materializeAsVoice(proj, world, viewer, {
      routeParams: { portfolioId: "xxx" },
    });
    const text = script.turns.find(t => t.role === "assistant").text;
    expect(text).toContain("не найдена");
  });
});

// ───────────────────────────────────────────────────────────
describe("materializeAsVoice — feed", () => {
  const proj = {
    id: "tx_feed", kind: "feed", mainEntity: "Transaction",
    name: "Лента сделок",
  };

  it("озвучивает количество + summary first items", () => {
    const script = materializeAsVoice(proj, world, viewer, {});
    const text = script.turns.find(t => t.role === "assistant").text;
    expect(text).toContain("2 элемента");
    expect(text).toMatch(/Купил|Продал/);
  });
});

// ───────────────────────────────────────────────────────────
describe("materializeAsVoice — wizard", () => {
  const proj = {
    id: "risk", kind: "wizard", name: "Опросник риска",
    steps: [
      { id: "horizon", label: "Горизонт" },
      { id: "tolerance", label: "Толерантность" },
      { id: "confirm", label: "Подтверждение", summary: true },
    ],
  };

  it("озвучивает первый шаг + system note про session", () => {
    const script = materializeAsVoice(proj, world, viewer, {});
    const assistant = script.turns.find(t => t.role === "assistant");
    expect(assistant.text).toContain("Шаг 1 из 3");
    expect(assistant.text).toContain("Горизонт");
    const sys = script.turns.filter(t => t.role === "system");
    expect(sys.length).toBeGreaterThan(1); // initial + wizard hint
  });
});

// ───────────────────────────────────────────────────────────
describe("intent prompts", () => {
  it("извлекает prompts из ontology.roles[role].canExecute", () => {
    const proj = { id: "p", kind: "catalog", mainEntity: "Portfolio", name: "Test", witnesses: [] };
    const ontology = {
      roles: { owner: { canExecute: ["buy_asset", "sell_asset"] } },
      intents: {
        buy_asset:  { name: "Купить актив",  particles: { effects: [{}] } },
        sell_asset: { name: "Продать актив", particles: { effects: [{}] } },
      },
    };
    const script = materializeAsVoice(proj, world, viewer, { ontology, viewerRole: "owner" });
    const prompts = script.turns.find(t => t.role === "prompts");
    expect(prompts).toBeDefined();
    expect(prompts.items).toHaveLength(2);
    expect(prompts.items[0].text).toBe("Купить актив");
    expect(prompts.items[0].confirmation).toBe("enter");
  });

  it("ограничивает до 5 prompts (brevity)", () => {
    const proj = { id: "p", kind: "catalog", mainEntity: "Portfolio", name: "T", witnesses: [] };
    const ontology = {
      roles: { owner: { canExecute: Array.from({ length: 10 }, (_, i) => `intent_${i}`) } },
    };
    const script = materializeAsVoice(proj, world, viewer, { ontology, viewerRole: "owner" });
    const prompts = script.turns.find(t => t.role === "prompts");
    expect(prompts.items.length).toBeLessThanOrEqual(5);
  });
});

// ───────────────────────────────────────────────────────────
describe("renderVoiceSsml", () => {
  it("возвращает валидный SSML с <speak> + <prosody>", () => {
    const script = materializeAsVoice(
      { id: "p", kind: "catalog", mainEntity: "Portfolio", name: "T",
        witnesses: ["name"], filter: "userId === 'u1'" },
      world, viewer, {}
    );
    const ssml = renderVoiceSsml(script);
    expect(ssml).toMatch(/^<\?xml/);
    expect(ssml).toContain("<speak");
    expect(ssml).toContain('xml:lang="ru-RU"');
    expect(ssml).toContain("<prosody");
    expect(ssml).toContain("<break");
  });

  it("escape XML", () => {
    const dangerWorld = { portfolios: [{ id: "x", userId: "u1", name: "<script>alert(1)</script>" }] };
    const script = materializeAsVoice(
      { id: "p", kind: "catalog", mainEntity: "Portfolio", name: "T",
        witnesses: ["name"], filter: "userId === 'u1'" },
      dangerWorld, viewer, {}
    );
    const ssml = renderVoiceSsml(script);
    expect(ssml).not.toContain("<script>alert");
    expect(ssml).toContain("&lt;script&gt;");
  });
});

// ───────────────────────────────────────────────────────────
describe("renderVoicePlain", () => {
  it("возвращает читаемый текст с ролями turn'ов", () => {
    const script = materializeAsVoice(
      { id: "p", kind: "catalog", mainEntity: "Portfolio", name: "Портфели",
        witnesses: ["name"], filter: "userId === 'u1'" },
      world, viewer, { domain: "invest" }
    );
    const plain = renderVoicePlain(script);
    expect(plain).toContain("# Портфели");
    expect(plain).toContain("[voice");
    expect(plain).toContain("[system]");
    expect(plain).toContain("[assistant]");
  });

  it("rendering prompts с маркерами", () => {
    const ontology = {
      roles: { owner: { canExecute: ["buy_asset"] } },
      intents: { buy_asset: { name: "Купить", particles: { effects: [{}] } } },
    };
    const script = materializeAsVoice(
      { id: "p", kind: "catalog", mainEntity: "Portfolio", name: "T",
        witnesses: ["name"], filter: "userId === 'u1'" },
      world, viewer, { ontology, viewerRole: "owner" }
    );
    const plain = renderVoicePlain(script);
    expect(plain).toContain("[пользователь может сказать:]");
    expect(plain).toContain("— Купить");
  });
});
