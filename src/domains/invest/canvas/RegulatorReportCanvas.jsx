/**
 * RegulatorReportCanvas — регуляторный отчёт с аудит-трейлом.
 *
 * Client-side "PDF" через print-ready HTML: вёрстка A4, print media
 * query убирает chrome, браузер генерирует PDF через Print → Save PDF.
 *
 * ⚠ §26 open item (manifesto): "document" как равноправная материализация
 *    наравне с пикселями / голосом / agent-API — это дизайн-вопрос.
 *    Текущая реализация — демо концепции, не production-решение.
 *
 * Что показывается:
 * - Список всех сделок за период
 * - Causal chain: кто инициировал (user / agent / rule), когда, какой ruleId
 * - Сводка: net P&L, количество автоматических сделок, использованные правила
 */

import { useMemo } from "react";

export default function RegulatorReportCanvas({ world, viewer }) {
  const data = useMemo(() => {
    const transactions = (world?.transactions || [])
      .filter(t => (t.userId === viewer?.id || !t.userId))
      .sort((a, b) => a.timestamp - b.timestamp);

    const netPnL = (world?.portfolios || [])
      .filter(p => p.userId === viewer?.id || !p.userId)
      .reduce((s, p) => s + (p.pnl || 0), 0);

    const byInitiator = transactions.reduce((acc, t) => {
      acc[t.initiatedBy || "user"] = (acc[t.initiatedBy || "user"] || 0) + 1;
      return acc;
    }, {});

    const rulesUsed = [...new Set(transactions.filter(t => t.ruleId).map(t => t.ruleId))];

    return { transactions, netPnL, byInitiator, rulesUsed };
  }, [world, viewer]);

  const now = new Date();
  const reportDate = now.toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      {/* Toolbar — скрывается при печати */}
      <div className="no-print" style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: "10px 20px", borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: "pointer",
            border: "1px solid var(--mantine-color-indigo-6, #6366f1)",
            background: "var(--mantine-color-indigo-6, #6366f1)", color: "#fff",
          }}
        >
          🖨 Печать / Save as PDF
        </button>
        <span style={{ fontSize: 12, color: "#6b7280" }}>
          Через Print → «Сохранить как PDF» в браузере
        </span>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .report-page { box-shadow: none !important; border: none !important; padding: 0 !important; }
          .report-table { page-break-inside: auto; }
          .report-table tr { page-break-inside: avoid; page-break-after: auto; }
        }
        .report-table { border-collapse: collapse; width: 100%; font-size: 12px; }
        .report-table th, .report-table td {
          padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: left;
        }
        .report-table th {
          background: #f9fafb; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #6b7280;
        }
        .report-table .tx-agent { background: #fef3c7; }
        .report-table .tx-rule { background: #fee2e2; }
      `}</style>

      <div className="report-page" style={{
        background: "white", color: "#1a1a2e",
        padding: "40px 48px", borderRadius: 4,
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        border: "1px solid #e5e7eb",
        fontFamily: "'Times New Roman', Times, serif",
      }}>
        {/* Заголовок отчёта */}
        <div style={{ borderBottom: "2px solid #1a1a2e", paddingBottom: 16, marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Регуляторный отчёт
          </div>
          <h1 style={{ fontSize: 24, margin: "8px 0 4px", fontWeight: 700 }}>
            Аудит операций инвестиционного счёта
          </h1>
          <div style={{ fontSize: 13, color: "#6b7280" }}>
            Клиент: {viewer?.name || viewer?.id || "—"} · Дата составления: {reportDate}
          </div>
        </div>

        {/* Сводка */}
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>1. Сводка</h2>
        <table className="report-table" style={{ marginBottom: 24 }}>
          <tbody>
            <tr><td style={{ width: 220 }}>Чистый P&L</td><td><strong>{data.netPnL.toLocaleString("ru")} ₽</strong></td></tr>
            <tr><td>Всего сделок</td><td>{data.transactions.length}</td></tr>
            <tr><td>Инициировано пользователем</td><td>{data.byInitiator.user || 0}</td></tr>
            <tr><td>Инициировано агентом</td><td>{data.byInitiator.agent || 0}</td></tr>
            <tr><td>Инициировано правилом</td><td>{data.byInitiator.rule || 0}</td></tr>
            <tr><td>Задействовано правил</td><td>{data.rulesUsed.length}</td></tr>
          </tbody>
        </table>

        {/* Таблица сделок */}
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>2. Все операции</h2>
        <table className="report-table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Актив</th>
              <th>Направление</th>
              <th>Кол-во</th>
              <th>Цена</th>
              <th>Сумма</th>
              <th>Инициатор</th>
              <th>Правило</th>
            </tr>
          </thead>
          <tbody>
            {data.transactions.map(t => (
              <tr key={t.id} className={t.initiatedBy === "agent" ? "tx-agent" : t.initiatedBy === "rule" ? "tx-rule" : ""}>
                <td>{new Date(t.timestamp).toLocaleDateString("ru")}</td>
                <td><code>{t.assetId}</code></td>
                <td>{t.α === "buy" ? "↗ BUY" : "↘ SELL"}</td>
                <td>{t.quantity}</td>
                <td>{Number(t.price).toLocaleString("ru")}</td>
                <td>{Number(t.total).toLocaleString("ru")} ₽</td>
                <td>{t.initiatedBy}</td>
                <td>{t.ruleId || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Правила */}
        {data.rulesUsed.length > 0 && (
          <>
            <h2 style={{ fontSize: 16, marginTop: 24, marginBottom: 12 }}>3. Задействованные правила (Rules Engine §22)</h2>
            <ul style={{ fontSize: 13, lineHeight: 1.7 }}>
              {data.rulesUsed.map(r => (
                <li key={r}><code>{r}</code></li>
              ))}
            </ul>
          </>
        )}

        {/* Нижний колонтитул */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid #e5e7eb",
                     fontSize: 10, color: "#9ca3af", lineHeight: 1.5 }}>
          Отчёт сгенерирован из Φ-журнала причинно-упорядоченных эффектов (§10 Intent-Driven Manifesto).
          Каждая операция восстановима через parent_id-цепочку.
          Для audit-trail полного деривационного дерева используйте CausalityGraph.
        </div>
      </div>
    </div>
  );
}
