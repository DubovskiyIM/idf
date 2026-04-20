import { describe, it, expect, beforeAll } from "vitest";
const express = require("express");
const request = require("supertest");
const { makePatternsRouter } = require("./patterns.js");

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use("/api/patterns", makePatternsRouter());
});

describe("GET /api/patterns/catalog", () => {
  it("returns all stable patterns with hasApply flag", async () => {
    const res = await request(app).get("/api/patterns/catalog");
    expect(res.status).toBe(200);

    expect(Array.isArray(res.body.stable)).toBe(true);
    expect(Array.isArray(res.body.candidate)).toBe(true);
    expect(Array.isArray(res.body.anti)).toBe(true);

    // v1.8: минимум 13 stable паттернов
    expect(res.body.stable.length).toBeGreaterThanOrEqual(13);

    const byId = Object.fromEntries(res.body.stable.map((p) => [p.id, p]));

    // subcollections — один из немногих, где structure.apply реализован
    expect(byId.subcollections).toBeDefined();
    expect(byId.subcollections.hasApply).toBe(true);

    // hero-create — apply ещё не написан
    expect(byId["hero-create"]).toBeDefined();
    expect(byId["hero-create"].hasApply).toBe(false);
  });

  it("includes trigger, structure, rationale, falsification fields", async () => {
    const res = await request(app).get("/api/patterns/catalog");
    expect(res.status).toBe(200);

    const p = res.body.stable[0];
    expect(p.id).toBeDefined();
    expect(p.version).toBeDefined();
    expect(p.status).toBe("stable");
    expect(p.archetype).toBeDefined();

    expect(p.trigger).toBeDefined();
    expect(Array.isArray(p.trigger.requires)).toBe(true);
    // match сериализуется как строка (function.toString) либо null
    expect(p.trigger).toHaveProperty("matchSource");

    expect(p.structure).toBeDefined();
    expect(p.structure.slot).toBeDefined();
    expect(p.structure).toHaveProperty("description");

    expect(p.rationale).toBeDefined();
    expect(p.rationale.hypothesis).toBeDefined();

    expect(p.falsification).toBeDefined();
    expect(Array.isArray(p.falsification.shouldMatch)).toBe(true);
    expect(Array.isArray(p.falsification.shouldNotMatch)).toBe(true);

    expect(typeof p.hasApply).toBe("boolean");
    expect(p).toHaveProperty("applySource");
  });
});

describe("GET /api/patterns/falsification", () => {
  it("runs falsification for subcollections on live domains", async () => {
    const res = await request(app).get("/api/patterns/falsification?id=subcollections");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.shouldMatch)).toBe(true);
    expect(Array.isArray(res.body.shouldNotMatch)).toBe(true);
    expect(Array.isArray(res.body.regressions)).toBe(true);

    // planning/poll_overview — задекларированный shouldMatch: TimeOption.pollId + Participant.pollId
    const pollOverview = res.body.shouldMatch.find(e => e.projection === "poll_overview");
    expect(pollOverview).toBeDefined();
    expect(pollOverview.domain).toBe("planning");
    expect(pollOverview.expected).toBe(true);
    expect(pollOverview.actual).toBe(true);
    expect(Array.isArray(pollOverview.requirements)).toBe(true);
  });

  it("returns 404 for unknown pattern", async () => {
    const res = await request(app).get("/api/patterns/falsification?id=nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("GET /api/patterns/explain", () => {
  it("returns explainMatch result for domain+projection", async () => {
    const res = await request(app).get(
      "/api/patterns/explain?domain=invest&projection=portfolio_detail",
    );
    expect(res.status).toBe(200);

    expect(res.body.archetype).toBe("detail");

    // subcollections должен быть в matched — Portfolio с Position.portfolioId + Transaction.portfolioId
    expect(res.body.structural).toBeDefined();
    expect(Array.isArray(res.body.structural.matched)).toBe(true);
    const matchedIds = res.body.structural.matched.map(m => m.pattern.id);
    expect(matchedIds).toContain("subcollections");

    // hasApply annotation: сервер аннотирует каждую matched-запись,
    // потому что JSON.stringify роняет function-ключи (structure.apply).
    // subcollections — единственный stable-паттерн с реализованным apply.
    const sub = res.body.structural.matched.find(m => m.pattern.id === "subcollections");
    expect(sub.pattern.hasApply).toBe(true);
    for (const m of res.body.structural.matched) {
      expect(typeof m.pattern.hasApply).toBe("boolean");
    }

    // witnesses непустые — matched порождают записи witnesses
    expect(Array.isArray(res.body.witnesses)).toBe(true);
    expect(res.body.witnesses.length).toBeGreaterThan(0);
  });

  it("includes nearMiss when includeNearMiss=1", async () => {
    const res = await request(app).get(
      "/api/patterns/explain?domain=invest&projection=portfolio_detail&includeNearMiss=1",
    );
    expect(res.status).toBe(200);
    expect(res.body.structural).toBeDefined();
    expect(Array.isArray(res.body.structural.nearMiss)).toBe(true);
  });

  it("returns artifactAfter when previewPatternId set", async () => {
    const res = await request(app).get(
      "/api/patterns/explain?domain=invest&projection=portfolio_detail&previewPatternId=subcollections",
    );
    expect(res.status).toBe(200);
    expect(res.body.artifactAfter).toBeDefined();
    expect(res.body.artifactAfter).not.toBeNull();
    expect(res.body.previewPatternId).toBe("subcollections");
  });

  it("includes slotAttribution map in response", async () => {
    const res = await request(app).get(
      "/api/patterns/explain?domain=sales&projection=order_detail",
    );
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("slotAttribution");
    expect(typeof res.body.slotAttribution).toBe("object");
    // sales/order_detail имеет subcollections, добавляющие sections
    // (Order + связанные Bid/Message/Dispute с FK на Order).
    // invest/portfolio_detail тоже matched, но sections авторизованы вручную —
    // attribution пуста для subcollections в этом случае by design.
    const subEntry = Object.entries(res.body.slotAttribution).find(
      ([, v]) => v.patternId === "subcollections",
    );
    expect(subEntry).toBeDefined();
  });
});

describe("GET /api/patterns/projections", () => {
  it("returns projection ids for a known domain", async () => {
    const res = await request(app).get("/api/patterns/projections?domain=invest");
    expect(res.status).toBe(200);
    expect(res.body.domain).toBe("invest");
    expect(Array.isArray(res.body.projections)).toBe(true);
    // у invest >1 проекции; portfolio_detail — известная
    expect(res.body.projections.length).toBeGreaterThan(0);
    expect(res.body.projections).toContain("portfolio_detail");
  });

  it("returns 400 when domain missing", async () => {
    const res = await request(app).get("/api/patterns/projections");
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown domain", async () => {
    const res = await request(app).get("/api/patterns/projections?domain=nope_not_a_domain");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/patterns/preference", () => {
  it("returns 403 in production", async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      const res = await request(app)
        .post("/api/patterns/preference")
        .send({ domain: "x", projection: "y", patternId: "z", action: "enable" });
      expect(res.status).toBe(403);
    } finally {
      process.env.NODE_ENV = prev;
    }
  });

  it("returns 400 when fields missing", async () => {
    const res = await request(app).post("/api/patterns/preference").send({});
    expect(res.status).toBe(400);
  });
});
