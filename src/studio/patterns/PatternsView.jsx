import React, { useEffect, useState } from "react";
import { fetchCatalog } from "../api/patterns.js";
import PatternList from "./PatternList.jsx";
import PatternDetail from "./PatternDetail.jsx";
import FalsificationPanel from "./FalsificationPanel.jsx";

// Трёхколоночный layout: список паттернов | detail | falsification.
// Высота вычитает tab-strip (44px), чтобы все три колонки вмещались без
// прокрутки внешнего контейнера — вертикальный скролл живёт внутри колонок.
export default function PatternsView() {
  const [patterns, setPatterns] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCatalog()
      .then((data) => {
        // /catalog возвращает { stable, candidate, anti }; для UI разворачиваем
        // в единый массив, статус остаётся на каждом паттерне.
        const all = [
          ...(data.stable || []),
          ...(data.candidate || []),
          ...(data.anti || []),
        ];
        setPatterns(all);
      })
      .catch((e) => setError(e.message));
  }, []);

  const current = patterns.find((p) => p.id === selected) || null;

  if (error) {
    return (
      <div style={{ padding: 24, color: "#f87171" }}>
        Ошибка загрузки каталога: {error}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "280px 1fr 380px",
        height: "calc(100vh - 44px)",
        background: "#0f172a",
        color: "#e2e8f0",
      }}
    >
      <PatternList
        patterns={patterns}
        selected={selected}
        onSelect={setSelected}
      />
      <PatternDetail pattern={current} />
      <FalsificationPanel patternId={selected} />
    </div>
  );
}
