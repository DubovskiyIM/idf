import React, { useEffect, useMemo, useState, useCallback } from "react";
import { fetchCatalog } from "../api/patterns.js";
import { fetchAllPromotions } from "../api/promotions.js";
import PatternList from "./PatternList.jsx";
import PatternDetail from "./PatternDetail.jsx";
import FalsificationPanel from "./FalsificationPanel.jsx";
import PatternWorkflowDiagram from "./PatternWorkflowDiagram.jsx";
import PatternStructureDiagram from "./PatternStructureDiagram.jsx";
import PromotionPanel from "./PromotionPanel.jsx";
import PromotionRequestForm from "./PromotionRequestForm.jsx";
import HeatmapView from "./HeatmapView.jsx";
import PromoteToPrButton from "./PromoteToPrButton.jsx";
import MarkShippedRecovery from "./MarkShippedRecovery.jsx";
import SimilarStableHint from "./SimilarStableHint.jsx";

// Pattern Curator workspace v2 — редизайн после первого UX-фидбека.
//
// Two modes (top-bar toggle):
//   patterns (default) — листать каталог, читать детали, request promotion
//   inbox             — разбирать promotion очередь (pending → approve/reject → ship)
//
// Layout:
//   ┌─────────────────────────────────────────────────────────────┐
//   │ Pattern Curator · 49 stable · 350 cand · ⏵ inbox 0 ⏷  Reload│  ~36px
//   ├──────────┬──────────────────────────────────────────────────┤
//   │ Search   │  pattern-id · archetype  [progress chips]        │
//   │ ──────── │  [Overview Structure Falsification Promotions]   │
//   │ ▼ STABLE │ ──────────────────────────────────────────────── │
//   │  · …     │  активная вкладка (большая, hot path)            │
//   │ ▼ CAND   │                                                  │
//   │  · …     │                                                  │
//   └──────────┴──────────────────────────────────────────────────┘
//
// В inbox-режиме весь body занимает PromotionPanel.

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "structure", label: "Structure" },
  { id: "falsification", label: "Falsification" },
  { id: "promotions", label: "Promotions" },
];

function StatChip({ label, value, color }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 10,
        fontSize: 11,
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        background: "#0b1220",
        border: "1px solid #1e293b",
        color: "#94a3b8",
      }}
    >
      <span style={{ color, fontWeight: 600 }}>{value}</span>
      <span>{label}</span>
    </span>
  );
}

