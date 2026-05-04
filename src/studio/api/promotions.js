// Pattern Promotion API client для CuratorWorkspace.
//
// Сервер не имеет dedicated /api/patterns/promotions route — fold выполняем
// клиентски из generic GET /api/effects (та же логика, что в
// scripts/meta-compile.mjs foldPatternPromotions). Эффекты выпускаем через
// POST /api/effects (как остальные studio-операции). Server проверяет
// invariants и cascadeReject если что.

const EFFECTS = "/api/effects";

function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
}

export async function fetchAllPromotions() {
  const r = await fetch(EFFECTS);
  if (!r.ok) throw new Error(`effects ${r.status}`);
  const effects = await r.json();
  const confirmed = effects.filter((e) => e.status === "confirmed");
  return foldPatternPromotions(confirmed);
}

// Та же fold-логика, что в scripts/meta-compile.mjs.
export function foldPatternPromotions(effects) {
  const items = {};
  for (const ef of effects) {
    const t = (ef.target || "").toLowerCase();
    if (!t.startsWith("patternpromotion")) continue;
    const ctx = typeof ef.context === "string" ? JSON.parse(ef.context) : ef.context;
    const id = ctx?.id || ef.id;
    switch (ef.alpha) {
      case "add":
      case "create":
        items[id] = { ...(items[id] || {}), ...ctx };
        break;
      case "replace":
        if (items[id]) items[id] = { ...items[id], ...ctx };
        break;
      case "remove":
        delete items[id];
        break;
    }
  }
  return Object.values(items);
}

export function groupByStatus(items) {
  const buckets = { pending: [], approved: [], shipped: [], rejected: [] };
  for (const it of items) {
    const s = it.status || "pending";
    if (!buckets[s]) buckets[s] = [];
    buckets[s].push(it);
  }
  for (const k of Object.keys(buckets)) {
    buckets[k].sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0));
  }
  return buckets;
}

async function postEffect(effect) {
  const r = await fetch(EFFECTS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(effect),
  });
  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(`POST /api/effects ${r.status}: ${txt}`);
  }
  return r.json();
}

const VIEWER = "patternCurator";

function baseEffect(intent_id, alpha, target, context) {
  const id = uuid();
  return {
    id,
    intent_id,
    alpha,
    target,
    value: JSON.stringify(context),
    scope: "account",
    status: "proposed",
    context,
    created_at: Date.now(),
  };
}

export async function requestPromotion({
  candidateId,
  targetArchetype,
  rationale,
  falsificationFixtures,
  weight,
}) {
  const promotionId = uuid();
  const ctx = {
    id: promotionId,
    candidateId,
    targetArchetype,
    rationale,
    falsificationFixtures: falsificationFixtures || "",
    weight: typeof weight === "number" ? weight : 50,
    status: "pending",
    requestedByUserId: VIEWER,
    requestedAt: Date.now(),
  };
  return postEffect(baseEffect("request_pattern_promotion", "create", "PatternPromotion", ctx));
}

export async function updatePromotionWeight(promotionId, weight) {
  return postEffect(
    baseEffect("ship_pattern_promotion", "replace", "PatternPromotion.weight", {
      id: promotionId,
      weight: Math.max(0, Math.min(100, Number(weight) || 0)),
    })
  );
}

// Группировка pending'ов по archetypeScope, чтобы куратор видел competing
// patterns и относительные веса.
export function groupCompeting(promotions) {
  const byArch = {};
  for (const p of promotions) {
    if (p.status !== "pending") continue;
    const a = p.targetArchetype || "?";
    if (!byArch[a]) byArch[a] = [];
    byArch[a].push(p);
  }
  // Только archetype'ы где >1 pending — competing.
  const competing = {};
  for (const [a, list] of Object.entries(byArch)) {
    if (list.length >= 2) {
      const total = list.reduce((s, p) => s + (Number(p.weight) || 50), 0);
      competing[a] = list.map((p) => ({
        ...p,
        weightShare: total > 0 ? (Number(p.weight) || 50) / total : 1 / list.length,
      }));
    }
  }
  return competing;
}

export async function approvePromotion(promotionId) {
  return postEffect(
    baseEffect("approve_pattern_promotion", "replace", "PatternPromotion.status", {
      id: promotionId,
      status: "approved",
      decidedAt: Date.now(),
    })
  );
}

export async function rejectPromotion(promotionId) {
  return postEffect(
    baseEffect("reject_pattern_promotion", "replace", "PatternPromotion.status", {
      id: promotionId,
      status: "rejected",
      decidedAt: Date.now(),
    })
  );
}

export async function shipPromotion(promotionId, sdkPrUrl) {
  // ship_pattern_promotion имеет два эффекта (status + sdkPrUrl). Сервер
  // ingest'ит их как два отдельных эффекта; для curator UI достаточно
  // одного combined replace на родительский Promotion (server fold склеит).
  return postEffect(
    baseEffect("ship_pattern_promotion", "replace", "PatternPromotion", {
      id: promotionId,
      status: "shipped",
      sdkPrUrl,
      decidedAt: Date.now(),
    })
  );
}
