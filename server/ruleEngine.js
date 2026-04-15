/**
 * Движок реактивных правил (event-condition-action) — расширенная версия.
 *
 * Базовое API (v1.4):
 *   { id, trigger, action, context }
 *
 * Расширения v1.5:
 *   - aggregation: { everyN } — fire каждый Nй trigger per user (counter в rule_state)
 *   - threshold: { lookback, field, condition } — predicate на last N entries
 *   - schedule: "weekly:sun:20:00" | "daily:08:00" — cron-like server timer
 *   - condition: "effect.x > 0.6" — JS expression evaluator (whitelisted)
 *
 * trigger — glob: "vote_*" (prefix) или "confirm_delivery" (exact).
 * action — intent_id, чьи conditions служат guard'ом.
 * context — маппинг { key: "effect.<field>" | литерал }.
 */

function matchTrigger(trigger, intentId) {
  if (trigger === "*") return true;
  if (trigger.endsWith("*")) {
    return intentId.startsWith(trigger.slice(0, -1));
  }
  return trigger === intentId;
}

function resolveContext(mapping, storedContext) {
  const result = {};
  for (const [key, value] of Object.entries(mapping)) {
    if (typeof value === "string" && value.startsWith("effect.")) {
      const field = value.slice("effect.".length);
      result[key] = storedContext[field];
    } else {
      result[key] = value;
    }
  }
  return result;
}

function buildActionEffect(actionIntentId, intent, resolvedContext) {
  const effects = intent.particles?.effects || [];
  const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = Date.now();

  if (effects.length === 1) {
    const ef = effects[0];
    return {
      id,
      intent_id: actionIntentId,
      alpha: ef.α,
      target: ef.target,
      value: ef.value,
      scope: ef.σ || "account",
      context: resolvedContext,
      created_at: now,
    };
  }

  const base = effects[0]?.target?.split(".")[0] || actionIntentId;
  return {
    id,
    intent_id: actionIntentId,
    alpha: "batch",
    target: base,
    value: effects.map(ef => ({
      alpha: ef.α,
      target: ef.target,
      value: ef.value,
      context: resolvedContext,
      scope: ef.σ || "account",
    })),
    scope: "account",
    context: resolvedContext,
    created_at: now,
  };
}

// ─── Extensions v1.5 ───

/**
 * Aggregation: счётчик per (rule_id, user_id), fire каждый everyN-й раз.
 */
function shouldFireAggregation(rule, userId, db) {
  if (!rule.aggregation) return true;
  const { everyN } = rule.aggregation;
  if (!everyN || !db) return true;

  db.prepare(`
    INSERT INTO rule_state (rule_id, user_id, counter)
    VALUES (?, ?, 1)
    ON CONFLICT (rule_id, user_id)
    DO UPDATE SET counter = counter + 1
  `).run(rule.id, userId);

  const row = db.prepare(`
    SELECT counter FROM rule_state WHERE rule_id = ? AND user_id = ?
  `).get(rule.id, userId);

  return row && row.counter % everyN === 0;
}

/**
 * Threshold: lookback last N entries, evaluate predicate.
 */
function shouldFireThreshold(rule, world, userId) {
  if (!rule.threshold) return true;
  const { lookback, field, condition, collection = "moodEntries" } = rule.threshold;

  const list = world?.[collection] || [];
  const userEntries = list
    .filter(e => e.userId === userId)
    .sort((a, b) => (b.loggedAt || b.createdAt || 0) - (a.loggedAt || a.createdAt || 0))
    .slice(0, lookback);

  if (userEntries.length < lookback) return false;
  return evaluateCondition(condition, userEntries.map(e => e[field]));
}

/**
 * Простой DSL evaluator для threshold condition:
 *   "all_equal:LEU" | "equals:7" | "gt:5" | "lt:5"
 */
function evaluateCondition(condition, values) {
  if (!condition) return false;
  const [op, target] = condition.split(":");
  switch (op) {
    case "all_equal":
      return values.every(v => v === target || v === Number(target));
    case "equals": {
      const t = isNaN(Number(target)) ? target : Number(target);
      return values[0] === t;
    }
    case "gt":
      return Number(values[0]) > Number(target);
    case "lt":
      return Number(values[0]) < Number(target);
    default:
      return false;
  }
}

/**
 * Condition expression evaluator для rule.condition.
 * Безопасный whitelist: только сравнения, Math.abs/min/max/floor/ceil/round, &&/||.
 *   "effect.correlation > 0.6"
 *   "Math.abs(effect.delta) > 0.5"
 *   "effect.x > 0 && effect.y < 5"
 */
