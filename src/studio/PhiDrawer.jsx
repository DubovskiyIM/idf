import React, { useState, useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

const STATUS_COLORS = {
  proposed: "#f59e0b",
  confirmed: "#10b981",
  rejected: "#ef4444",
};

const ALPHA_COLORS = {
  add: "#34d399",
  replace: "#60a5fa",
  remove: "#f87171",
  batch: "#a78bfa",
};

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(Number(ts));
  return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function EffectRow({ eff, onClick }) {
  const alpha = eff.alpha || "—";
  const target = eff.target || "—";
  const status = eff.status || "proposed";
  const id = eff.id;
  return (
    <button
      onClick={() => onClick?.(eff)}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "10px 12px", marginBottom: 6,
        background: status === "rejected" ? "rgba(239, 68, 68, 0.04)" : "#1e293b",
        border: `1px solid ${status === "rejected" ? "rgba(239, 68, 68, 0.3)" : "#334155"}`,
        borderRadius: 6, cursor: "pointer",
        opacity: status === "rejected" ? 0.7 : 1,
        fontFamily: "inherit",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <span style={{ color: ALPHA_COLORS[alpha] || "#94a3b8", fontSize: 12, fontWeight: 600, fontFamily: "ui-monospace, monospace" }}>
          {alpha}
        </span>
        <span style={{ color: "#cbd5e1", fontSize: 12, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "ui-monospace, monospace" }}>
          {target}
        </span>
        <span style={{ color: STATUS_COLORS[status], fontSize: 10, whiteSpace: "nowrap" }}>● {status}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#64748b" }}>
        <span style={{ fontFamily: "ui-monospace, monospace" }}>{eff.intent_id}</span>
        <span>{formatTime(eff.created_at)}</span>
      </div>
    </button>
  );
}

/**
 * PhiDrawer — правая панель с real-time лентой эффектов Φ-журнала.
 * Фильтрует по intentIds текущего домена (+ служебные _seed/_sync).
 * Подключается к SSE /api/effects/stream для апдейтов.
 */
export default function PhiDrawer({ open, onClose, domain, intentIds }) {
  const [effects, setEffects] = useState([]);
  const [filter, setFilter] = useState("all"); // all | proposed | confirmed | rejected
  const esRef = useRef(null);

  // Initial load + SSE subscribe.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/effects")
      .then((r) => r.json())
      .then((list) => {
        if (!cancelled) setEffects(list || []);
      })
      .catch(() => {});

    const es = new EventSource("/api/effects/stream");
    esRef.current = es;
    es.addEventListener("effect", (evt) => {
      try {
        const e = JSON.parse(evt.data);
        setEffects((prev) => {
          const idx = prev.findIndex((p) => p.id === e.id);
          if (idx >= 0) { const next = [...prev]; next[idx] = e; return next; }
          return [...prev, e];
        });
      } catch {}
    });
    es.addEventListener("effect:rejected", (evt) => {
      try {
        const { id } = JSON.parse(evt.data);
        setEffects((prev) => prev.map((p) => (p.id === id ? { ...p, status: "rejected" } : p)));
      } catch {}
    });
    es.addEventListener("effects:reset", () => {
      fetch("/api/effects").then((r) => r.json()).then((l) => setEffects(l || [])).catch(() => {});
    });
    return () => {
      cancelled = true;
      es.close();
      esRef.current = null;
    };
  }, [open]);

  // Фильтр по intent_ids домена + служебные.
  const domainEffects = useMemo(() => {
    if (!intentIds || intentIds.size === 0) return effects;
    return effects.filter((e) =>
      intentIds.has(e.intent_id) ||
      e.intent_id === "_seed" || e.intent_id === "_sync" || e.intent_id?.startsWith("_")
    );
  }, [effects, intentIds]);

  const visible = useMemo(() => {
    const base = filter === "all" ? domainEffects : domainEffects.filter((e) => e.status === filter);
    return [...base].reverse();
  }, [domainEffects, filter]);

  const stats = useMemo(() => {
    const byStatus = { proposed: 0, confirmed: 0, rejected: 0 };
    for (const e of domainEffects) byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    return byStatus;
  }, [domainEffects]);

  const pillStyle = (active) => ({
    padding: "3px 10px", fontSize: 11, borderRadius: 12, cursor: "pointer",
    background: active ? "#4338ca" : "transparent",
    color: active ? "white" : "#94a3b8",
    border: `1px solid ${active ? "#4338ca" : "#334155"}`,
    fontFamily: "inherit",
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ x: 380, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 380, opacity: 0 }}
          transition={{ type: "tween", duration: 0.22 }}
          style={{
            position: "absolute", top: 0, right: 0, width: 380, height: "100%",
            background: "#0f172a", borderLeft: "1px solid #1e293b",
            display: "flex", flexDirection: "column", zIndex: 18,
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
            color: "#e2e8f0",
          }}
        >
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e293b" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Φ · {domain}</div>
              <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 16, cursor: "pointer", padding: 0 }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button onClick={() => setFilter("all")} style={pillStyle(filter === "all")}>
                Все · {domainEffects.length}
              </button>
              <button onClick={() => setFilter("confirmed")} style={pillStyle(filter === "confirmed")}>
                ● confirmed · {stats.confirmed || 0}
              </button>
              <button onClick={() => setFilter("proposed")} style={pillStyle(filter === "proposed")}>
                ● proposed · {stats.proposed || 0}
              </button>
              <button onClick={() => setFilter("rejected")} style={pillStyle(filter === "rejected")}>
                ● rejected · {stats.rejected || 0}
              </button>
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
            {visible.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: 32, lineHeight: 1.6 }}>
                {filter === "all" ? "Пока эффектов нет" : `Нет эффектов со статусом «${filter}»`}
              </div>
            ) : (
              visible.map((eff) => <EffectRow key={eff.id} eff={eff} />)
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