function TopBar({ stats, mode, onMode, onReload, loading }) {
  const inboxCount = stats.pending + stats.approved;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 14px",
        height: 36,
        background: "#0b1220",
        borderBottom: "1px solid #1e293b",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "#e0e7ff",
          fontFamily: "ui-monospace, 'SF Mono', monospace",
        }}
      >
        Pattern Curator
      </span>
      <span style={{ display: "inline-flex", gap: 6 }}>
        <StatChip label="stable" value={stats.stable} color="#10b981" />
        <StatChip label="candidate" value={stats.candidate} color="#fbbf24" />
        <StatChip label="anti" value={stats.anti} color="#f87171" />
      </span>
      <div style={{ flex: 1 }} />
      <div style={{ display: "inline-flex", borderRadius: 6, overflow: "hidden", border: "1px solid #1e293b" }}>
        <button
          onClick={() => onMode("patterns")}
          style={modeBtn(mode === "patterns")}
        >
          Patterns
        </button>
        <button
          onClick={() => onMode("inbox")}
          style={modeBtn(mode === "inbox")}
        >
          Inbox
          {inboxCount > 0 && (
            <span
              style={{
                marginLeft: 6,
                background: "#fbbf24",
                color: "#020617",
                borderRadius: 8,
                padding: "0 6px",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {inboxCount}
            </span>
          )}
        </button>
        <button
          onClick={() => onMode("heatmap")}
          style={modeBtn(mode === "heatmap")}
        >
          Heatmap
        </button>
      </div>
      <button
        onClick={onReload}
        disabled={loading}
        style={{
          background: "transparent",
          border: "1px solid #1e293b",
          color: "#94a3b8",
          padding: "4px 10px",
          borderRadius: 6,
          fontSize: 11,
          cursor: loading ? "wait" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {loading ? "…" : "Reload"}
      </button>
    </div>
  );
}

function modeBtn(active) {
  return {
    background: active ? "#1e293b" : "transparent",
    border: "none",
    color: active ? "#e2e8f0" : "#94a3b8",
    padding: "4px 14px",
    fontSize: 11,
    fontWeight: active ? 600 : 500,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function tabBtn(active) {
  return {
    background: "transparent",
    border: "none",
    borderBottom: active ? "2px solid #60a5fa" : "2px solid transparent",
    color: active ? "#e2e8f0" : "#64748b",
    padding: "8px 14px",
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    cursor: "pointer",
    fontFamily: "inherit",
  };
}

function currentStageFor(pattern, promotions) {
  if (!pattern) return null;
  if (pattern.status === "stable") return "shipped";
  if (pattern.status === "anti") return "rejected";
  const promo = promotions.find((p) => p.candidateId === pattern.id);
  if (!promo) return "candidate";
  if (promo.status === "shipped") return "shipped";
  if (promo.status === "approved") return "approved";
  if (promo.status === "rejected") return "rejected";
  return "pending";
}

function PatternHeader({ pattern, promotions, tab, setTab, onPickPattern }) {
  const stage = currentStageFor(pattern, promotions);
  return (
    <div
      style={{
        padding: "10px 16px 0",
        borderBottom: "1px solid #1e293b",
        background: "#0b1220",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
        <span
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "#e2e8f0",
            fontFamily: "ui-monospace, 'SF Mono', monospace",
          }}
        >
          {pattern.id}
        </span>
        {pattern.archetype && (
          <span style={{ fontSize: 11, color: "#64748b" }}>
            archetype: <code style={{ color: "#cbd5e1" }}>{pattern.archetype}</code>
          </span>
        )}
        {pattern.refSource && (
          <span style={{ fontSize: 11, color: "#64748b" }}>
            ref: <code style={{ color: "#94a3b8" }}>{pattern.refSource}</code>
          </span>
        )}
        {pattern.status === "candidate" && (
          <SimilarStableHint pattern={pattern} onOpen={onPickPattern} />
        )}
        <div style={{ flex: 1 }} />
        <PatternWorkflowDiagram currentStage={stage} />
      </div>
      <div style={{ display: "flex", gap: 0 }}>
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} style={tabBtn(tab === t.id)}>
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PatternBody({ pattern, tab, promotions, onChange }) {
  const [showRequestForm, setShowRequestForm] = useState(false);
  const myPromotions = useMemo(
    () => promotions.filter((p) => p.candidateId === pattern.id),
    [promotions, pattern.id],
  );

  if (tab === "structure") {
    return (
      <div style={{ padding: 16, overflowY: "auto" }}>
        <PatternStructureDiagram pattern={pattern} />
      </div>
    );
  }
  if (tab === "falsification") {
    return (
      <div style={{ padding: 0, overflowY: "auto" }}>
        <FalsificationPanel patternId={pattern.id} />
      </div>
    );
  }
  if (tab === "promotions") {
    // Для PromoteToPrButton — последний shipped promotion из Φ; если есть,
    // компонент при mount показывает persisted state (PR URL, ветка), а не
    // зелёную "сделай PR" второй раз. Reload-safe.
    const shipped = myPromotions
      .filter((p) => p.status === "shipped" && p.sdkPrUrl)
      .sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0))[0];
    return (
      <div style={{ padding: 16, overflowY: "auto" }}>
        {pattern.refSource && (
          <PromoteToPrButton pattern={pattern} existingPromotion={shipped} onPrCreated={onChange} />
        )}
        {!shipped && pattern.refSource && (
          <MarkShippedRecovery pattern={pattern} onRecorded={onChange} />
        )}
        {pattern.status === "candidate" && !showRequestForm && (
          <button
            onClick={() => setShowRequestForm(true)}
            style={{
              background: "#3b82f6",
              border: "none",
              color: "#f8fafc",
              padding: "8px 14px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "inherit",
              marginBottom: 12,
            }}
          >
            + Request promotion (in-host workflow)
          </button>
        )}
        {showRequestForm && (
          <div style={{ border: "1px solid #1e293b", borderRadius: 6, marginBottom: 12 }}>
            <PromotionRequestForm
              pattern={pattern}
              onSubmitted={() => {
                setShowRequestForm(false);
                onChange?.();
              }}
              onCancel={() => setShowRequestForm(false)}
            />
          </div>
        )}
        {myPromotions.length === 0 ? (
          <div style={{ color: "#475569", fontSize: 12 }}>
            Промоций по этому паттерну нет.
            {pattern.status === "candidate" ? " Запроси через кнопку выше." : ""}
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8, fontFamily: "ui-monospace, monospace" }}>
              История промоций ({myPromotions.length})
            </div>
            {myPromotions
              .slice()
              .sort((a, b) => (b.requestedAt || 0) - (a.requestedAt || 0))
              .map((p) => (
                <div
                  key={p.id}
                  style={{
                    background: "#0f172a",
                    border: "1px solid #1e293b",
                    borderRadius: 4,
                    padding: 10,
                    marginBottom: 6,
                    fontSize: 12,
                  }}
                >
                  <div style={{ color: "#cbd5e1", marginBottom: 4 }}>
                    <span style={{ fontFamily: "monospace" }}>{p.status}</span>
                    {" · "}
                    <span style={{ color: "#94a3b8" }}>weight {p.weight ?? 50}</span>
                    {" · "}
                    <span style={{ color: "#64748b" }}>{p.targetArchetype || "?"}</span>
                  </div>
                  {p.rationale && (
                    <div style={{ color: "#94a3b8", fontSize: 11 }}>{p.rationale}</div>
                  )}
                  {p.sdkPrUrl && (
                    <a
                      href={p.sdkPrUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "#60a5fa", fontSize: 11 }}
                    >
                      {p.sdkPrUrl}
                    </a>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    );
  }
  // overview (default)
  return (
    <div style={{ overflowY: "auto" }}>
      <PatternDetail pattern={pattern} />
    </div>
  );
}

function EmptyDetail({ mode }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#475569",
        fontSize: 13,
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div>Выбери паттерн слева →</div>
      {mode === "patterns" && (
        <div style={{ fontSize: 11, color: "#334155" }}>
          либо переключи в режим Inbox для разбора promotion'ов
        </div>
      )}
    </div>
  );
}

export default function CuratorWorkspace() {
  const [patterns, setPatterns] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState("overview");
  const [mode, setMode] = useState("patterns");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catalog, promos] = await Promise.all([
        fetchCatalog(),
        fetchAllPromotions(),
      ]);
      setPatterns([
        ...(catalog.stable || []),
        ...(catalog.candidate || []),
        ...(catalog.anti || []),
      ]);
      setPromotions(promos);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadAll();
  }, [reloadAll]);

  const current = useMemo(
    () => patterns.find((p) => p.id === selected) || null,
    [patterns, selected],
  );

  const stats = useMemo(() => {
    const stable = patterns.filter((p) => p.status === "stable").length;
    const candidate = patterns.filter((p) => p.status === "candidate").length;
    const anti = patterns.filter((p) => p.status === "anti").length;
    const pending = promotions.filter((p) => p.status === "pending").length;
    const approved = promotions.filter((p) => p.status === "approved").length;
    const shipped = promotions.filter((p) => p.status === "shipped").length;
    const rejected = promotions.filter((p) => p.status === "rejected").length;
    return { stable, candidate, anti, pending, approved, shipped, rejected };
  }, [patterns, promotions]);

  function pickFromPromotion(promotionId) {
    const promo = promotions.find((p) => p.id === promotionId);
    if (promo?.candidateId) {
      setSelected(promo.candidateId);
      setMode("patterns");
      setTab("promotions");
    }
  }

  if (error) {
    return (
      <div style={{ padding: 24, color: "#f87171", fontFamily: "ui-monospace, monospace" }}>
        Curator load error: {error}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 44px)",
        background: "#020617",
        color: "#e2e8f0",
      }}
    >
      <TopBar
        stats={stats}
        mode={mode}
        onMode={setMode}
        onReload={reloadAll}
        loading={loading}
      />

      {mode === "inbox" ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <PromotionPanel
            promotions={promotions}
            onChange={reloadAll}
            onPick={pickFromPromotion}
          />
        </div>
      ) : mode === "heatmap" ? (
        <div style={{ flex: 1, minHeight: 0 }}>
          <HeatmapView
            onPickPattern={(id) => {
              setSelected(id);
              setMode("patterns");
              setTab("structure");
            }}
            onBulkChange={reloadAll}
          />
        </div>
      ) : (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "300px 1fr", minHeight: 0 }}>
          {/* PatternList сам делает border-right + flex-column + inner scroll;
              ему нужна явная height:100%, иначе flex-children в grid-cell не
              растягиваются и внутренний overflowY:auto не активируется. */}
          <div style={{ height: "100%", minHeight: 0, display: "flex" }}>
            <PatternList
              patterns={patterns}
              selected={selected}
              onSelect={(id) => {
                setSelected(id);
                setTab("overview");
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, minHeight: 0 }}>
            {!current ? (
              <EmptyDetail mode={mode} />
            ) : (
              <>
                <PatternHeader
                  pattern={current}
                  promotions={promotions}
                  tab={tab}
                  setTab={setTab}
                  onPickPattern={(id) => {
                    setSelected(id);
                    setTab("structure");
                  }}
                />
                <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
                  <PatternBody
                    pattern={current}
                    tab={tab}
                    promotions={promotions}
                    onChange={reloadAll}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
