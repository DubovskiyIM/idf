import { describe, it, expect, beforeAll } from "vitest";
const express = require("express");
const request = require("supertest");
const studioRouter = require("./studio.js");

let app;
beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use("/api/studio", studioRouter);
});

describe("GET /api/studio/domains", () => {
  it("returns list of domains with counts", async () => {
    const res = await request(app).get("/api/studio/domains");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.domains)).toBe(true);
    const booking = res.body.domains.find((d) => d.name === "booking");
    expect(booking).toBeDefined();
    expect(booking.intents).toBeGreaterThan(0);
    expect(booking.entities).toBeGreaterThan(0);
  });
});

describe("GET /api/studio/domain/:name/graph", () => {
  it("returns full graph", async () => {
    const res = await request(app).get("/api/studio/domain/booking/graph");
    expect(res.status).toBe(200);
    expect(res.body.nodes.length).toBeGreaterThan(0);
    expect(res.body.edges.length).toBeGreaterThan(0);
  });

  it("returns 404 for unknown domain", async () => {
    const res = await request(app).get("/api/studio/domain/nonexistent/graph");
    expect(res.status).toBe(404);
  });

  it("includes pattern nodes for matched patterns in domain", async () => {
    const res = await request(app).get("/api/studio/domain/sales/graph");
    expect(res.status).toBe(200);
    const patternNodes = res.body.nodes.filter(n => n.kind === "pattern");
    expect(patternNodes.length).toBeGreaterThan(0);
    expect(patternNodes.some(n => n.patternId === "subcollections")).toBe(true);
    const appliesTo = res.body.edges.filter(e => e.kind === "applies-to");
    expect(appliesTo.length).toBeGreaterThan(0);
  });
});
