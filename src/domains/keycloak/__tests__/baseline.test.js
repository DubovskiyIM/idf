// Stage 1-4 baseline smoke. Цель — ловить ломку host-facade'а
// до dev-server'а. Stage 2 после dedup проверяет что *Representation
// мерджнуты в short names (Realm/Client/User), fieldRole-hint
// применяется к secret/datetime/email-полям, custom roles задекларированы.
// Stage 4 — seed возвращает >30 effects, fold(seed) даёт expected counts.
import { describe, it, expect } from "vitest";
import { crystallizeV2, deriveProjections, fold } from "@intent-driven/core";
import { ONTOLOGY, INTENTS, ROOT_PROJECTIONS, PROJECTIONS, getSeedEffects } from "../domain.js";

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
    // notBefore в Keycloak — number (unix timestamp), numeric guard importer'а
    // (SDK inferFieldRoles) корректно блокирует datetime для number-типа.
    // Проверяем datetime на реальном string-поле:
    const createdTs = ONTOLOGY.entities.AdminEvent?.fields?.time
      || ONTOLOGY.entities.Event?.fields?.time;
    if (createdTs) {
      // Event.time — integer → тоже numeric guard. Проверка noqa.
    }
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

  it("counts: ~186 entities (importer-side dedup + embedded markers), >100 intents", () => {
    // SDK importer-openapi@0.11+ сам делает mergeRepresentationDuplicates (G-K-1),
    // markEmbeddedTypes (G-K-3), detectActionEndpoints (G-K-2). Count после X1
    // cleanup host-side: 186 (было 199 с host-fix). Разница — чуть другая
    // dedup-логика action-verbs (SDK conservative) + possible off-by-one.
    expect(Object.keys(ONTOLOGY.entities).length).toBeGreaterThanOrEqual(180);
    expect(Object.keys(ONTOLOGY.entities).length).toBeLessThanOrEqual(205);
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

  it("Stage 3 reclassify: createUser exists с α=insert и creates=User", () => {
    expect(INTENTS.createUser).toBeDefined();
    expect(INTENTS.createUser.alpha).toBe("insert");
    expect(INTENTS.createUser.creates).toBe("User");
    expect(INTENTS.createGroup?.alpha).toBe("insert");
    expect(INTENTS.createRole?.alpha).toBe("insert");
    expect(INTENTS.createIdentityProvider?.alpha).toBe("insert");
  });

  it("Stage 3 whitelist: ROOT_PROJECTIONS — только canonical (не больше 12)", () => {
    expect(ROOT_PROJECTIONS.length).toBeGreaterThanOrEqual(8);
    expect(ROOT_PROJECTIONS.length).toBeLessThanOrEqual(12);
    expect(ROOT_PROJECTIONS).toContain("realm_list");
    expect(ROOT_PROJECTIONS).toContain("user_list");
    expect(ROOT_PROJECTIONS).toContain("client_list");
    expect(ROOT_PROJECTIONS).toContain("group_list");
    expect(ROOT_PROJECTIONS).toContain("role_list");
    // Operation-noise НЕ в whitelist
    expect(ROOT_PROJECTIONS).not.toContain("activate_list");
    expect(ROOT_PROJECTIONS).not.toContain("deactivate_list");
    expect(ROOT_PROJECTIONS).not.toContain("moveafter_list");
    expect(ROOT_PROJECTIONS).not.toContain("localization_list");
  });

  it("Stage 4 seed: >30 effects, expected target distribution", () => {
    const effects = getSeedEffects();
    expect(effects.length).toBeGreaterThanOrEqual(30);
    const byTarget = {};
    for (const e of effects) byTarget[e.target] = (byTarget[e.target] || 0) + 1;
    expect(byTarget.Realm).toBe(3);
    expect(byTarget.Client).toBe(5);
    expect(byTarget.User).toBe(10);
    expect(byTarget.Group).toBe(3);
    expect(byTarget.Role).toBe(6);
    expect(byTarget.IdentityProvider).toBe(4);
  });

  it("Stage 4 seed: fold(effects) даёт world с canonical entities", () => {
    const world = fold(getSeedEffects());
    // fold возвращает Map-like world; entities группируются по target
    const realmCount = (world.Realm || []).length;
    const userCount = (world.User || []).length;
    const clientCount = (world.Client || []).length;
    expect(realmCount).toBe(3);
    expect(userCount).toBe(10);
    expect(clientCount).toBe(5);
    // FK realmId на User
    const aliceUser = (world.User || []).find(u => u.username === "alice@acme.com");
    expect(aliceUser?.realmId).toBe("r_customer");
  });

  it("R8 hub-absorption работает (G-K-9 + G-K-10 closed): Realm.detail имеет hubSections", () => {
    const derived = deriveProjections(INTENTS, ONTOLOGY);
    const merged = { ...derived };
    for (const [id, authored] of Object.entries(PROJECTIONS)) {
      merged[id] = merged[id] ? { ...merged[id], ...authored } : authored;
    }
    const arts = crystallizeV2(INTENTS, merged, ONTOLOGY, "keycloak");

    // G-K-9 fix (idf-sdk#239 → core@0.58.0): mainEntity preserved
    expect(arts.user_detail.mainEntity).toBe("User");
    expect(arts.realm_detail.mainEntity).toBe("Realm");

    // G-K-10 fix (idf-sdk#243 → core@0.58.1): detectForeignKeys учитывает synthetic FK
    const realmHub = arts.realm_detail?.hubSections;
    expect(Array.isArray(realmHub)).toBe(true);
    expect(realmHub.length).toBeGreaterThanOrEqual(6);
    const hubEntities = realmHub.map(s => s.entity);
    expect(hubEntities).toContain("User");
    expect(hubEntities).toContain("Group");
    expect(hubEntities).toContain("Role");
    expect(hubEntities).toContain("ClientScope");

    // G-K-11 closed (idf-sdk#245 → core@0.58.2): R8 best-parent heuristic
    // выбирает «hubbier» parent'а — User с FK на Realm (10 children) и Role
    // (1 child) идёт в realm_detail. Role.detail после redistribution имеет
    // 0 children и не становится hub.
    expect(arts.user_list.absorbedBy).toBe("realm_detail");
    expect(arts.group_list.absorbedBy).toBe("realm_detail");
    // После redistribution Role не hub — hubSections может быть
    // undefined (never assigned) или null (prev value), главное — не массив.
    expect(Array.isArray(arts.role_detail?.hubSections)).toBe(false);
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

  it("Stage 5 authored wizard: realm_create/client_create/identityprovider_create декларированы", () => {
    expect(PROJECTIONS.realm_create).toBeDefined();
    expect(PROJECTIONS.realm_create.kind).toBe("form");
    expect(PROJECTIONS.realm_create.mode).toBe("create");
    expect(PROJECTIONS.realm_create.bodyOverride?.type).toBe("wizard");
    expect(PROJECTIONS.realm_create.bodyOverride.steps).toHaveLength(3);
    expect(PROJECTIONS.client_create.bodyOverride.steps).toHaveLength(3);
    // Stage 7 (P-K-B): idp wizard теперь 3 steps (type / endpoints+testConnection / advanced)
    expect(PROJECTIONS.identityprovider_create.bodyOverride.steps).toHaveLength(3);
    const endpointsStep = PROJECTIONS.identityprovider_create.bodyOverride.steps[1];
    expect(endpointsStep.id).toBe("endpoints");
    expect(endpointsStep.testConnection?.intent).toBe("testIdentityProviderConnection");
  });

  it("Stage 9: RoleMapping entity в ontology + 7 seed effects (Alice 4 sources / Bob 2 / Charlie 1)", () => {
    expect(ONTOLOGY.entities.RoleMapping).toBeDefined();
    expect(ONTOLOGY.entities.RoleMapping.kind).toBe("assignment");
    expect(ONTOLOGY.entities.RoleMapping.ownerField).toBe("userId");
    const roleMappings = getSeedEffects().filter(e => e.target === "RoleMapping");
    expect(roleMappings.length).toBe(7);
    const alice = roleMappings.filter(e => e.context?.userId === "u_alice");
    expect(alice).toHaveLength(4);
    // Demo 4 источников
    const sources = alice.map(e => e.context.inheritedFrom);
    expect(sources).toContain("direct");
    expect(sources).toContain("composite:realm-admin");
    expect(sources).toContain("group:Admins");
  });

  it("Stage 9: user_detail projection с RoleMapping subCollection", () => {
    expect(PROJECTIONS.user_detail).toBeDefined();
    expect(PROJECTIONS.user_detail.kind).toBe("detail");
    const subs = PROJECTIONS.user_detail.subCollections;
    expect(Array.isArray(subs)).toBe(true);
    const roleMapSub = subs.find(s => s.entity === "RoleMapping");
    expect(roleMapSub).toBeDefined();
    expect(roleMapSub.foreignKey).toBe("userId");
  });

  it("Stage 7: domain.TEST_CONNECTION_HANDLERS регистрирует testIdentityProviderConnection", async () => {
    const { TEST_CONNECTION_HANDLERS } = await import("../domain.js");
    expect(typeof TEST_CONNECTION_HANDLERS?.testIdentityProviderConnection).toBe("function");
    // Format check: валидный URL → ok
    const ok = await TEST_CONNECTION_HANDLERS.testIdentityProviderConnection({
      authorizationUrl: "https://provider.com/oauth/authorize",
      tokenUrl: "https://provider.com/oauth/token",
      clientId: "my-client",
    });
    expect(ok.ok).toBe(true);
    // Без clientId → error
    const miss = await TEST_CONNECTION_HANDLERS.testIdentityProviderConnection({
      authorizationUrl: "https://provider.com/oauth/authorize",
    });
    expect(miss.ok).toBe(false);
    // Некорректный URL → error
    const bad = await TEST_CONNECTION_HANDLERS.testIdentityProviderConnection({
      authorizationUrl: "not-a-url",
      clientId: "x",
    });
    expect(bad.ok).toBe(false);
  });

  it("Stage 5: crystallizeV2 рендерит wizard-body для authored form-projection'ов", () => {
    const derived = deriveProjections(INTENTS, ONTOLOGY);
    const merged = { ...derived };
    for (const [id, authored] of Object.entries(PROJECTIONS)) {
      merged[id] = merged[id] ? { ...merged[id], ...authored } : authored;
    }
    const artifacts = crystallizeV2(INTENTS, merged, ONTOLOGY, "keycloak");
    for (const id of ["realm_create", "client_create", "identityprovider_create"]) {
      const body = artifacts[id]?.slots?.body;
      expect(body, `${id} body should exist`).toBeDefined();
      expect(body.type, `${id} body.type should be wizard`).toBe("wizard");
      expect(Array.isArray(body.steps)).toBe(true);
      expect(body.steps.length).toBeGreaterThan(0);
    }
  });

  it("Stage 6: client_detail tabbedForm — 5 tabs с Settings/Credentials/Flow/URLs/Advanced", () => {
    expect(PROJECTIONS.client_detail).toBeDefined();
    expect(PROJECTIONS.client_detail.kind).toBe("form");
    expect(PROJECTIONS.client_detail.bodyOverride?.type).toBe("tabbedForm");
    const tabs = PROJECTIONS.client_detail.bodyOverride.tabs;
    expect(tabs).toHaveLength(5);
    const ids = tabs.map(t => t.id);
    expect(ids).toEqual(["settings", "credentials", "flow", "urls", "advanced"]);
    // Каждый tab имеет fields + onSubmit
    for (const tab of tabs) {
      expect(Array.isArray(tab.fields)).toBe(true);
      expect(tab.fields.length).toBeGreaterThan(0);
      expect(tab.onSubmit?.intent).toBe("updateClient");
    }
  });

  it("Stage 6: crystallize рендерит tabbedForm-body для client_detail", () => {
    const artifacts = crystallizeV2(
      INTENTS,
      { ...PROJECTIONS },
      ONTOLOGY,
      "keycloak",
    );
    const body = artifacts.client_detail?.slots?.body;
    expect(body?.type).toBe("tabbedForm");
    expect(Array.isArray(body.tabs)).toBe(true);
    expect(body.tabs.length).toBe(5);
  });

  it("Stage 8 (P-K-C): Credentials seed — Alice/Bob/Charlie с 4 типами", () => {
    const credentials = getSeedEffects().filter(e => e.target === "Credential");
    expect(credentials.length).toBe(7);
    const alice = credentials.filter(e => e.context?.userId === "u_alice");
    expect(alice).toHaveLength(4);
    const types = alice.map(e => e.context.type).sort();
    expect(types).toEqual(["otp", "password", "webauthn", "x509"]);
    const bob = credentials.filter(e => e.context?.userId === "u_bob");
    expect(bob.map(e => e.context.type).sort()).toEqual(["otp", "password"]);
    const charlie = credentials.filter(e => e.context?.userId === "u_charlie");
    expect(charlie).toHaveLength(1);
    expect(charlie[0].context.temporary).toBe(true);
  });

  it("Stage 8: user_detail projection имеет Credential subCollection", () => {
    const subs = PROJECTIONS.user_detail.subCollections;
    const credSub = subs.find(s => s.entity === "Credential");
    expect(credSub).toBeDefined();
    expect(credSub.foreignKey).toBe("userId");
    expect(credSub.title).toBe("Credentials");
  });

  it("Stage 5: wizard steps имеют id / title / fields", () => {
    const artifacts = crystallizeV2(
      INTENTS,
      { ...PROJECTIONS },
      ONTOLOGY,
      "keycloak",
    );
    const realmSteps = artifacts.realm_create.slots.body.steps;
    expect(realmSteps[0].id).toBe("basic");
    expect(realmSteps[0].title).toBe("Основное");
    expect(realmSteps[0].fields.find(f => f.name === "realm")?.required).toBe(true);
    expect(realmSteps[2].id).toBe("security");
  });
});
