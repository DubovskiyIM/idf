/*
 * Кристаллизованная проекция: voting_matrix
 * Источник: PROJECTIONS.voting_matrix — "участники × варианты → голоса"
 * Намерения: vote_yes, vote_no (матрица обеспечивает контекст)
 * Классическая Doodle-матрица: строки = участники, столбцы = варианты.
 */

import { useMemo } from "react";
import { getStyles } from "./theme.js";

export default function VotingMatrixProjection({ world, theme = "light", variant = "clean" }) {
  const s = getStyles(theme, variant);

  const polls = world.polls || [];
  const options = world.options || [];
  const participants = world.participants || [];
  const votes = world.votes || [];

  // Показываем матрицу для первого open/closed/resolved опроса
  const activePoll = polls.find(p => ["open", "closed", "resolved"].includes(p.status));

  const pollOptions = useMemo(() => activePoll ? options.filter(o => o.pollId === activePoll.id) : [], [activePoll, options]);
  const pollParticipants = useMemo(() => activePoll ? participants.filter(p => p.pollId === activePoll.id) : [], [activePoll, participants]);
  const pollVotes = useMemo(() => activePoll ? votes.filter(v => v.pollId === activePoll.id) : [], [activePoll, votes]);

  const getVote = (participantId, optionId) => pollVotes.find(v => v.participantId === participantId && v.optionId === optionId);

  // Подсчёт по столбцам
  const columnTotals = useMemo(() => {
    const t = {};
    for (const opt of pollOptions) {
      const ov = pollVotes.filter(v => v.optionId === opt.id);
      t[opt.id] = { yes: ov.filter(v => v.value === "yes").length, no: ov.filter(v => v.value === "no").length };
    }
    return t;
  }, [pollOptions, pollVotes]);

  if (!activePoll) return (
    <div style={{ textAlign: "center", padding: 40, ...s.text() }}>Нет активного опроса для отображения матрицы</div>
  );

  return (
    <div style={s.container}>
      <h2 style={{ ...s.heading("h1"), marginBottom: s.v.gap }}>
        Матрица: {activePoll.title}
        <span style={{ ...s.badge(activePoll.status), marginLeft: 8 }}>{activePoll.status}</span>
      </h2>

      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: s.v.font }}>
          <thead>
            <tr>
              <th style={{ padding: s.v.padding / 2, textAlign: "left", borderBottom: `2px solid ${s.t.border}`, ...s.text("small") }}>Участник</th>
              {pollOptions.map(opt => (
                <th key={opt.id} style={{ padding: s.v.padding / 2, textAlign: "center", borderBottom: `2px solid ${s.t.border}`, ...s.text("small"), minWidth: 80 }}>
                  <div>{opt.date}</div>
                  <div style={{ fontWeight: 600, color: s.t.text }}>{opt.startTime}–{opt.endTime}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pollParticipants.map(part => (
              <tr key={part.id}>
                <td style={{ padding: s.v.padding / 2, borderBottom: `1px solid ${s.t.border}`, fontWeight: 600, color: s.t.text, fontSize: s.v.fontSize.body }}>
                  {part.name}
                </td>
                {pollOptions.map(opt => {
                  const vote = getVote(part.id, opt.id);
                  return (
                    <td key={opt.id} style={{
                      padding: s.v.padding / 2, textAlign: "center", borderBottom: `1px solid ${s.t.border}`,
                      background: vote ? (vote.value === "yes" ? s.t.successBg : s.t.dangerBg) : "transparent",
                    }}>
                      {vote ? (
                        <span style={{ fontSize: s.v.fontSize.body, fontWeight: 700, color: vote.value === "yes" ? s.t.success : s.t.danger }}>
                          {vote.value === "yes" ? "✓" : "✕"}
                        </span>
                      ) : (
                        <span style={{ color: s.t.textMuted, fontSize: s.v.fontSize.small }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {/* Итого */}
            <tr>
              <td style={{ padding: s.v.padding / 2, fontWeight: 700, color: s.t.text, fontSize: s.v.fontSize.small, borderTop: `2px solid ${s.t.border}` }}>Итого</td>
              {pollOptions.map(opt => {
                const ct = columnTotals[opt.id] || { yes: 0, no: 0 };
                const total = pollParticipants.length;
                const pct = total > 0 ? Math.round((ct.yes / total) * 100) : 0;
                return (
                  <td key={opt.id} style={{ padding: s.v.padding / 2, textAlign: "center", borderTop: `2px solid ${s.t.border}` }}>
                    <div style={{ fontSize: s.v.fontSize.body, fontWeight: 700, color: pct >= 50 ? s.t.success : s.t.danger }}>{pct}%</div>
                    <div style={{ fontSize: s.v.fontSize.tiny, color: s.t.textMuted }}>{ct.yes}✓ {ct.no}✕</div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
