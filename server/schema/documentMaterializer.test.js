import { describe, it, expect } from "vitest";
import { materializeAsDocument, renderDocumentHtml } from "./documentMaterializer.cjs";

const viewer = { id: "u1", name: "Анна", email: "anna@example.com" };

const portfolios = [
  { id: "pf1", userId: "u1", name: "Основной", baseCurrency: "RUB", totalValue: 100_000, pnl: 5000 },
  { id: "pf2", userId: "u1", name: "ИИС",       baseCurrency: "RUB", totalValue: 50_000,  pnl: -1000 },
  { id: "pf3", userId: "other", name: "Чужой",  baseCurrency: "USD", totalValue: 999,     pnl: 0 },
];

const transactions = [
  { id: "t1", portfolioId: "pf1", userId: "u1", α: "buy",  quantity: 10, price: 100, total: 1000, timestamp: Date.now() },
  { id: "t2", portfolioId: "pf1", userId: "u1", α: "sell", quantity: 5,  price: 110, total: 550,  timestamp: Date.now() },
];

const world = { portfolios, transactions };

// ───────────────────────────────────────────────────────────
describe("materializeAsDocument — catalog", () => {
  const catalogProj = {
    id: "my_portfolios",
    kind: "catalog",
    mainEntity: "Portfolio",
    name: "Мои портфели",
    witnesses: ["name", "baseCurrency", "totalValue", "pnl"],
    filter: "userId === 'u1'",
  };

  it("возвращает document с title/meta/sections", () => {
    const doc = materializeAsDocument(catalogProj, world, viewer, { domain: "invest" });
    expect(doc.title).toBe("Мои портфели");
    expect(doc.meta.viewer).toBe("Анна");
    expect(doc.meta.domain).toBe("invest");
    expect(doc.meta.materialization).toBe("document");
    expect(doc.sections).toHaveLength(1);
  });

  it("таблица содержит все witnesses как колонки", () => {
    const doc = materializeAsDocument(catalogProj, world, viewer, {});
    const table = doc.sections[0];
    expect(table.kind).toBe("table");
    const colIds = table.columns.map(c => c.id);
    expect(colIds).toEqual(["name", "baseCurrency", "totalValue", "pnl"]);
  });

  it("применяет filter проекции — чужие портфели исключены", () => {
    const doc = materializeAsDocument(catalogProj, world, viewer, {});
    const rows = doc.sections[0].rows;
    expect(rows).toHaveLength(2);
    const names = rows.map(r => r.cells.name);
    expect(names).toEqual(["Основной", "ИИС"]);
  });

  it("humanizes money-like fields с ₽", () => {
    const doc = materializeAsDocument(catalogProj, world, viewer, {});
    const row = doc.sections[0].rows[0];
    // normalize unicode spaces (Node.js toLocaleString uses U+202F/U+00A0)
    expect(row.cells.totalValue.replace(/\s/g, " ")).toBe("100 000 ₽");
    expect(row.cells.pnl.replace(/\s/g, " ")).toBe("5 000 ₽");
  });

  it("пустой mainEntity → таблица с 0 rows", () => {
    const doc = materializeAsDocument(catalogProj, { portfolios: [] }, viewer, {});
    expect(doc.sections[0].rows).toEqual([]);
    expect(doc.sections[0].rowCount).toBe(0);
  });
});

