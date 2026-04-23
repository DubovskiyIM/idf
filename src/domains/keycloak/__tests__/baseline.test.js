// Stage 1 + 2 baseline smoke. Цель — ловить ломку host-facade'а
// до dev-server'а. Stage 2 после dedup проверяет что *Representation
// мерджнуты в short names (Realm/Client/User), fieldRole-hint
// применяется к secret/datetime/email-полям, custom roles задекларированы.
import { describe, it, expect } from "vitest";
import { crystallizeV2, deriveProjections } from "@intent-driven/core";
import { ONTOLOGY, INTENTS, ROOT_PROJECTIONS, PROJECTIONS } from "../domain.js";

describe("keycloak Stage 1+2 baseline", () => {
  it("Stage 2 dedup: canonical entities под коротким именем (Realm, не RealmRepresentation)", () => {
    expect(ONTOLOGY.entities.Realm).toBeDefined();
    expect(ONTOLOGY.entities.Client).toBeDefined();
    expect(ONTOLOGY.entities.User).toBeDefined();
    expect(ONTOLOGY.entities.Group).toBeDefined();
    expect(ONTOLOGY.entities.Role).toBeDefined();
    expect(ONTOLOGY.entities.IdentityProvider).toBeDefined();
    // *Representation удалены через mergeRepresentationDuplicates
    expect(ONTOLOGY.entities.RealmRepresentation).toBeUndefined();
    expect(ONTOLOGY.entities.ClientRepresentation).toBeUndefined();
  });

  it("Stage 2 dedup: fields из *Representation перенесены в short name", () => {
    expect(Object.keys(ONTOLOGY.entities.Realm.fields).length).toBeGreaterThan(100);
    expect(Object.keys(ONTOLOGY.entities.Client.fields).length).toBeGreaterThan(40);
    expect(Object.keys(ONTOLOGY.entities.User.fields).length).toBeGreaterThan(20);
  });

  it("Stage 2 fieldRole hints применены: secret/datetime/email", () => {
    expect(ONTOLOGY.entities.Client.fields.secret?.fieldRole).toBe("secret");
    expect(ONTOLOGY.entities.Client.fields.registrationAccessToken?.fieldRole).toBe("secret");
    expect(ONTOLOGY.entities.User.fields.email?.fieldRole).toBe("email");
    expect(ONTOLOGY.entities.Realm.fields.notBefore?.fieldRole).toBe("datetime");
    // lifespan-числа НЕ помечены как secret (false-positive guard)
    expect(ONTOLOGY.entities.Realm.fields.refreshTokenMaxReuse?.fieldRole).toBeUndefined();
  });

  it("Stage 2 roles: 5 base ролей вместо дефолтного owner", () => {
    expect(ONTOLOGY.roles.admin?.base).toBe("admin");
    expect(ONTOLOGY.roles.realmAdmin?.base).toBe("owner");
    expect(ONTOLOGY.roles.userMgr?.base).toBe("owner");
    expect(ONTOLOGY.roles.viewer?.base).toBe("viewer");
    expect(ONTOLOGY.roles.self?.base).toBe("owner");
  });

  it("Stage 2 embedded: 75 orphan entities помечены kind:embedded", () => {
    const embedded = Object.values(ONTOLOGY.entities).filter(e => e.kind === "embedded").length;
    expect(embedded).toBeGreaterThan(50);
  });

  it("counts: 199 entities (224-25 dedup), >100 intents", () => {
    expect(Object.keys(ONTOLOGY.entities).length).toBe(199);
    expect(Object.keys(INTENTS).length).toBeGreaterThan(100);
  });

  it("Stage 2 param-aliasing: realm → realmId присутствует", () => {
    const params = INTENTS.readRealm.parameters;
    expect(params.realm).toBeDefined();
    expect(params.realmId).toBeDefined();
    expect(params.realmId.aliasOf).toBe("realm");
  });

  it("ROOT_PROJECTIONS — минимум 5 catalog/dashboard, derived из intents", () => {
    expect(Array.isArray(ROOT_PROJECTIONS)).toBe(true);
    expect(ROOT_PROJECTIONS.length).toBeGreaterThanOrEqual(5);
  });

  it("crystallizeV2 не падает после Stage 2 enrichment", () => {
    const derived = deriveProjections(INTENTS, ONTOLOGY);
    const merged = { ...derived };
    for (const [id, authored] of Object.entries(PROJECTIONS)) {
      merged[id] = merged[id] ? { ...merged[id], ...authored } : authored;
    }
    expect(() => crystallizeV2(INTENTS, merged, ONTOLOGY, "keycloak")).not.toThrow();
    const artifacts = crystallizeV2(INTENTS, merged, ONTOLOGY, "keycloak");
    expect(Object.keys(artifacts).length).toBeGreaterThan(5);
  });
});
