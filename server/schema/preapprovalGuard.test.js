import { describe, it, expect } from "vitest";
import { checkPreapproval } from "./preapprovalGuard.cjs";

// Фикстура: ontology с preapproval config и world с preapproval instance.
const baseOntology = {
  entities: {
    AgentPreapproval: { ownerField: "userId" },
    Transaction: { ownerField: "userId" },
  },
  roles: {
    agent: {
      preapproval: {
        entity: "AgentPreapproval",
        ownerField: "userId",
        requiredFor: ["agent_execute_preapproved_order"],
        checks: [
          { kind: "active", field: "active" },
          { kind: "notExpired", field: "expiresAt" },
          { kind: "maxAmount", paramField: "total", limitField: "maxOrderAmount" },
          { kind: "csvInclude", paramField: "assetType", limitField: "allowedAssetTypes" },
          { kind: "csvInclude", paramField: "portfolioId", limitField: "allowedPortfolioIds", allowEmpty: true },
          { kind: "dailySum",
            paramField: "total", limitField: "dailyLimit",
            sumCollection: "transactions", sumField: "total",
            sumOwnerField: "userId", sumTimestampField: "timestamp",
            sumFilter: { field: "initiatedBy", equals: "agent" } },
        ],
      },
    },
  },
};

const viewer = { id: "user_1" };
const futureMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
const pastMs = Date.now() - 1000;

function makeWorld(preapproval, transactions = []) {
  return {
    agentpreapprovals: preapproval ? [preapproval] : [],
    transactions,
  };
}

const validPreapproval = {
  id: "pa_1", userId: "user_1", active: true,
  maxOrderAmount: 100_000,
  allowedAssetTypes: "stock,bond,etf",
  allowedPortfolioIds: "pf_1,pf_2",
  dailyLimit: 500_000,
  expiresAt: futureMs,
};

