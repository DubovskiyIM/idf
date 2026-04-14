/**
 * AdvisorReviewCanvas — обзор клиентов advisor'а.
 *
 * Many-to-many через Assignment entity (советник ↔ клиенты).
 * Виртуальный фильтр на клиенте: показывает только тех, кто связан с
 * viewer'ом через active assignment.
 *
 * ⚠ Server-side many-to-many ownership — §26.1 open item. Серверный
 *   filterWorld пока не поддерживает via-assignment scope.
 */

import { useState, useMemo } from "react";
import { Chart } from "../../../runtime/renderer/primitives/chart.jsx";
import { getAdaptedComponent } from "../../../runtime/renderer/adapters/registry.js";

export default function AdvisorReviewCanvas({ world, viewer, exec }) {
  // Клиентский фильтр many-to-many: advisorId = viewer.id. Demo-режим с
  // advisorId=null даёт доступ любому залогиненному до server-side
  // via-assignment (§26.1 open item).
  const assignments = (world?.assignments || [])
    .filter(a => (a.advisorId === viewer?.id || !a.advisorId) && a.status !== "ended");

  const [selectedClientId, setSelectedClientId] = useState(
    assignments[0]?.clientId || null
  );

  // Сбор данных по выбранному клиенту
  const clientData = useMemo(() => {
    if (!selectedClientId) return null;
    return {
      user: (world?.users || []).find(u => u.id === selectedClientId),
      portfolios: (world?.portfolios || []).filter(p => p.userId === selectedClientId),
      goals: (world?.goals || []).filter(g => g.userId === selectedClientId),
      recommendations: (world?.recommendations || []).filter(r => r.userId === selectedClientId),
      alerts: (world?.alerts || []).filter(a => a.userId === selectedClientId),
      riskProfile: (world?.riskProfiles || []).find(r => r.userId === selectedClientId),
    };
  }, [selectedClientId, world]);

  const AdaptedPaper = getAdaptedComponent("primitive", "paper") || (({ children, style }) =>
    <div style={{ padding: 16, border: "1px solid #e5e7eb", borderRadius: 8, ...(style || {}) }}>{children}</div>);
  const AdaptedStatistic = getAdaptedComponent("primitive", "statistic");
  const AdaptedHeading = getAdaptedComponent("primitive", "heading") || (({ children }) => <h3>{children}</h3>);

  if (assignments.length === 0) {
    return (
      <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
        <AdaptedHeading level={2}>Обзор клиента</AdaptedHeading>
        <AdaptedPaper style={{ marginTop: 16, textAlign: "center", padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🤝</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 12 }}>
            У вас пока нет активных клиентов.
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>
            Создайте связь через «Мои клиенты» → Взять клиента (intent: assign_client).
          </div>
        </AdaptedPaper>
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* Левая колонка — список клиентов */}
        <div style={{ width: 260, flexShrink: 0 }}>
          <AdaptedHeading level={4}>Клиенты ({assignments.length})</AdaptedHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
            {assignments.map(a => {
              const client = (world?.users || []).find(u => u.id === a.clientId);
              const active = a.clientId === selectedClientId;
              return (
                <button
                  key={a.id}
                  onClick={() => setSelectedClientId(a.clientId)}
                  style={{
                    padding: "10px 14px", borderRadius: 8,
                    border: "1px solid",
                    borderColor: active ? "var(--mantine-color-indigo-6, #6366f1)" : "var(--mantine-color-default-border, #e5e7eb)",
                    background: active ? "rgba(99, 102, 241, 0.08)" : "transparent",
                    cursor: "pointer", textAlign: "left",
                    color: "var(--mantine-color-text, #111)",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{client?.name || a.clientId}</div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
                    {a.status === "paused" ? "⏸ на паузе" : a.status === "ended" ? "завершён" : "активен"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Правая колонка — dashboard выбранного клиента */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}>
          {clientData && (
            <>
              <AdaptedHeading level={2}>
                {clientData.user?.name || selectedClientId}
              </AdaptedHeading>

              {/* Статистика */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                {AdaptedStatistic ? (
                  <>
                    <AdaptedPaper>
                      <AdaptedStatistic title="Портфели" value={clientData.portfolios.length} />
                    </AdaptedPaper>
                    <AdaptedPaper>
                      <AdaptedStatistic
                        title="Суммарный P&L"
                        value={clientData.portfolios.reduce((s, p) => s + (p.pnl || 0), 0)}
                        prefix="₽"
                        trend={clientData.portfolios.reduce((s, p) => s + (p.pnl || 0), 0) >= 0 ? "up" : "down"}
                      />
                    </AdaptedPaper>
                    <AdaptedPaper>
                      <AdaptedStatistic title="Цели" value={clientData.goals.length} />
                    </AdaptedPaper>
                    <AdaptedPaper>
                      <AdaptedStatistic title="Alerts" value={clientData.alerts.filter(a => !a.acknowledged).length} />
                    </AdaptedPaper>
                  </>
                ) : (
                  <>
                    <AdaptedPaper><div style={{ fontSize: 12, color: "#6b7280" }}>Портфели</div><div style={{ fontSize: 24, fontWeight: 700 }}>{clientData.portfolios.length}</div></AdaptedPaper>
                    <AdaptedPaper><div style={{ fontSize: 12, color: "#6b7280" }}>P&L</div><div style={{ fontSize: 24, fontWeight: 700 }}>{clientData.portfolios.reduce((s, p) => s + (p.pnl || 0), 0).toLocaleString("ru")}</div></AdaptedPaper>
                    <AdaptedPaper><div style={{ fontSize: 12, color: "#6b7280" }}>Цели</div><div style={{ fontSize: 24, fontWeight: 700 }}>{clientData.goals.length}</div></AdaptedPaper>
                    <AdaptedPaper><div style={{ fontSize: 12, color: "#6b7280" }}>Alerts</div><div style={{ fontSize: 24, fontWeight: 700 }}>{clientData.alerts.filter(a => !a.acknowledged).length}</div></AdaptedPaper>
                  </>
                )}
              </div>

              {/* Аллокация через chart-primitive */}
              {clientData.portfolios.length > 0 && (
                <AdaptedPaper>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>Целевая аллокация портфелей</div>
                  {clientData.portfolios.map(p => (
                    <div key={p.id} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, marginBottom: 6, color: "#6b7280" }}>
                        {p.name} — {p.baseCurrency} · {p.riskProfile}
                      </div>
                      <Chart
                        node={{
                          chartType: "pie",
                          data: [
                            { type: "Акции", value: p.targetStocks || 0 },
                            { type: "Облигации", value: p.targetBonds || 0 },
                            { type: "Крипто", value: p.targetCrypto || 0 },
                            { type: "Экзотика", value: p.targetExotic || 0 },
                          ].filter(d => d.value > 0),
                          xField: "type",
                          yField: "value",
                          height: 180,
                        }}
                        ctx={{ world }}
                      />
                    </div>
                  ))}
                </AdaptedPaper>
              )}

              {/* Risk Profile */}
              {clientData.riskProfile && (
                <AdaptedPaper>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Профиль риска</div>
                  <div style={{ display: "flex", gap: 20, fontSize: 13 }}>
                    <div><span style={{ color: "#6b7280" }}>Уровень:</span> <b>{clientData.riskProfile.level}</b></div>
                    <div><span style={{ color: "#6b7280" }}>Score:</span> <b>{clientData.riskProfile.computedScore}</b></div>
                    <div><span style={{ color: "#6b7280" }}>Горизонт:</span> <b>{clientData.riskProfile.horizonYears} лет</b></div>
                    <div><span style={{ color: "#6b7280" }}>Tolerance:</span> <b>{clientData.riskProfile.lossTolerancePct}%</b></div>
                  </div>
                </AdaptedPaper>
              )}

              {/* Действия advisor */}
              <AdaptedPaper>
                <div style={{ fontWeight: 600, marginBottom: 12 }}>Действия</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => exec("create_recommendation_for_client", {
                      userId: selectedClientId,
                      source: "advisor",
                      type: "hold",
                      rationale: "Периодическая проверка — держим курс.",
                      confidence: 90,
                      status: "pending",
                    })}
                    style={btn(true)}
                  >
                    💡 Создать рекомендацию
                  </button>
                  <button
                    onClick={() => exec("send_client_message", {
                      userId: selectedClientId,
                      severity: "info",
                      message: `Сообщение от ${viewer?.name || "advisor"}: всё под контролем, до следующей встречи.`,
                      acknowledged: false,
                    })}
                    style={btn(false)}
                  >
                    ✉ Написать сообщение
                  </button>
                </div>
              </AdaptedPaper>

              {/* Последние рекомендации и alerts */}
              {clientData.recommendations.length > 0 && (
                <AdaptedPaper>
                  <div style={{ fontWeight: 600, marginBottom: 8 }}>Последние рекомендации ({clientData.recommendations.length})</div>
                  {clientData.recommendations.slice(0, 3).map(r => (
                    <div key={r.id} style={{ padding: "8px 0", borderTop: "1px solid #f3f4f6", fontSize: 13 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span><b>{r.type}</b> от {r.source}</span>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>{r.status}</span>
                      </div>
                      <div style={{ color: "#6b7280", marginTop: 2 }}>{r.rationale}</div>
                    </div>
                  ))}
                </AdaptedPaper>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function btn(primary) {
  return {
    padding: "8px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer",
    border: "1px solid",
    borderColor: primary ? "var(--mantine-color-indigo-6, #6366f1)" : "var(--mantine-color-default-border, #d1d5db)",
    background: primary ? "var(--mantine-color-indigo-6, #6366f1)" : "transparent",
    color: primary ? "#fff" : "var(--mantine-color-text, #111)",
  };
}
