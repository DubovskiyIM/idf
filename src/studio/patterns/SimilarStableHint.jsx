import React, { useEffect, useState } from "react";

// "Похож на X" hint для PatternHeader. Fetch'ит /api/patterns/similar
// при mount и при смене pattern.id; показывает top-1 матч с similarity
// score. Подсветка agressive начинается с 65% (порог "duplicate warning").
//
// Клик → onPick(stableId): родительский CuratorWorkspace открывает
// этот stable pattern в Patterns mode чтобы куратор сам сравнил
// trigger/structure/rationale в Structure tab.

const DUPLICATE_THRESHOLD = 0.65;

function fmtPct(score) {
  return `${Math.round((score || 0) * 100)}%`;
}

export default function SimilarStableHint({ patternId, onPick }) {
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!patternId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/patterns/similar?id=${encodeURIComponent(patternId)}&top=3`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setMatches(data.matches || []);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [patternId]);

  if (loading) return null;
  if (error) return null;
  if (!matches || matches.length === 0) return null;
  const top = matches[0];
  if (!top || !top.score || top.score < 0.1) return null; // ничего полезного

  const isDuplicate = top.score >= DUPLICATE_THRESHOLD;
  const color = isDuplicate ? "#fbbf24" : "#94a3b8";
  const bg = isDuplicate ? "#422006" : "#0f172a";

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 8px",
        background: bg,
        border: `1px solid ${isDuplicate ? "#fbbf24" : "#1e293b"}`,
        borderRadius: 12,
        fontSize: 11,
        fontFamily: "ui-monospace, 'SF Mono', monospace",
        color,
        cursor: "pointer",
      }}
      onClick={() => onPick?.(top.id)}
      title={
        `top-3:\n` +
        matches.map((m) => `  ${fmtPct(m.score)} · ${m.id}`).join("\n") +
        `\n\nКлик → открыть ${top.id}`
      }
    >
      {isDuplicate ? "⚠" : "≈"} stable: <strong>{top.id}</strong> ({fmtPct(top.score)})
    </div>
  );
}