describe("checkPreapproval", () => {
  it("intent не в requiredFor → ok без проверок", () => {
    const result = checkPreapproval("agent_propose_rebalance", {}, viewer, baseOntology, makeWorld(null));
    expect(result.ok).toBe(true);
  });

  it("нет ontology.preapproval → ok (no-op)", () => {
    const result = checkPreapproval("agent_execute_preapproved_order", {}, viewer,
      { entities: {}, roles: { agent: {} } }, makeWorld(null));
    expect(result.ok).toBe(true);
  });

  it("нет preapproval-объекта у user → no_preapproval", () => {
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 1000, assetType: "stock", portfolioId: "pf_1" },
      viewer, baseOntology, makeWorld(null));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_preapproval");
  });

  it("валидный preapproval + валидные params → ok", () => {
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 10_000, assetType: "stock", portfolioId: "pf_1" },
      viewer, baseOntology, makeWorld(validPreapproval));
    expect(result.ok).toBe(true);
    expect(result.preapprovalId).toBe("pa_1");
  });

  it("active === false → check_failed inactive", () => {
    const pa = { ...validPreapproval, active: false };
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 10_000, assetType: "stock", portfolioId: "pf_1" },
      viewer, baseOntology, makeWorld(pa));
    expect(result.ok).toBe(false);
    expect(result.failedCheck).toBe("active");
  });

  it("expiresAt в прошлом → check_failed notExpired", () => {
    const pa = { ...validPreapproval, expiresAt: pastMs };
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 10_000, assetType: "stock", portfolioId: "pf_1" },
      viewer, baseOntology, makeWorld(pa));
    expect(result.ok).toBe(false);
    expect(result.failedCheck).toBe("notExpired");
  });

  it("expiresAt отсутствует → бессрочно, ok", () => {
    const pa = { ...validPreapproval, expiresAt: null };
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 10_000, assetType: "stock", portfolioId: "pf_1" },
      viewer, baseOntology, makeWorld(pa));
    expect(result.ok).toBe(true);
  });

  it("total > maxOrderAmount → check_failed maxAmount", () => {
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 999_999, assetType: "stock", portfolioId: "pf_1" },
      viewer, baseOntology, makeWorld(validPreapproval));
    expect(result.ok).toBe(false);
    expect(result.failedCheck).toBe("maxAmount");
    expect(result.details.value).toBe(999_999);
    expect(result.details.limit).toBe(100_000);
  });

  it("assetType не в allowedAssetTypes CSV → check_failed not_in_scope", () => {
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 10_000, assetType: "crypto", portfolioId: "pf_1" },
      viewer, baseOntology, makeWorld(validPreapproval));
    expect(result.ok).toBe(false);
    expect(result.failedCheck).toBe("csvInclude");
    expect(result.details.allowed).toEqual(["stock", "bond", "etf"]);
  });

  it("portfolioId не в allowedPortfolioIds → check_failed", () => {
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 10_000, assetType: "stock", portfolioId: "pf_unknown" },
      viewer, baseOntology, makeWorld(validPreapproval));
    expect(result.ok).toBe(false);
    expect(result.failedCheck).toBe("csvInclude");
  });

  it("allowedPortfolioIds пустой + allowEmpty=true → любой portfolioId проходит", () => {
    const pa = { ...validPreapproval, allowedPortfolioIds: "" };
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 10_000, assetType: "stock", portfolioId: "pf_anything" },
      viewer, baseOntology, makeWorld(pa));
    expect(result.ok).toBe(true);
  });

  it("дневной лимит не нарушен → ok", () => {
    const now = Date.now();
    const txs = [
      { id: "tx1", userId: "user_1", total: 50_000, initiatedBy: "agent", timestamp: now - 60_000 },
      { id: "tx2", userId: "user_1", total: 30_000, initiatedBy: "user",  timestamp: now - 60_000 }, // user, не считается
    ];
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 100_000, assetType: "stock", portfolioId: "pf_1" },
      viewer, baseOntology, makeWorld(validPreapproval, txs));
    // 50k (agent) + 100k < 500k → ok
    expect(result.ok).toBe(true);
  });

  it("дневной лимит превышен → check_failed daily_limit_exceeded", () => {
    // Используем preapproval с low daily limit, но high single-max,
    // чтобы одиночная сумма прошла maxAmount, но серия превысила daily.
    const pa = { ...validPreapproval, dailyLimit: 150_000, maxOrderAmount: 100_000 };
    const now = Date.now();
    const txs = [
      { id: "tx1", userId: "user_1", total: 80_000, initiatedBy: "agent", timestamp: now - 60_000 },
    ];
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 90_000, assetType: "stock", portfolioId: "pf_1" },
      viewer, baseOntology, makeWorld(pa, txs));
    // 80k + 90k = 170k > 150k → fail на dailySum (90k < maxOrderAmount 100k, не на max)
    expect(result.ok).toBe(false);
    expect(result.failedCheck).toBe("dailySum");
    expect(result.details.projected).toBe(170_000);
    expect(result.details.limit).toBe(150_000);
  });

  it("вчерашние сделки не считаются в дневной лимит", () => {
    const yesterday = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const txs = [
      { id: "tx_old", userId: "user_1", total: 450_000, initiatedBy: "agent", timestamp: yesterday },
    ];
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 100_000, assetType: "stock", portfolioId: "pf_1" },
      viewer, baseOntology, makeWorld(validPreapproval, txs));
    // вчерашние 450k не учитываются → 0 + 100k < 500k → ok
    expect(result.ok).toBe(true);
  });

  it("user-initiated transactions не идут в дневной счётчик agent'а", () => {
    // dailyLimit ослаблен так, чтобы пропустить один agent-order, если
    // user-сделки не учитываются (иначе они бы его «съели»).
    const pa = { ...validPreapproval, dailyLimit: 100_000, maxOrderAmount: 100_000 };
    const now = Date.now();
    const txs = [
      { id: "tx_u", userId: "user_1", total: 400_000, initiatedBy: "user", timestamp: now },
      { id: "tx_a", userId: "user_1", total: 30_000,  initiatedBy: "agent", timestamp: now },
    ];
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 50_000, assetType: "stock", portfolioId: "pf_1" },
      viewer, baseOntology, makeWorld(pa, txs));
    // только tx_a (30k) + 50k = 80k < 100k → ok
    // если бы user-tx считалась: 400+30+50=480k > 100k → fail
    expect(result.ok).toBe(true);
  });

  it("чужой preapproval не применим (owner-изоляция)", () => {
    const otherPa = { ...validPreapproval, id: "pa_other", userId: "user_other" };
    const result = checkPreapproval("agent_execute_preapproved_order",
      { total: 10_000, assetType: "stock", portfolioId: "pf_1" },
      viewer, baseOntology, makeWorld(otherPa));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_preapproval");
  });
});
