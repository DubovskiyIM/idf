/*
 * Кристаллизованная проекция: voting_matrix
 * Домен: planning · 17 намерений
 * Классическая Doodle-матрица + brutalist вариант (горизонтальные бары)
 * v1.0: change_vote, viewer, theme/variant
 */

import { useMemo } from "react";
import { getStyles } from "./theme.js";

export default function VotingMatrixProjection({ world, theme = "light", variant = "clean" }) {
  const s = getStyles(theme, variant);
  const polls = world.polls || [];
  const options = world.options || [];
  const participants = world.participants || [];
  const votes = world.votes || [];

  const activePoll = polls.find(p => ["open", "closed", "resolved"].includes(p.status));
  const pollOptions = useMemo(() => activePoll ? options.filter(o => o.pollId === activePoll.id) : [], [activePoll, options]);
  const pollParticipants = useMemo(() => activePoll ? participants.filter(p => p.pollId === activePoll.id && p.status !== "declined") : [], [activePoll, participants]);
  const pollVotes = useMemo(() => activePoll ? votes.filter(v => v.pollId === activePoll.id) : [], [activePoll, votes]);

  const getVote = (pid, oid) => pollVotes.find(v => v.participantId === pid && v.optionId === oid);
  const colTotals = useMemo(() => {
    const t = {};
    for (const opt of pollOptions) {
      const ov = pollVotes.filter(v => v.optionId === opt.id);
      t[opt.id] = { yes: ov.filter(v => v.value === "yes").length, no: ov.filter(v => v.value === "no").length, maybe: ov.filter(v => v.value === "maybe").length };
    }
    return t;
  }, [pollOptions, pollVotes]);

  if (!activePoll) return <div style={{ textAlign: "center", padding: 40, ...s.text() }}>Нет активного опроса</div>;

  // === BRUTALIST: горизонтальные бары вместо таблицы ===
  if (variant === "brutalist") {
    return (
      <div style={s.container}>
        <h2 style={{ ...s.heading("h1"), marginBottom: s.v.gap, borderBottom: `${s.v.borderWidth}px solid ${s.t.text}`, paddingBottom: s.v.gap }}>
          {activePoll.title}
        </h2>
        {pollOptions.map(opt => {
          const ct = colTotals[opt.id] || { yes: 0, no: 0, maybe: 0 };
          const total = pollParticipants.length;
          const yesPct = total > 0 ? (ct.yes / total) * 100 : 0;
          const maybePct = total > 0 ? (ct.maybe / total) * 100 : 0;
          const noPct = total > 0 ? (ct.no / total) * 100 : 0;
          return (
            <div key={opt.id} style={{ marginBottom: s.v.gap * 2, borderLeft: `${s.v.borderWidth}px solid ${s.t.text}`, paddingLeft: s.v.padding }}>
              <div style={{ ...s.heading("h2"), marginBottom: s.v.gap }}>{opt.date} {opt.startTime}</div>
              {/* Стacked bar */}
              <div style={{ display: "flex", height: 28, marginBottom: 4 }}>
                {yesPct > 0 && <div style={{ width: `${yesPct}%`, background: s.t.success, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: s.v.fontSize.small, fontWeight: 700, fontFamily: s.v.font }}>{ct.yes}✓</div>}
                {maybePct > 0 && <div style={{ width: `${maybePct}%`, background: s.t.warning, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: s.v.fontSize.small, fontWeight: 700, fontFamily: s.v.font }}>{ct.maybe}?</div>}
                {noPct > 0 && <div style={{ width: `${noPct}%`, background: s.t.danger, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: s.v.fontSize.small, fontWeight: 700, fontFamily: s.v.font }}>{ct.no}✕</div>}
                {(100 - yesPct - maybePct - noPct) > 0 && <div style={{ flex: 1, background: s.t.border }} />}
              </div>
              {/* Голоса поимённо */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                {pollParticipants.map(p => {
                  const v = getVote(p.id, opt.id);
                  return <span key={p.id} style={{ fontSize: s.v.fontSize.tiny, padding: "1px 6px", fontFamily: s.v.font,
                    background: v ? (v.value === "yes" ? s.t.success : v.value === "maybe" ? s.t.warning : s.t.danger) : s.t.border,
                    color: v ? "#fff" : s.t.textMuted }}>{p.name}</span>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // === STANDARD: таблица ===
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
                  <div>{opt.date}</div><div style={{ fontWeight: 600, color: s.t.text }}>{opt.startTime}–{opt.endTime}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pollParticipants.map(part => (
              <tr key={part.id}>
                <td style={{ padding: s.v.padding / 2, borderBottom: `1px solid ${s.t.border}`, fontWeight: 600, color: s.t.text, fontSize: s.v.fontSize.body }}>{part.name}</td>
                {pollOptions.map(opt => {
                  const vote = getVote(part.id, opt.id);
                  return (
                    <td key={opt.id} style={{ padding: s.v.padding / 2, textAlign: "center", borderBottom: `1px solid ${s.t.border}`,
                      background: vote ? (vote.value === "yes" ? s.t.successBg : vote.value === "maybe" ? s.t.warningBg : s.t.dangerBg) : "transparent" }}>
                      {vote ? <span style={{ fontSize: s.v.fontSize.body, fontWeight: 700, color: vote.value === "yes" ? s.t.success : vote.value === "maybe" ? s.t.warning : s.t.danger }}>
                        {vote.value === "yes" ? "✓" : vote.value === "maybe" ? "?" : "✕"}</span> : <span style={{ color: s.t.textMuted }}>—</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td style={{ padding: s.v.padding / 2, fontWeight: 700, borderTop: `2px solid ${s.t.border}` }}>Итого</td>
              {pollOptions.map(opt => {
                const ct = colTotals[opt.id] || { yes: 0, no: 0, maybe: 0 };
                const pct = pollParticipants.length > 0 ? Math.round((ct.yes / pollParticipants.length) * 100) : 0;
                return (
                  <td key={opt.id} style={{ padding: s.v.padding / 2, textAlign: "center", borderTop: `2px solid ${s.t.border}` }}>
                    <div style={{ fontSize: s.v.fontSize.body, fontWeight: 700, color: pct >= 50 ? s.t.success : s.t.danger }}>{pct}%</div>
                    <div style={{ fontSize: s.v.fontSize.tiny, color: s.t.textMuted }}>{ct.yes}✓ {ct.maybe}? {ct.no}✕</div>
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
