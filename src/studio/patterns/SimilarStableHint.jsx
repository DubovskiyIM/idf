import React, { useEffect, useState } from "react";
import PatternDiffModal from "./PatternDiffModal.jsx";

// "Похож на X" hint для PatternHeader. Fetch'ит /api/patterns/similar
// при mount, показывает top-1 stable. Клик → открывает PatternDiffModal
// со side-by-side сравнением (а не сразу переключает на stable).
//
// onOpen — fallback "Открыть stable в workspace" из модала; по умолчанию
// родительский CuratorWorkspace переключает selected + tab=structure.

const DUPLICATE_THRESHOLD = 0.65;

function fmtPct(score) {
  return `${Math.round((score || 0) * 100)}%`;
}

export default function SimilarStableHint({ pattern, onOpen }) {
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [diffWith, setDiffWith] = useState(null); // {pattern, similarity}

  const patternId = pattern?.id;

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

  async function openDiff(stableMatch) {
    // Подгружаем full stable pattern из catalog'а (similar даёт только id+score)
    try {
      const r = await fetch("/api/patterns/catalog");
      const data = await r.json();
      const stableFull = (data.stable || []).find((p) => p.id === stableMatch.id);
      if (!stableFull) {
        // Fallback: используем то, что было в matches
        setDiffWith({ pattern: stableMatch, similarity: stableMatch.score });
      } else {
        setDiffWith({ pattern: stableFull, similarity: stableMatch.score });
      }
    } catch {
      setDiffWith({ pattern: stableMatch, similarity: stableMatch.score });
    }
  }

  if (loading) return null;
  if (error) return null;
  if (!matches || matches.length === 0) return null;
  const top = matches[0];
  if (!top || !top.score || top.score < 0.1) return null;

  const isDuplicate = top.score >= DUPLICATE_THRESHOLD;
  const color = isDuplicate ? "#fbbf24" : "#94a3b8";
  const bg = isDuplicate ? "#422006" : "#0f172a";

  return (
    <>
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
        onClick={() => openDiff(top)}
        title={
          `top-3:\n` +
          matches.map((m) => `  ${fmtPct(m.score)} · ${m.id}`).join("\n") +
          `\n\nКлик → открыть side-by-side diff`
        }
      >
        {isDuplicate ? "⚠" : "≈"} stable: <strong>{top.id}</strong> ({fmtPct(top.score)})
      </div>
      {diffWith && (
        <PatternDiffModal
          candidate={pattern}
          stable={diffWith.pattern}
          similarity={diffWith.similarity}
          onClose={() => setDiffWith(null)}
          onOpenInWorkspace={(id) => {
            setDiffWith(null);
            onOpen?.(id);
          }}
        />
      )}
    </>
  );
}
