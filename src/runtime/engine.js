import { useState, useMemo, useCallback, useEffect } from "react";
import { v4 as uuid } from "uuid";
import { deriveLinks } from "./links.js";
import { fold, foldDrafts, filterByStatus } from "./fold.js";

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

  const activeEffects = useMemo(() => filterByStatus(effects, "confirmed", "proposed"), [effects]);
  const world = useMemo(() => fold(activeEffects), [activeEffects]);
  const drafts = useMemo(() => foldDrafts(activeEffects), [activeEffects]);
  const links = useMemo(() => deriveLinks(domain.INTENTS), [domain]);

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

  const isApplicable = useCallback((intentId, ctx) => {
    const i = domain.INTENTS[intentId];
    if (!i) return false;
    for (const c of i.particles.conditions) {
      // Доменонезависимая проверка: парсим условие "entity.field = 'value'"
      const match = c.match(/^(\w+)\.(\w+)\s*=\s*'([^']+)'$/);
      if (match) {
        const [, , field, value] = match;
        if (ctx.entity?.[field] !== value) return false;
      }
    }
    return true;
  }, [domain]);

  return { world, drafts, effects, signals, links, exec, isApplicable, domain };
}