function evaluateRuleCondition(conditionExpr, effectContext) {
  if (!conditionExpr) return true;
  const safeExpr = conditionExpr.replace(/effect\.(\w+)/g, (_, field) => {
    const val = effectContext?.[field];
    return JSON.stringify(val ?? null);
  });
  const Math2 = {
    abs: Math.abs, min: Math.min, max: Math.max,
    floor: Math.floor, ceil: Math.ceil, round: Math.round,
  };
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("Math", `"use strict"; return (${safeExpr});`);
    return Boolean(fn(Math2));
  } catch (e) {
    return false;
  }
}

/**
 * Парсер schedule string.
 * "weekly:sun:20:00" → { period: "weekly", day: 0, hour: 20, minute: 0 }
 * "daily:08:00" → { period: "daily", hour: 8, minute: 0 }
 */
function parseSchedule(scheduleStr) {
  if (!scheduleStr) return null;
  const parts = scheduleStr.split(":");
  if (parts[0] === "weekly") {
    const dayMap = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
    return {
      period: "weekly",
      day: dayMap[parts[1]?.toLowerCase()] ?? 0,
      hour: Number(parts[2] || 0),
      minute: Number(parts[3] || 0),
    };
  }
  if (parts[0] === "daily") {
    return {
      period: "daily",
      hour: Number(parts[1] || 0),
      minute: Number(parts[2] || 0),
    };
  }
  return null;
}

/**
 * Should fire schedule: проверка времени.
 * 5-минутное окно от заданной минуты, deduplication через lastFiredAt.
 */
function shouldFireSchedule(schedule, now = new Date(), lastFiredAt = 0) {
  if (!schedule) return false;
  const { period, day, hour, minute } = schedule;

  if (period === "weekly" && now.getDay() !== day) return false;
  if (now.getHours() !== hour) return false;
  if (now.getMinutes() < minute || now.getMinutes() >= minute + 5) return false;

  return Date.now() - lastFiredAt > 4 * 60 * 1000;
}

// ─── Main evaluators ───

function evaluateRules(stored, worldThunk, deps) {
  const { getDomainByIntentId, getOntology, validateIntentConditions, getIntent, db } = deps;

  const storedCtx = typeof stored.context === "string"
    ? JSON.parse(stored.context)
    : (stored.context || {});

  const domain = getDomainByIntentId(stored.intent_id);
  if (!domain) return [];

  const ontology = getOntology(domain);
  const rules = ontology?.rules || [];
  if (rules.length === 0) return [];

  const matched = rules.filter(rule => matchTrigger(rule.trigger, stored.intent_id));
  if (matched.length === 0) return [];

  const world = worldThunk();
  const results = [];

  for (const rule of matched) {
    // Skip schedule-only rules — они firing через evaluateScheduledRules
    if (rule.schedule && !rule.trigger) continue;

    const intent = getIntent(rule.action);
    if (!intent) continue;

    const resolvedCtx = resolveContext(rule.context || {}, storedCtx);

    // Aggregation guard
    const userId = resolvedCtx.userId || storedCtx.userId || "default";
    if (!shouldFireAggregation(rule, userId, db)) continue;

    // Threshold guard
    if (!shouldFireThreshold(rule, world, userId)) continue;

    // Condition guard (expression)
    if (!evaluateRuleCondition(rule.condition, storedCtx)) continue;

    // Validate action conditions
    const mockEffect = {
      intent_id: rule.action,
      target: intent.particles?.effects?.[0]?.target || rule.action,
      context: resolvedCtx,
    };
    const validation = validateIntentConditions(mockEffect, world);
    if (validation.valid) {
      const effect = buildActionEffect(rule.action, intent, resolvedCtx);
      results.push({ rule, effect });
    }
  }

  return results;
}

/**
 * Periodic evaluator — вызывается timer'ом каждую минуту.
 * Для каждого домена → каждого rule с schedule — проверяет shouldFireSchedule
 * и firing если время пришло.
 */
function evaluateScheduledRules(now, deps) {
  const { getAllOntologies, getIntent, db } = deps;
  if (!getAllOntologies || !db) return [];

  const results = [];
  const ontologies = getAllOntologies();

  for (const [domain, ontology] of Object.entries(ontologies || {})) {
    const rules = ontology?.rules || [];
    for (const rule of rules) {
      if (!rule.schedule) continue;
      const parsed = parseSchedule(rule.schedule);
      if (!parsed) continue;

      // Get last_fired_at для schedule-rule
      const row = db.prepare(`
        SELECT last_fired_at FROM rule_state WHERE rule_id = ? AND user_id = ?
      `).get(rule.id, "__schedule__");
      const lastFiredAt = row?.last_fired_at || 0;

      if (!shouldFireSchedule(parsed, now, lastFiredAt)) continue;

      const intent = getIntent(rule.action);
      if (!intent) continue;

      const resolvedCtx = resolveContext(rule.context || {}, {});
      const effect = buildActionEffect(rule.action, intent, resolvedCtx);
      results.push({ rule, effect, domain });

      // Update last_fired_at
      db.prepare(`
        INSERT INTO rule_state (rule_id, user_id, last_fired_at, counter)
        VALUES (?, ?, ?, 0)
        ON CONFLICT (rule_id, user_id)
        DO UPDATE SET last_fired_at = excluded.last_fired_at
      `).run(rule.id, "__schedule__", Date.now());
    }
  }

  return results;
}

