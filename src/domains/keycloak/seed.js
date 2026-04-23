// src/domains/keycloak/seed.js
import { v4 as uuid } from "uuid";

/**
 * Stage 4 seed — minimal-viable demo dataset для визуальной валидации
 * Keycloak Admin Console UX. Все FK соответствуют synthetic <parent>Id
 * convention от importer-openapi (realmId), будут видны в TreeNav и
 * R8 hub-absorption после fix'а G-K-9 (сейчас manual hubSections).
 *
 * Coverage:
 *  - 3 realm (master / customer-app / staging) с разным config'ом
 *  - 5 client (внутренние account/admin-cli + 3 custom)
 *  - 10 user (admin + 9 regular в разных realms)
 *  - 3 group (Admins / Engineers / Customers)
 *  - 6 role (realm-admin/manage-users/view-users/customer-tier-1/+ client roles)
 *  - 4 identity provider (saml-corporate / google-oidc / github-oauth / ldap)
 *  - 3 client scope (profile / email / offline_access)
 *
 * Embedded entities (Credentials, FederatedIdentity, RoleMappings,
 * SubGroups, ProtocolMappers) специально не seed'ятся — они должны
 * быть редактируемы через UI после baseline-render'а.
 */
export function getSeedEffects() {
  // G-K-19 fix: stable IDs (а не uuid() каждый раз) — иначе на каждом
  // refresh standalone.jsx existence check `existingIds.has(e.id)` не
  // находит совпадения и seed дубируется (24 Realm в DB при 3 ожидаемых).
  // Stable: `seed_keycloak_${target}_${context.id}`.
  const now = Date.now();
  const effects = [];
  const ef = (target, context) => effects.push({
    id: `seed_keycloak_${target}_${context.id || context.internalId || context.alias}`,
    intent_id: "_seed",
    alpha: "add",
    scope: "account",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    created_at: now,
    resolved_at: now,
    target,
    context,
  });

  const ago = (days) => new Date(now - days * 86400e3).getTime();

  // ═══ Realms ═══════════════════════════════════════════════════════════
  const REALMS = [
    {
      id: "r_master",
      realm: "master",
      displayName: "Master",
      displayNameHtml: "<b>Keycloak</b>",
      enabled: true,
      sslRequired: "external",
      registrationAllowed: false,
      loginWithEmailAllowed: true,
      duplicateEmailsAllowed: false,
      resetPasswordAllowed: true,
      editUsernameAllowed: false,
      bruteForceProtected: true,
      ssoSessionIdleTimeout: 1800,
      ssoSessionMaxLifespan: 36000,
      accessTokenLifespan: 300,
      notBefore: ago(0),
    },
    {
      id: "r_customer",
      realm: "customer-app",
      displayName: "Customer App",
      enabled: true,
      sslRequired: "external",
      registrationAllowed: true,
      registrationEmailAsUsername: true,
      loginWithEmailAllowed: true,
      verifyEmail: true,
      bruteForceProtected: true,
      passwordPolicy: "length(12) and digits(1) and upperCase(1) and notUsername",
      ssoSessionIdleTimeout: 3600,
      ssoSessionMaxLifespan: 86400,
      accessTokenLifespan: 600,
      refreshTokenMaxReuse: 0,
      notBefore: ago(180),
    },
    {
      id: "r_staging",
      realm: "staging",
      displayName: "Staging",
      enabled: false,
      sslRequired: "none",
      registrationAllowed: true,
      bruteForceProtected: false,
      ssoSessionIdleTimeout: 7200,
      accessTokenLifespan: 1800,
      notBefore: ago(7),
    },
  ];
  REALMS.forEach(r => ef("Realm", r));

  // ═══ Clients ══════════════════════════════════════════════════════════
  const CLIENTS = [
    // master realm
    { id: "cl_account_master", clientId: "account", name: "${client_account}", realmId: "r_master", enabled: true, publicClient: true, baseUrl: "/realms/master/account/", protocol: "openid-connect", standardFlowEnabled: true, directAccessGrantsEnabled: false },
    { id: "cl_admin_cli",      clientId: "admin-cli", name: "${client_admin-cli}", realmId: "r_master", enabled: true, publicClient: true, protocol: "openid-connect", standardFlowEnabled: false, directAccessGrantsEnabled: true, serviceAccountsEnabled: false },
    // customer-app realm
    { id: "cl_webapp",         clientId: "customer-webapp", name: "Customer Web App", description: "Public SPA на React + Vite", realmId: "r_customer", enabled: true, publicClient: true, protocol: "openid-connect", standardFlowEnabled: true, implicitFlowEnabled: false, directAccessGrantsEnabled: false, baseUrl: "https://app.customer.example/", redirectUris: ["https://app.customer.example/*"], webOrigins: ["https://app.customer.example"] },
    { id: "cl_mobile",         clientId: "customer-mobile", name: "Customer Mobile App", description: "iOS + Android native (PKCE)", realmId: "r_customer", enabled: true, publicClient: true, protocol: "openid-connect", standardFlowEnabled: true, directAccessGrantsEnabled: false, redirectUris: ["customerapp://callback"] },
    { id: "cl_backend_api",    clientId: "backend-service", name: "Backend Service Account", description: "Server-to-server (confidential)", realmId: "r_customer", enabled: true, publicClient: false, protocol: "openid-connect", secret: "k8s-managed-secret-redacted", serviceAccountsEnabled: true, standardFlowEnabled: false, directAccessGrantsEnabled: false, bearerOnly: false },
  ];
  CLIENTS.forEach(c => ef("Client", c));

  // ═══ Users ════════════════════════════════════════════════════════════
  const USERS = [
    // master realm — admins
    { id: "u_kc_admin",   username: "admin", firstName: "Keycloak", lastName: "Admin", email: "admin@keycloak.local", emailVerified: true, enabled: true, realmId: "r_master", createdTimestamp: ago(365) },
    // customer-app realm
    { id: "u_alice",      username: "alice@acme.com",   firstName: "Алиса",  lastName: "Иванова",  email: "alice@acme.com",   emailVerified: true,  enabled: true,  realmId: "r_customer", createdTimestamp: ago(120) },
    { id: "u_bob",        username: "bob@acme.com",     firstName: "Боб",    lastName: "Петров",   email: "bob@acme.com",     emailVerified: true,  enabled: true,  realmId: "r_customer", createdTimestamp: ago(85)  },
    { id: "u_charlie",    username: "charlie@acme.com", firstName: "Чарли",  lastName: "Сидоров",  email: "charlie@acme.com", emailVerified: false, enabled: true,  realmId: "r_customer", createdTimestamp: ago(45)  },
    { id: "u_diana",      username: "diana@acme.com",   firstName: "Диана",  lastName: "Кузнецова", email: "diana@acme.com",  emailVerified: true,  enabled: true,  realmId: "r_customer", createdTimestamp: ago(30)  },
    { id: "u_eric",       username: "eric@acme.com",    firstName: "Эрик",   lastName: "Соколов",  email: "eric@acme.com",    emailVerified: true,  enabled: false, realmId: "r_customer", createdTimestamp: ago(180) },
    { id: "u_fiona",      username: "fiona@acme.com",   firstName: "Фиона",  lastName: "Орлова",   email: "fiona@acme.com",   emailVerified: true,  enabled: true,  realmId: "r_customer", createdTimestamp: ago(20)  },
    { id: "u_grigory",    username: "grigory@acme.com", firstName: "Григорий", lastName: "Мельник", email: "grigory@acme.com", emailVerified: true,  enabled: true,  realmId: "r_customer", createdTimestamp: ago(15)  },
    { id: "u_helena",     username: "helena@acme.com",  firstName: "Хелена", lastName: "Зайцева",  email: "helena@acme.com",  emailVerified: false, enabled: true,  realmId: "r_customer", createdTimestamp: ago(10)  },
    // staging
    { id: "u_test_qa",    username: "qa-bot",           firstName: "QA",     lastName: "Bot",      email: "qa@staging.local", emailVerified: true,  enabled: true,  realmId: "r_staging",  createdTimestamp: ago(5)   },
  ];
  USERS.forEach(u => ef("User", u));

  // ═══ Groups ═══════════════════════════════════════════════════════════
  const GROUPS = [
    { id: "g_admins",     name: "Admins",     path: "/Admins",     realmId: "r_customer", subGroupCount: 0 },
    { id: "g_engineers",  name: "Engineers",  path: "/Engineers",  realmId: "r_customer", subGroupCount: 0 },
    { id: "g_customers",  name: "Customers",  path: "/Customers",  realmId: "r_customer", subGroupCount: 2 },
  ];
  GROUPS.forEach(g => ef("Group", g));

  // ═══ Roles (realm + client) ═══════════════════════════════════════════
  const ROLES = [
    { id: "ro_realm_admin",    name: "realm-admin",    description: "Полный доступ к realm",                  realmId: "r_customer", composite: true,  clientRole: false },
    { id: "ro_manage_users",   name: "manage-users",   description: "CRUD на User entity",                     realmId: "r_customer", composite: false, clientRole: false },
    { id: "ro_view_users",     name: "view-users",     description: "Read-only User",                          realmId: "r_customer", composite: false, clientRole: false },
    { id: "ro_customer_t1",    name: "customer-tier-1", description: "Базовая подписка",                        realmId: "r_customer", composite: false, clientRole: false },
    { id: "ro_customer_t2",    name: "customer-tier-2", description: "Расширенная подписка",                    realmId: "r_customer", composite: true,  clientRole: false, composites: { realm: ["customer-tier-1"] } },
    { id: "ro_backend_caller", name: "backend-caller", description: "Право дёргать backend-service API",       realmId: "r_customer", clientId: "cl_backend_api", composite: false, clientRole: true },
  ];
  ROLES.forEach(r => ef("Role", r));

  // ═══ Identity Providers ═══════════════════════════════════════════════
  const IDPS = [
    { internalId: "idp_saml_corp",  alias: "saml-corporate", displayName: "SAML SSO (корпоративный)",        realmId: "r_customer", providerId: "saml",     enabled: true,  trustEmail: true,  storeToken: false, addReadTokenRoleOnCreate: false },
    { internalId: "idp_google",     alias: "google",         displayName: "Sign in with Google",               realmId: "r_customer", providerId: "google",   enabled: true,  trustEmail: true,  storeToken: false },
    { internalId: "idp_github",     alias: "github",         displayName: "Sign in with GitHub",               realmId: "r_customer", providerId: "github",   enabled: true,  trustEmail: false, storeToken: true  },
    { internalId: "idp_ldap_corp",  alias: "ldap-corporate", displayName: "Active Directory (корпоративный)",  realmId: "r_customer", providerId: "ldap",     enabled: false, trustEmail: true,  storeToken: false },
  ];
  IDPS.forEach(p => ef("IdentityProvider", p));

  // ═══ Client Scopes ════════════════════════════════════════════════════
  const SCOPES = [
    { id: "cs_profile",         name: "profile",         description: "OIDC built-in profile scope",        realmId: "r_customer", protocol: "openid-connect" },
    { id: "cs_email",           name: "email",           description: "OIDC built-in email scope",          realmId: "r_customer", protocol: "openid-connect" },
    { id: "cs_offline_access",  name: "offline_access",  description: "Long-lived refresh token",            realmId: "r_customer", protocol: "openid-connect" },
  ];
  SCOPES.forEach(s => ef("ClientScope", s));

  return effects;
}
