import { useState, useMemo, useCallback, useEffect } from "react";
import { v4 as uuid } from "uuid";
import { deriveLinks } from "./links.js";
import { fold, foldDrafts, filterByStatus, buildTypeMap, applyPresentation } from "./fold.js";

const ts = () => new Date().toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 2 });

/**
 * Доменонезависимый движок.
 * @param {Object} domain — { INTENTS, buildEffects, describeEffect, signalForIntent, getSeedEffects }
 */
export function useEngine(domain) {
  const [effects, setEffects] = useState([]);
  const [signals, setSignals] = useState([]);

  const reloadEffects = useCallback(() => {
    fetch("/api/effects")
      .then(r => r.json())
      .then(data => {
        setEffects(data.map(ef => ({
          ...ef,
          desc: ef.desc || domain.describeEffect(ef.intent_id, ef.alpha, ef.context || {}, ef.target),
          time: ef.time || new Date(ef.created_at).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        })));
      })
      .catch(() => {});
  }, [domain]);

  // Загрузить эффекты при монтировании или смене домена
  useEffect(() => {
    reloadEffects();
  }, [reloadEffects]);

  // SSE-подписка
  useEffect(() => {
    const es = new EventSource("/api/effects/stream");

    es.addEventListener("effect:confirmed", (e) => {
      const { id } = JSON.parse(e.data);
      setEffects(prev => {
        const exists = prev.find(ef => ef.id === id);
        if (exists) {
          const updated = prev.map(ef =>
            ef.id === id ? { ...ef, status: "confirmed", resolved_at: Date.now() } : ef
          );
          const ef = updated.find(x => x.id === id);
          if (ef) {
            const sig = domain.signalForIntent(ef.intent_id);
            if (sig) setSignals(p => [{ id: uuid(), κ: sig.κ, desc: sig.desc, time: ts(), effectId: id }, ...p].slice(0, 20));
          }
          return updated;
        }
        return prev;
      });
      // Foreign effect — reload
      setEffects(prev => {
        if (!prev.find(ef => ef.id === id)) { reloadEffects(); }
        return prev;
      });
    });

    es.addEventListener("effect:rejected", (e) => {
      const { id, reason, cascaded } = JSON.parse(e.data);
      setEffects(prev => {
        let updated = prev.map(ef =>
          ef.id === id ? { ...ef, status: "rejected", resolved_at: Date.now(), reason } : ef
        );
        if (cascaded?.length) {
          updated = updated.map(ef =>
            cascaded.includes(ef.id) ? { ...ef, status: "rejected", resolved_at: Date.now(), reason: `Каскад: предок ${id}` } : ef
          );
        }
        return updated;
      });
    });

    es.addEventListener("effects:reset", () => { setEffects([]); setSignals([]); });

    es.addEventListener("signal:drift", (e) => {
      const { description, time } = JSON.parse(e.data);
      setSignals(p => [{ id: uuid(), κ: "drift", desc: description, time: new Date(time).toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }, ...p].slice(0, 20));
    });

    es.onerror = () => {};
    return () => es.close();
  }, [domain, reloadEffects]);

  const typeMap = useMemo(() => buildTypeMap(domain.ONTOLOGY), [domain]);
  const activeEffects = useMemo(() => filterByStatus(effects, "confirmed", "proposed"), [effects]);
  const worldSemantic = useMemo(() => fold(activeEffects, typeMap), [activeEffects, typeMap]);
  const world = useMemo(() => applyPresentation(worldSemantic, activeEffects, typeMap), [worldSemantic, activeEffects, typeMap]);
  const drafts = useMemo(() => foldDrafts(activeEffects), [activeEffects]);
  const links = useMemo(() => deriveLinks(domain.INTENTS), [domain]);

  // === Overlay(I) — провизорное наложение для многофазных намерений ===
  const [overlay, setOverlay] = useState(null); // { intentId, ctx, effects: [] }

  // World_for(I) = World(t) ⊕ Overlay(I) ⊕ Δ(user)
  const worldForIntent = useMemo(() => {
    if (!overlay || !overlay.effects?.length) return world;
    // Применить overlay-эффекты поверх world
    const overlayEffects = overlay.effects.map(e => ({ ...e, status: "confirmed" }));
    const allEffects = [...activeEffects, ...overlayEffects];
    const merged = fold(allEffects, typeMap);
    return applyPresentation(merged, allEffects, typeMap);
  }, [world, overlay, activeEffects, typeMap]);

  // IDs сущностей, затронутых overlay (для ghost-отображения)
  const overlayEntityIds = useMemo(() => {
    if (!overlay?.effects?.length) return new Set();
    return new Set(overlay.effects.map(e => e.context?.id).filter(Boolean));
  }, [overlay]);

  const startInvestigation = useCallback((intentId, ctx = {}) => {
    const built = domain.buildEffects(intentId, ctx, world, drafts);
    if (!built) return;
    setOverlay({ intentId, ctx, effects: built });
  }, [world, drafts, domain]);

  const commitInvestigation = useCallback(() => {
    if (!overlay) return;
    // Overlay → реальные эффекты в Φ
    const built = overlay.effects;
    for (let i = 1; i < built.length; i++) built[i].parent_id = built[i - 1].id;
    setEffects(prev => {
      const lastUserEffect = [...prev].reverse().find(e => e.intent_id !== "_seed" && e.intent_id !== "_sync" && e.status !== "rejected");
      if (lastUserEffect && built[0].parent_id === null) built[0].parent_id = lastUserEffect.id;
      return [...prev, ...built];
    });
    for (const effect of built) {
      fetch("/api/effects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(effect),
      }).catch(() => {
        setEffects(prev => prev.map(ef =>
          ef.id === effect.id ? { ...ef, status: "confirmed", resolved_at: Date.now() } : ef
        ));
      });
    }
    setOverlay(null);
  }, [overlay]);

  const cancelInvestigation = useCallback(() => {
    setOverlay(null);
  }, []);

  const exec = useCallback((intentId, ctx = {}) => {
    const built = domain.buildEffects(intentId, ctx, world, drafts);
    if (!built) return;

    // Причинные связи
    for (let i = 1; i < built.length; i++) built[i].parent_id = built[i - 1].id;
    setEffects(prev => {
      const lastUserEffect = [...prev].reverse().find(e => e.intent_id !== "_seed" && e.intent_id !== "_sync" && e.status !== "rejected");
      if (lastUserEffect && built[0].parent_id === null) built[0].parent_id = lastUserEffect.id;
      return [...prev, ...built];
    });

    for (const effect of built) {
      fetch("/api/effects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(effect),
      }).catch(() => {
        setEffects(prev => prev.map(ef =>
          ef.id === effect.id ? { ...ef, status: "confirmed", resolved_at: Date.now() } : ef
        ));
      });
    }
  }, [world, drafts, domain]);

  /**
   * execBatch — отправка нескольких под-эффектов одним атомарным batch-эффектом.
   * Используется entityForm для сохранения множественных изменений полей.
   *
   * Принцип all-or-nothing (§11 манифеста): серверная валидация проверяет
   * каждый под-эффект; если любой невалиден, весь batch rejected и ни один
   * под-эффект не применяется в fold. При confirmed — все применяются.
   *
   * @param {string} intentId — id объединяющего намерения
   * @param {Array<{intentId, ctx}>} subs — массив {intentId, ctx} для каждого
   *   под-эффекта. Отдельные buildEffects вызываются для каждого, результаты
   *   собираются в один batch.
   */
  const execBatch = useCallback((intentId, subs) => {
    const subEffects = [];
    for (const { intentId: subIntentId, ctx: subCtx } of subs) {
      const built = domain.buildEffects(subIntentId || intentId, subCtx, world, drafts);
      if (!built || built.length === 0) continue;
      subEffects.push(...built);
    }
    if (subEffects.length === 0) return;

    // Batch-эффект: один верхнеуровневый, value = массив под-эффектов
    const now = Date.now();
    const batchEffect = {
      id: uuid(),
      intent_id: intentId,
      alpha: "batch",
      // target указывает на главную коллекцию (берём из первого под-эффекта)
      target: subEffects[0].target.split(".")[0],
      value: subEffects.map(e => ({
        intent_id: e.intent_id,
        alpha: e.alpha,
        target: e.target,
        value: e.value,
        context: e.context,
      })),
      scope: "account",
      parent_id: null,
      context: { batchSize: subEffects.length },
      created_at: now,
      status: "proposed",
      desc: `batch ${intentId} × ${subEffects.length}`,
      time: ts(),
    };

    setEffects(prev => {
      const lastUserEffect = [...prev].reverse().find(e => e.intent_id !== "_seed" && e.intent_id !== "_sync" && e.status !== "rejected");
      if (lastUserEffect) batchEffect.parent_id = lastUserEffect.id;
      return [...prev, batchEffect];
    });

    fetch("/api/effects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchEffect),
    }).catch(() => {
      setEffects(prev => prev.map(ef =>
        ef.id === batchEffect.id ? { ...ef, status: "confirmed", resolved_at: Date.now() } : ef
      ));
    });
  }, [world, drafts, domain]);

  const isApplicable = useCallback((intentId, ctx) => {
    const i = domain.INTENTS[intentId];
    if (!i) return false;
    for (const c of i.particles.conditions) {
      // "entity.field = 'value'"
      const matchEq = c.match(/^(\w+)\.(\w+)\s*=\s*'([^']+)'$/);
      if (matchEq) {
        const [, , field, value] = matchEq;
        if (ctx.entity?.[field] !== value) return false;
        continue;
      }
      // "entity.field = null"
      const matchNull = c.match(/^(\w+)\.(\w+)\s*=\s*null$/);
      if (matchNull) {
        const [, , field] = matchNull;
        if (ctx.entity?.[field] != null) return false;
        continue;
      }
      // "entity.field != 'value'"
      const matchNeq = c.match(/^(\w+)\.(\w+)\s*!=\s*'([^']+)'$/);
      if (matchNeq) {
        const [, , field, value] = matchNeq;
        if (ctx.entity?.[field] === value) return false;
        continue;
      }
      // "entity.field IN ('a','b','c')"
      const matchIn = c.match(/^(\w+)\.(\w+)\s+IN\s+\(([^)]+)\)$/);
      if (matchIn) {
        const [, , field, valuesStr] = matchIn;
        const values = valuesStr.split(",").map(v => v.trim().replace(/'/g, ""));
        if (!values.includes(ctx.entity?.[field])) return false;
        continue;
      }
    }
    return true;
  }, [domain]);

  return {
    world, worldForIntent, drafts, effects, signals, links,
    exec, execBatch, isApplicable, domain,
    // Overlay(I) — многофазные намерения
    overlay, overlayEntityIds,
    startInvestigation, commitInvestigation, cancelInvestigation,
  };
}
