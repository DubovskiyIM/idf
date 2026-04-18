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

// Максимум строк в DOM — защита от тяжёлого domain (13k+ эффектов).
// Новые SSE-event'ы обрезают старые.
const MAX_ROWS = 500;
// Дефолтный initial-load (последние N по времени).
const INITIAL_LIMIT = 200;

function formatTime(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const d = new Date(n);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function EffectRow({ eff }) {
  const alpha = eff.alpha || "—";
  const target = eff.target || "—";
  const status = eff.status || "proposed";
  return (
    <div
      style={{
        padding: "10px 12px", marginBottom: 6,
        background: status === "rejected" ? "rgba(239, 68, 68, 0.04)" : "#1e293b",
        border: `1px solid ${status === "rejected" ? "rgba(239, 68, 68, 0.3)" : "#334155"}`,
        borderRadius: 6,
        opacity: status === "rejected" ? 0.75 : 1,
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
    </div>
  );
}

/**
 * PhiDrawer — правая панель с real-time лентой эффектов Φ-журнала.
 *
 * Оптимизации для тяжёлых доменов (13k+):
 *   - Server-side фильтр: GET /api/effects?intents=csv&limit=N&includeSeed
 *   - Initial load limit=200 (последние по времени)
 *   - DOM cap MAX_ROWS=500: новые SSE-event'ы обрезают старые
 *   - Default skipSeed=true: _seed/_sync обычно шум, toggle для debug
 *   - «Показать ещё» — расширяет limit до 1000, потом 5000
 */
export default function PhiDrawer({ open, onClose, domain, intentIds }) {
  const [effects, setEffects] = useState([]);
  const [filter, setFilter] = useState("all"); // all | proposed | confirmed | rejected
  const [skipSeed, setSkipSeed] = useState(true);
  const [limit, setLimit] = useState(INITIAL_LIMIT);
  const [totalCount, setTotalCount] = useState(null);
  const [loading, setLoading] = useState(false);
  const esRef = useRef(null);

  const intentsCsv = useMemo(() => {
    if (!intentIds || intentIds.size === 0) return null;
    return [...intentIds].join(",");
  }, [intentIds]);

  // Initial load + SSE subscribe. Перезагружается если меняются фильтры
  // требующие server-side refetch (intents, skipSeed, limit, status).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (intentsCsv) params.set("intents", intentsCsv);
    params.set("limit", String(limit));
    params.set("includeSeed", skipSeed ? "0" : "1");
    if (filter !== "all") params.set("status", filter);

    setLoading(true);
    fetch(`/api/effects?${params.toString()}`)
      .then((r) => r.json())
      .then((list) => {
        if (cancelled) return;
        setEffects(Array.isArray(list) ? list.slice(-MAX_ROWS) : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => { cancelled = true; };
  }, [open, intentsCsv, limit, skipSeed, filter]);

  // SSE stream: apply события поверх загруженной базы. Фильтруем на
  // клиенте по тем же критериям — SSE отдаёт всё, а мы только релевант.
  useEffect(() => {
    if (!open) return;
    const es = new EventSource("/api/effects/stream");
    esRef.current = es;

    const passesFilter = (e) => {
      if (!e) return false;
      if (intentIds && intentIds.size > 0) {
        const isSystem = e.intent_id === "_seed" || e.intent_id === "_sync";
        if (!intentIds.has(e.intent_id) && !(isSystem && !skipSeed)) return false;
      } else if (skipSeed && (e.intent_id === "_seed" || e.intent_id === "_sync")) {
        return false;
      }
      if (filter !== "all" && e.status !== filter) return false;
      return true;
    };

    es.addEventListener("effect", (evt) => {
      try {
        const e = JSON.parse(evt.data);
        if (!passesFilter(e)) return;
        setEffects((prev) => {
          const idx = prev.findIndex((p) => p.id === e.id);
          let next;
          if (idx >= 0) { next = [...prev]; next[idx] = e; }
          else next = [...prev, e];
          return next.length > MAX_ROWS ? next.slice(-MAX_ROWS) : next;
        });
      } catch {}
    });
    es.addEventListener("effect:rejected", (evt) => {
      try {
        const { id } = JSON.parse(evt.data);
        setEffects((prev) => prev.map((p) => (p.id === id ? { ...p, status: "rejected" } : p)));
      } catch {}
    });
    return () => { es.close(); esRef.current = null; };
  }, [open, intentIds, skipSeed, filter]);

  // Периодический total count (не ломает главный поток, агрегат).
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const fetchCount = () => {
      const params = new URLSearchParams();
      if (intentsCsv) params.set("intents", intentsCsv);
      params.set("includeSeed", skipSeed ? "0" : "1");
      fetch(`/api/effects?${params.toString()}`)
        .then((r) => r.json())
        .then((list) => {
          if (!cancelled && Array.isArray(list)) setTotalCount(list.length);
        })
        .catch(() => {});
    };
    fetchCount();
    const t = setInterval(fetchCount, 8000);
    return () => { cancelled = true; clearInterval(t); };
  }, [open, intentsCsv, skipSeed]);

  const visible = useMemo(() => [...effects].reverse(), [effects]);

  const stats = useMemo(() => {
    const byStatus = { proposed: 0, confirmed: 0, rejected: 0 };
    for (const e of effects) byStatus[e.status] = (byStatus[e.status] || 0) + 1;
    return byStatus;
  }, [effects]);

  const pillStyle = (active) => ({
    padding: "3px 10px", fontSize: 11, borderRadius: 12, cursor: "pointer",
    background: active ? "#4338ca" : "transparent",
    color: active ? "white" : "#94a3b8",
    border: `1px solid ${active ? "#4338ca" : "#334155"}`,
    fontFamily: "inherit",
  });

  const canLoadMore = totalCount !== null && effects.length < totalCount && limit < 5000;

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
              <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
                Φ · {domain}
                {totalCount !== null && (
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 400, marginLeft: 8 }}>
                    {effects.length} / {totalCount}
                  </span>
                )}
              </div>
              <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 16, cursor: "pointer", padding: 0 }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <button onClick={() => setFilter("all")} style={pillStyle(filter === "all")}>
                Все
              </button>
              <button onClick={() => setFilter("confirmed")} style={pillStyle(filter === "confirmed")}>
                ● confirmed{filter === "all" ? ` · ${stats.confirmed}` : ""}
              </button>
              <button onClick={() => setFilter("proposed")} style={pillStyle(filter === "proposed")}>
                ● proposed{filter === "all" ? ` · ${stats.proposed}` : ""}
              </button>
              <button onClick={() => setFilter("rejected")} style={pillStyle(filter === "rejected")}>
                ● rejected{filter === "all" ? ` · ${stats.rejected}` : ""}
              </button>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#94a3b8", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={!skipSeed}
                onChange={(e) => setSkipSeed(!e.target.checked)}
                style={{ cursor: "pointer", accentColor: "#6366f1" }}
              />
              <span>Показывать _seed / _sync</span>
            </label>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
            {loading && effects.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: 32 }}>Загрузка…</div>
            ) : visible.length === 0 ? (
              <div style={{ color: "#64748b", fontSize: 13, textAlign: "center", padding: 32, lineHeight: 1.6 }}>
                {filter === "all" ? "Пока эффектов нет" : `Нет эффектов со статусом «${filter}»`}
              </div>
            ) : (
              <>
                {visible.map((eff) => <EffectRow key={eff.id} eff={eff} />)}
                {canLoadMore && (
                  <button
                    onClick={() => setLimit(limit < 1000 ? 1000 : 5000)}
                    style={{
                      width: "100%", padding: "10px 12px", marginTop: 6,
                      background: "transparent", border: "1px dashed #334155",
                      borderRadius: 6, color: "#94a3b8", fontSize: 12, cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    Показать ещё (до {limit < 1000 ? "1000" : "5000"})
                  </button>
                )}
                {!canLoadMore && totalCount !== null && effects.length >= totalCount && effects.length >= 500 && (
                  <div style={{ color: "#64748b", fontSize: 11, textAlign: "center", padding: "10px 0" }}>
                    Все {totalCount} эффектов загружены
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
