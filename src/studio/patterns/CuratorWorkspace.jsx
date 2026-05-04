import React, { useEffect, useMemo, useState, useCallback } from "react";
import { fetchCatalog } from "../api/patterns.js";
import { fetchAllPromotions } from "../api/promotions.js";
import PatternList from "./PatternList.jsx";
import PatternDetail from "./PatternDetail.jsx";
import PatternWorkflowDiagram from "./PatternWorkflowDiagram.jsx";
import PatternStructureDiagram from "./PatternStructureDiagram.jsx";
import PromotionPanel from "./PromotionPanel.jsx";
import PromotionRequestForm from "./PromotionRequestForm.jsx";

// Curator workspace: dashboard + workflow + pattern selection + promotion queue.
// Layout:
//   ┌──────────────────────────────────────────────────────────────┐
//   │ stats card: candidate / pending / approved / shipped counts   │
//   ├──────────────────────────────────────────────────────────────┤
//   │ PatternWorkflowDiagram (SVG)                                  │
//   ├─────────────┬──────────────────────────────┬──────────────────┤
//   │ PatternList │ PatternDetail + Structure    │ PromotionPanel   │
//   │             │   + RequestPromotion form    │ (tabbed)         │
//   └─────────────┴──────────────────────────────┴──────────────────┘

function StatCard({ label, value, color }) {
  return (
    <div
      style={{
        background: "#0f172a",
        border: `1px solid ${color}`,
        borderRadius: 6,
        padding: "8px 12px",
        minWidth: 110,
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          color: "#94a3b8",
          letterSpacing: "0.08em",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 600, color, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function currentStageFor(pattern, promotions) {
  if (!pattern) return null;
  const status = pattern.status;
  if (status === "stable") return "shipped";
  if (status === "anti") return "rejected";
  // candidate → ищем promotion для этого id
  const promo = promotions.find((p) => p.candidateId === pattern.id);
  if (promo) {
    if (promo.status === "shipped") return "shipped";
    if (promo.status === "approved") return "approved";
    if (promo.status === "rejected") return "rejected";
    return "pending";
  }
  return "candidate";
}

export default function CuratorWorkspace() {
  const [patterns, setPatterns] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);

  const reloadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [catalog, promos] = await Promise.all([
        fetchCatalog(),
        fetchAllPromotions(),
      ]);
      const all = [
        ...(catalog.stable || []),
        ...(catalog.candidate || []),
        ...(catalog.anti || []),
      ];
      setPatterns(all);
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
    const candidates = patterns.filter((p) => p.status === "candidate").length;
    const pending = promotions.filter((p) => p.status === "pending").length;
    const approved = promotions.filter((p) => p.status === "approved").length;
    const shipped = promotions.filter((p) => p.status === "shipped").length;
    const rejected = promotions.filter((p) => p.status === "rejected").length;
    return { candidates, pending, approved, shipped, rejected };
  }, [patterns, promotions]);

  const stage = currentStageFor(current, promotions);

  function pickFromPromotion(promotionId) {
    const promo = promotions.find((p) => p.id === promotionId);
    if (promo?.candidateId) setSelected(promo.candidateId);
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
        display: "grid",
        gridTemplateRows: "auto auto 1fr",
        height: "calc(100vh - 44px)",
        background: "#020617",
        color: "#e2e8f0",
      }}
    >
      {/* Stats card row */}
      <div
        style={{
          display: "flex",
          gap: 12,
          padding: 12,
          borderBottom: "1px solid #1e293b",
          alignItems: "center",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#e0e7ff",
            marginRight: 12,
            fontFamily: "ui-monospace, monospace",
          }}
        >
          Pattern Curator
        </div>
        <StatCard label="Candidates" value={stats.candidates} color="#fbbf24" />
        <StatCard label="Pending" value={stats.pending} color="#fbbf24" />
        <StatCard label="Approved" value={stats.approved} color="#34d399" />
        <StatCard label="Shipped" value={stats.shipped} color="#10b981" />
        <StatCard label="Rejected" value={stats.rejected} color="#f87171" />
        <div style={{ flex: 1 }} />
        <button
          onClick={reloadAll}
          disabled={loading}
          style={{
            background: "transparent",
            border: "1px solid #334155",
            color: "#94a3b8",
            padding: "6px 12px",
            borderRadius: 4,
            fontSize: 11,
            cursor: loading ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {loading ? "…" : "Reload"}
        </button>
      </div>

      {/* Workflow diagram */}
      <div style={{ padding: 12, borderBottom: "1px solid #1e293b" }}>
        <PatternWorkflowDiagram currentStage={stage} compact={false} />
      </div>

      {/* Three-column body */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "260px 1fr 380px",
          minHeight: 0,
        }}
      >
        <div style={{ borderRight: "1px solid #1e293b", overflow: "hidden" }}>
          <PatternList
            patterns={patterns}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              setShowRequestForm(false);
            }}
          />
        </div>

        <div style={{ overflowY: "auto", borderRight: "1px solid #1e293b" }}>
          {current ? (
            <div>
              <div style={{ padding: 12, borderBottom: "1px solid #1e293b" }}>
                <PatternStructureDiagram pattern={current} />
              </div>
              {current.status === "candidate" && !showRequestForm && (
                <div style={{ padding: 12, borderBottom: "1px solid #1e293b" }}>
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
                    }}
                  >
                    Request promotion → stable
                  </button>
                </div>
              )}
              {showRequestForm && (
                <div style={{ borderBottom: "1px solid #1e293b", background: "#0b1220" }}>
                  <PromotionRequestForm
                    pattern={current}
                    onSubmitted={() => {
                      setShowRequestForm(false);
                      reloadAll();
                    }}
                    onCancel={() => setShowRequestForm(false)}
                  />
                </div>
              )}
              <PatternDetail pattern={current} />
            </div>
          ) : (
            <div style={{ padding: 24, color: "#64748b", fontSize: 13 }}>
              Выбери паттерн слева — увидишь structure-diagram и promotion-controls.
            </div>
          )}
        </div>

        <div style={{ minHeight: 0 }}>
          <PromotionPanel
            promotions={promotions}
            onChange={reloadAll}
            onPick={pickFromPromotion}
          />
        </div>
      </div>
    </div>
  );
}
