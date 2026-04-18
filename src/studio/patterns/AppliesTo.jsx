import React, { useEffect, useState } from "react";
import { explainProjection } from "../api/patterns.js";

// Hardcoded список всех доменов прототипа (9 шт). Соответствует каталогу
// src/domains/*. Если добавится новый домен — надо обновить этот массив.
// Альтернатива (endpoint /api/patterns/domains) пока не оправдана: эволюция
// редкая, и домены лежат в src, а не в БД.
const DOMAINS = [
  "invest",
  "planning",
  "delivery",
  "reflect",
  "lifequest",
  "sales",
  "booking",
  "workflow",
  "messenger",
];

async function fetchProjections(domain) {
  const res = await fetch(
    `/api/patterns/projections?domain=${encodeURIComponent(domain)}`,
  );
  if (!res.ok) return [];
  const body = await res.json().catch(() => null);
  return Array.isArray(body?.projections) ? body.projections : [];
}

// Раздел внутри PatternDetail: live-скан «где этот паттерн матчится на
// реальных проекциях». Триггерится вручную кнопкой (обход всех доменов ×
// проекций даёт десятки HTTP-запросов, так что не авто). Результат кэшируется
// в state до следующего клика. При смене patternId — state сбрасывается.
export default function AppliesTo({ patternId }) {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [scanned, setScanned] = useState(false);

  // Сброс при смене выбранного паттерна.
  useEffect(() => {
    setMatches([]);
    setScanned(false);
    setProgress(null);
  }, [patternId]);

  async function run() {
    if (!patternId || loading) return;
    setLoading(true);
    setMatches([]);
    setScanned(false);
    const result = [];
    let done = 0;
    for (const domain of DOMAINS) {
      setProgress({ domain, done, total: DOMAINS.length });
      const projections = await fetchProjections(domain);
      for (const projection of projections) {
        try {
          const r = await explainProjection(domain, projection);
          const matched = r?.structural?.matched || [];
          if (matched.some((m) => m?.pattern?.id === patternId)) {
            result.push({ domain, projection });
          }
        } catch {
          // скипаем одну проекцию, сканирование продолжается
        }
      }
      done += 1;
      setProgress({ domain, done, total: DOMAINS.length });
    }
    setMatches(result);
    setScanned(true);
    setProgress(null);
    setLoading(false);
  }

  return (
    <section style={{ marginTop: 24 }}>
      <h3
        style={{
          margin: "0 0 8px",
          fontSize: 13,
          color: "#e2e8f0",
          letterSpacing: 0.3,
          textTransform: "uppercase",
        }}
      >
        Applies to (live)
      </h3>
      <button
        onClick={run}
        disabled={loading || !patternId}
        style={{
          background: loading ? "#1e293b" : "#1d4ed8",
          color: "#e0e7ff",
          border: "1px solid #334155",
          borderRadius: 4,
          padding: "6px 12px",
          fontSize: 12,
          cursor: loading || !patternId ? "default" : "pointer",
        }}
      >
        {loading ? "Scanning…" : "Scan all domains"}
      </button>
      {progress && (
        <span style={{ marginLeft: 10, fontSize: 11, color: "#64748b" }}>
          {progress.done}/{progress.total} · {progress.domain}
        </span>
      )}
      {scanned && matches.length === 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
          Не найдено ни одной проекции с этим паттерном.
        </div>
      )}
      {matches.length > 0 && (
        <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
          {matches.map((m) => (
            <li key={`${m.domain}/${m.projection}`} style={{ marginBottom: 3 }}>
              <a
                href={`/?domain=${encodeURIComponent(m.domain)}&projection=${encodeURIComponent(m.projection)}&inspect=${encodeURIComponent(patternId)}`}
                target="_blank"
                rel="noreferrer"
                style={{ color: "#60a5fa", textDecoration: "none" }}
              >
                <code>
                  {m.domain}/{m.projection}
                </code>{" "}
                ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