// ───────────────────────────────────────────────────────────
describe("materializeAsDocument — detail", () => {
  const detailProj = {
    id: "portfolio_detail",
    kind: "detail",
    mainEntity: "Portfolio",
    idParam: "portfolioId",
    name: "Портфель",
    witnesses: ["name", "baseCurrency", "totalValue"],
    subCollections: [
      { collection: "transactions", entity: "Transaction", foreignKey: "portfolioId", title: "Сделки" },
    ],
  };

  it("main-section + sub-collection section", () => {
    const doc = materializeAsDocument(detailProj, world, viewer, {
      routeParams: { portfolioId: "pf1" },
    });
    expect(doc.sections.length).toBeGreaterThanOrEqual(2);
    expect(doc.sections[0].heading).toBe("Портфель");
    expect(doc.sections[1].heading).toBe("Сделки");
  });

  it("main-section — key-value таблица с witnesses", () => {
    const doc = materializeAsDocument(detailProj, world, viewer, {
      routeParams: { portfolioId: "pf1" },
    });
    const mainRows = doc.sections[0].rows;
    expect(mainRows.map(r => r.cells.field)).toEqual(["Name", "Base Currency", "Total Value"]);
    expect(mainRows[0].cells.value).toBe("Основной");
  });

  it("sub-collection только foreignKey-matched rows", () => {
    const doc = materializeAsDocument(detailProj, world, viewer, {
      routeParams: { portfolioId: "pf1" },
    });
    const txSection = doc.sections.find(s => s.heading === "Сделки");
    expect(txSection.rowCount).toBe(2); // обе транзакции pf1
  });

  it("несуществующий id → not_found paragraph", () => {
    const doc = materializeAsDocument(detailProj, world, viewer, {
      routeParams: { portfolioId: "nope" },
    });
    expect(doc.sections[0].id).toBe("not_found");
    expect(doc.sections[0].kind).toBe("paragraph");
  });
});

// ───────────────────────────────────────────────────────────
describe("materializeAsDocument — dashboard", () => {
  const embeddedProj = {
    id: "portfolios_root",
    kind: "catalog",
    mainEntity: "Portfolio",
    name: "Портфели",
    witnesses: ["name", "totalValue"],
    filter: "userId === 'u1'",
  };
  const dashboardProj = {
    id: "dash",
    kind: "dashboard",
    name: "Обзор",
    embedded: [{ projection: "portfolios_root" }],
  };

  it("dashboard раскладывается в секции из embedded проекций", () => {
    const doc = materializeAsDocument(dashboardProj, world, viewer, {
      allProjections: { portfolios_root: embeddedProj },
    });
    expect(doc.sections).toHaveLength(1);
    expect(doc.sections[0].kind).toBe("table");
    expect(doc.sections[0].rowCount).toBe(2);
  });
});

// ───────────────────────────────────────────────────────────
describe("materializeAsDocument — другие архетипы", () => {
  it("canvas → paragraph-placeholder", () => {
    const doc = materializeAsDocument(
      { id: "c", kind: "canvas", canvasType: "pie", name: "Canvas" },
      world, viewer, {}
    );
    expect(doc.sections[0].kind).toBe("paragraph");
    expect(doc.sections[0].content).toContain("pie");
  });

  it("wizard → not_supported paragraph", () => {
    const doc = materializeAsDocument(
      { id: "w", kind: "wizard", name: "Wizard" }, world, viewer, {}
    );
    expect(doc.sections[0].content.toLowerCase()).toContain("wizard");
    expect(doc.sections[0].kind).toBe("paragraph");
  });
});

// ───────────────────────────────────────────────────────────
describe("renderDocumentHtml", () => {
  it("возвращает валидный HTML с title в <title> и <h1>", () => {
    const doc = materializeAsDocument(
      { id: "c", kind: "catalog", mainEntity: "Portfolio",
        name: "Портфели", witnesses: ["name"], filter: "userId === 'u1'" },
      world, viewer, {}
    );
    const html = renderDocumentHtml(doc);
    expect(html).toMatch(/<!DOCTYPE html>/);
    expect(html).toContain("<title>Портфели</title>");
    expect(html).toContain("<h1>Портфели</h1>");
    expect(html).toContain("Основной");
  });

  it("escapes HTML в данных", () => {
    const maliciousWorld = {
      portfolios: [{ id: "evil", userId: "u1", name: "<script>alert(1)</script>", baseCurrency: "RUB", totalValue: 0, pnl: 0 }],
    };
    const doc = materializeAsDocument(
      { id: "c", kind: "catalog", mainEntity: "Portfolio",
        name: "Test", witnesses: ["name"], filter: "userId === 'u1'" },
      maliciousWorld, viewer, {}
    );
    const html = renderDocumentHtml(doc);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("empty-section рендерит 'Нет данных'", () => {
    const doc = materializeAsDocument(
      { id: "c", kind: "catalog", mainEntity: "Portfolio",
        name: "Empty", witnesses: ["name"], filter: "userId === 'xyz'" },
      world, viewer, {}
    );
    const html = renderDocumentHtml(doc);
    expect(html).toContain("Нет данных");
  });
});