// ─── Schedule v2 (Task 7 plan) ───────────────────────────────────────────
const { resolveFiresAt } = require("./scheduleV2.cjs");

function resolveParams(params, payload) {
  if (!params) return {};
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v.startsWith("$.")) {
      const path = v.slice(2).split(".");
      let cur = payload;
      for (const p of path) cur = cur?.[p];
      out[k] = cur;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseContext(c) {
  if (c == null) return {};
  if (typeof c !== "string") return c;
  try { return JSON.parse(c); } catch { return {}; }
}

/**
 * Cron → первый абсолютный firesAt.
 * parsed: { period: "daily"|"weekly", day?, hour, minute }
 * Возвращает timestamp (ms) следующего срабатывания cron-правила.
 * Self-rescheduling после firing — honest border (§26 open items, Task 13).
 */
function cronToFirstFiresAt(parsed, nowMs) {
  if (!parsed) return null;
  const now = new Date(nowMs);
  const target = new Date(now);
  target.setUTCSeconds(0, 0);
  target.setUTCHours(parsed.hour, parsed.minute);

  if (parsed.period === "daily") {
    if (target.getTime() <= nowMs) target.setUTCDate(target.getUTCDate() + 1);
    return target.getTime();
  }
  if (parsed.period === "weekly") {
    let daysAhead = (parsed.day - target.getUTCDay() + 7) % 7;
    if (daysAhead === 0 && target.getTime() <= nowMs) daysAhead = 7;
    target.setUTCDate(target.getUTCDate() + daysAhead);
    return target.getTime();
  }
  return null;
}

/**
 * Schedule v2 — для каждого подтверждённого effect'а:
 *  1) Если rule.trigger == intent_id и (after|at) есть → emit schedule_timer
 *  2) Если intent_id ∈ rule.revokeOn → emit revoke_timer для всех active
 *     timers с triggerEventKey === `${rule.id}:${rule.trigger}`
 */
function evaluateScheduleV2(stored, deps) {
  const { getRulesForDomain, getDomainByIntentId, ingestEffect, foldWorld, now } = deps;
  const nowMs = now ? now() : Date.now();
  const domain = getDomainByIntentId(stored.intent_id);
  if (!domain) return;
  const rules = getRulesForDomain(domain) || [];

  const payload = parseContext(stored.context);

  // 1) trigger match → schedule
  for (const rule of rules) {
    if (!matchTrigger(rule.trigger, stored.intent_id)) continue;
    if (!rule.after && !rule.at) continue;
    const firesAt = resolveFiresAt(rule, payload, nowMs);
    if (firesAt == null) continue;
    const fireParams = resolveParams(rule.params, payload);
    const triggerEventKey = `${rule.id}:${rule.trigger}`;
    const timerId = makeId("tmr");
    ingestEffect({
      id: makeId("eff"),
      intent_id: "schedule_timer",
      alpha: "add",
      target: "ScheduledTimer",
      value: null,
      scope: "account",
      parent_id: null,
      context: {
        id: timerId,
        firesAt,
        fireIntent: rule.fireIntent,
        fireParams,
        triggerEventKey,
        revokeOnEvents: rule.revokeOn || [],
        guard: rule.guard || null,
      },
      created_at: nowMs,
    });
  }

  // 2) revokeOn match → revoke matching active timers
  const world = foldWorld ? foldWorld() : {};
  const activeTimers = (world.scheduledTimers || []).filter(t => t.active && t.firedAt == null);
  for (const rule of rules) {
    if (!rule.revokeOn || !rule.revokeOn.includes(stored.intent_id)) continue;
    const triggerEventKey = `${rule.id}:${rule.trigger}`;
    const matching = activeTimers.filter(t => t.triggerEventKey === triggerEventKey);
    for (const t of matching) {
      ingestEffect({
        id: makeId("eff"),
        intent_id: "revoke_timer",
        alpha: "replace",
        target: "ScheduledTimer",
        value: null,
        scope: "account",
        parent_id: t.id,
        context: { id: t.id, reason: "revokedByEvent", revokedBy: stored.intent_id },
        created_at: nowMs,
      });
    }
  }
}

module.exports = {
  matchTrigger,
  resolveContext,
  buildActionEffect,
  evaluateRules,
  evaluateScheduledRules,
  // Extensions
  shouldFireAggregation,
  shouldFireThreshold,
  evaluateCondition,
  evaluateRuleCondition,
  parseSchedule,
  shouldFireSchedule,
  // Schedule v2
  evaluateScheduleV2,
  // Cron migration v1 → schedule v2 (Task 12)
  cronToFirstFiresAt,
};
