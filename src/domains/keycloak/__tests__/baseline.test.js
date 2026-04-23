// Stage 1 baseline smoke — domain парсится, derive отрабатывает,
// crystallize не падает. Цель — поймать синтаксические/импорт-ошибки
// до того как dev server запустится.
import { describe, it, expect } from "vitest";
import { crystallizeV2, deriveProjections } from "@intent-driven/core";
import { ONTOLOGY, INTENTS, ROOT_PROJECTIONS, PROJECTIONS } from "../domain.js";

describe("keycloak Stage 1 baseline", () => {
  it("импортирует canonical entity-types из Keycloak Admin REST", () => {
    expect(ONTOLOGY.entities.RealmRepresentation).toBeDefined();
    expect(ONTOLOGY.entities.ClientRepresentation).toBeDefined();
    expect(ONTOLOGY.entities.UserRepresentation).toBeDefined();
    expect(ONTOLOGY.entities.GroupRepresentation).toBeDefined();
    expect(ONTOLOGY.entities.RoleRepresentation).toBeDefined();
    expect(ONTOLOGY.entities.IdentityProviderRepresentation).toBeDefined();
  });

  it("содержит >100 entities и >100 intents (большой spec — Keycloak)", () => {
    expect(Object.keys(ONTOLOGY.entities).length).toBeGreaterThan(100);
    expect(Object.keys(INTENTS).length).toBeGreaterThan(100);
  });

  it("ROOT_PROJECTIONS — минимум 5 catalog/dashboard, derived из intents", () => {
    expect(Array.isArray(ROOT_PROJECTIONS)).toBe(true);
    expect(ROOT_PROJECTIONS.length).toBeGreaterThanOrEqual(5);
  });

  it("crystallizeV2 не падает на голом Stage 1 (PROJECTIONS={})", () => {
    const derived = deriveProjections(INTENTS, ONTOLOGY);
    const merged = { ...derived };
    for (const [id, authored] of Object.entries(PROJECTIONS)) {
      merged[id] = merged[id] ? { ...merged[id], ...authored } : authored;
    }
    expect(() => crystallizeV2(INTENTS, merged, ONTOLOGY, "keycloak")).not.toThrow();
    const artifacts = crystallizeV2(INTENTS, merged, ONTOLOGY, "keycloak");
    expect(typeof artifacts).toBe("object");
    expect(Object.keys(artifacts).length).toBeGreaterThan(5);
  });
});
