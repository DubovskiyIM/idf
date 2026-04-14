/**
 * server/timeEngine.js
 *
 * Темпоральный scheduler — first-class механизм парадигмы.
 * См. docs/superpowers/specs/2026-04-15-delivery-domain-field-test-11-design.md §4.
 *
 * Этот модуль содержит:
 *  - TimerQueue: in-memory min-heap-like store по firesAt
 *  - init(): hydrate из Φ на старте  (Task 4)
 *  - onEffectConfirmed(): реакция на schedule_timer / revoke_timer (Task 5)
 *  - tick(): firing due timers через ingestEffect (Task 6)
 */

class TimerQueue {
  constructor() {
    this._byId = new Map(); // id → timer
  }

  insert(timer) {
    this._byId.set(timer.id, timer);
  }

  removeById(id) {
    return this._byId.delete(id);
  }

  size() {
    return this._byId.size;
  }

  /** Вернуть и удалить таймеры с firesAt <= now, в порядке firesAt asc. */
  popDue(now) {
    const due = [];
    for (const t of this._byId.values()) {
      if (t.firesAt <= now) due.push(t);
    }
    due.sort((a, b) => a.firesAt - b.firesAt);
    for (const t of due) this._byId.delete(t.id);
    return due;
  }

  all() {
    return Array.from(this._byId.values());
  }
}

/**
 * Hydrate queue из текущего world (fold(Φ)).
 * Грузит таймеры с active === true && firedAt == null.
 */
function hydrateFromWorld(queue, world) {
  const timers = world?.scheduledTimers || [];
  for (const t of timers) {
    if (t.active === true && t.firedAt == null) {
      queue.insert(t);
    }
  }
}

/**
 * Парсит JSON-строку или возвращает null/исходное значение.
 */
function parseJSON(s) {
  if (s == null) return null;
  if (typeof s !== "string") return s;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Реакция queue на сохранённые эффекты schedule_timer / revoke_timer.
 * stored — запись из таблицы effects (value/context — JSON-strings).
 */
function onEffectConfirmed(queue, stored) {
  const intentId = stored.intent_id;
  if (intentId !== "schedule_timer" && intentId !== "revoke_timer") return;

  const value = parseJSON(stored.value);
  const context = parseJSON(stored.context);
  // payload: value приоритетно, fallback на context
  const payload = (value && typeof value === "object") ? value : (context || {});
  const id = payload.id || context?.id;

  if (intentId === "schedule_timer") {
    if (!id || payload.firesAt == null || !payload.fireIntent) return;
    queue.insert({
      id,
      firesAt: payload.firesAt,
      fireIntent: payload.fireIntent,
      fireParams: payload.fireParams || {},
      triggerEventKey: payload.triggerEventKey || null,
      revokeOnEvents: payload.revokeOnEvents || [],
      guard: payload.guard || null,
    });
  } else if (intentId === "revoke_timer") {
    if (id) queue.removeById(id);
  }
}

module.exports = { TimerQueue, hydrateFromWorld, onEffectConfirmed };
