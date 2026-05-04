import React, { useState } from "react";
import {
  approvePromotion,
  rejectPromotion,
  shipPromotion,
  updatePromotionWeight,
  groupCompeting,
} from "../api/promotions.js";

// Tabbed panel для PatternPromotion lifecycle.
//   pending  — Approve / Reject inline + weight slider
//   approved — Ship inline (modal с sdkPrUrl)
//   shipped  — read-only с PR-link, badge __irr=high
//   rejected — read-only с rationale

const STATUSES = ["pending", "approved", "shipped", "rejected"];

const STATUS_BADGE = {
  pending: { color: "#fbbf24", label: "Pending" },
  approved: { color: "#34d399", label: "Approved" },
  shipped: { color: "#10b981", label: "Shipped" },
  rejected: { color: "#f87171", label: "Rejected" },
};

function fmtDate(ms) {
  if (!ms) return "—";
  return new Date(ms).toISOString().slice(0, 10);
}

function CompetingBlock({ competing, onPickPromotion }) {
  const arches = Object.keys(competing);
  if (arches.length === 0) return null;
  return (
    <div
      style={{
        background: "#1e293b",
        border: "1px solid #f59e0b",
        borderRadius: 6,
        padding: 10,
        marginBottom: 12,
      }}
    >
      <div style={{ color: "#fbbf24", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
        ⚠ Competing pending для одного archetype'а — разрули весом
      </div>
      {arches.map((a) => (
        <div key={a} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>
            {a}: {competing[a].length} pending
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            {competing[a].map((p) => (
              <button
                key={p.id}
                onClick={() => onPickPromotion(p.id)}
                style={{
                  background: "#0f172a",
                  border: "1px solid #334155",
                  borderRadius: 4,
                  padding: "4px 8px",
                  fontSize: 11,
                  color: "#cbd5e1",
                  cursor: "pointer",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {p.candidateId?.slice(0, 24) || p.id.slice(0, 8)}
                {" "}
                <span style={{ color: "#fbbf24" }}>
                  {Math.round(p.weightShare * 100)}%
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PendingRow({ p, onAction, busyId }) {
  const [weight, setWeight] = useState(p.weight ?? 50);
  const busy = busyId === p.id;
  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 6,
        padding: 10,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: "ui-monospace, monospace", color: "#e2e8f0", fontSize: 13 }}>
          {p.candidateId || "—"}
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          → {p.targetArchetype || "?"} · {fmtDate(p.requestedAt)}
        </span>
      </div>
      {p.rationale && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, lineHeight: 1.4 }}>
          {p.rationale.slice(0, 220)}
          {p.rationale.length > 220 ? "…" : ""}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>weight</span>
        <input
          type="range"
          min={0}
          max={100}
          value={weight}
          onChange={(e) => setWeight(Number(e.target.value))}
          onMouseUp={() => weight !== p.weight && updatePromotionWeight(p.id, weight)}
          style={{ flex: 1 }}
        />
        <span
          style={{
            fontSize: 11,
            color: weight === p.weight ? "#94a3b8" : "#fbbf24",
            fontFamily: "ui-monospace, monospace",
            minWidth: 28,
            textAlign: "right",
          }}
        >
          {weight}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        <button
          disabled={busy}
          onClick={() => onAction("approve", p.id)}
          style={btnStyle("#10b981", busy)}
        >
          Approve
        </button>
        <button
          disabled={busy}
          onClick={() => onAction("reject", p.id)}
          style={btnStyle("#dc2626", busy)}
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function ApprovedRow({ p, onAction, busyId }) {
  const [showShip, setShowShip] = useState(false);
  const [url, setUrl] = useState("");
  const busy = busyId === p.id;
  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 6,
        padding: 10,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontFamily: "ui-monospace, monospace", color: "#e2e8f0", fontSize: 13 }}>
          {p.candidateId || "—"}
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          weight {p.weight ?? 50} · {fmtDate(p.decidedAt || p.requestedAt)}
        </span>
      </div>
      {!showShip ? (
        <button
          disabled={busy}
          onClick={() => setShowShip(true)}
          style={btnStyle("#3b82f6", busy)}
        >
          Ship → SDK
        </button>
      ) : (
        <div>
          <div style={{ fontSize: 10, color: "#fbbf24", marginBottom: 4 }}>
            ⚠ ship_pattern_promotion имеет __irr=high — после shipped откат через SDK-revert.
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="SDK PR URL (https://github.com/.../pull/N)"
            style={{
              width: "100%",
              background: "#020617",
              border: "1px solid #334155",
              borderRadius: 4,
              padding: "6px 8px",
              color: "#e2e8f0",
              fontSize: 12,
              fontFamily: "ui-monospace, monospace",
              marginBottom: 6,
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              disabled={busy || !url.trim()}
              onClick={() => onAction("ship", p.id, url)}
              style={btnStyle("#10b981", busy || !url.trim())}
            >
              Confirm Ship
            </button>
            <button onClick={() => setShowShip(false)} style={btnStyle("#475569", false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReadOnlyRow({ p }) {
  return (
    <div
      style={{
        background: "#0f172a",
        border: "1px solid #1e293b",
        borderRadius: 6,
        padding: 10,
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontFamily: "ui-monospace, monospace", color: "#e2e8f0", fontSize: 13 }}>
          {p.candidateId || "—"}
        </span>
        <span style={{ fontSize: 11, color: "#64748b" }}>{fmtDate(p.decidedAt)}</span>
      </div>
      {p.sdkPrUrl && (
        <a
          href={p.sdkPrUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 11, color: "#60a5fa", display: "block", marginTop: 4 }}
        >
          {p.sdkPrUrl}
        </a>
      )}
    </div>
  );
}

function btnStyle(bg, disabled) {
  return {
    background: disabled ? "#334155" : bg,
    border: "none",
    color: disabled ? "#64748b" : "#f8fafc",
    padding: "6px 12px",
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
  };
}

export default function PromotionPanel({ promotions, onChange, onPick }) {
  const [activeTab, setActiveTab] = useState("pending");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  const buckets = STATUSES.reduce((acc, s) => {
    acc[s] = promotions.filter((p) => (p.status || "pending") === s);
    return acc;
  }, {});
  const competing = groupCompeting(promotions);

  async function onAction(kind, id, extra) {
    setBusyId(id);
    setError(null);
    try {
      if (kind === "approve") await approvePromotion(id);
      else if (kind === "reject") await rejectPromotion(id);
      else if (kind === "ship") await shipPromotion(id, extra);
      onChange?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", borderBottom: "1px solid #1e293b" }}>
        {STATUSES.map((s) => {
          const badge = STATUS_BADGE[s];
          const count = buckets[s].length;
          return (
            <button
              key={s}
              onClick={() => setActiveTab(s)}
              style={{
                padding: "8px 12px",
                background: activeTab === s ? "#1e293b" : "transparent",
                border: "none",
                borderBottom: activeTab === s ? `2px solid ${badge.color}` : "2px solid transparent",
                color: activeTab === s ? "#e2e8f0" : "#64748b",
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {badge.label} {count > 0 ? <span style={{ color: badge.color }}>{count}</span> : ""}
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{ padding: 8, background: "#7f1d1d", color: "#fef2f2", fontSize: 12 }}>
          ✗ {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
        {activeTab === "pending" && (
          <CompetingBlock competing={competing} onPickPromotion={(id) => onPick?.(id)} />
        )}
        {buckets[activeTab].length === 0 ? (
          <div style={{ color: "#475569", fontSize: 12, textAlign: "center", padding: 20 }}>
            Пусто. {activeTab === "pending" ? "Запроси промоцию через карточку паттерна." : ""}
          </div>
        ) : (
          buckets[activeTab].map((p) => {
            if (activeTab === "pending") {
              return <PendingRow key={p.id} p={p} onAction={onAction} busyId={busyId} />;
            }
            if (activeTab === "approved") {
              return <ApprovedRow key={p.id} p={p} onAction={onAction} busyId={busyId} />;
            }
            return <ReadOnlyRow key={p.id} p={p} />;
          })
        )}
      </div>
    </div>
  );
}
