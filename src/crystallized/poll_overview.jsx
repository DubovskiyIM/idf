/*
 * Кристаллизованная проекция: poll_overview
 * Домен: planning · 14 намерений · 5 сущностей
 * Рабочий процесс: draft → open → closed → resolved | cancelled
 * Намерения: create_poll, add_time_option, invite_participant, open_poll,
 *   vote_yes, vote_no, vote_maybe, close_poll, resolve_poll,
 *   cancel_poll, cancel_meeting, decline_invitation, suggest_alternative, set_deadline
 * Кворум: прогресс-бар + список ожидающих + автозакрытие по дедлайну
 */

import { useState, useMemo } from "react";
import { getStyles } from "./theme.js";

const PHASE_LABELS = { draft: "Подготовка", open: "Голосование", closed: "Выбор", resolved: "Готово", cancelled: "Отменён" };
const VOTE_LABELS = { yes: "✓ Доступен", no: "✕ Недоступен", maybe: "? Возможно" };

export default function PollOverviewProjection({ world, exec, theme = "light", variant = "clean" }) {
  const s = getStyles(theme, variant);
  const [selectedPollId, setSelectedPollId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newOptDate, setNewOptDate] = useState("");
  const [newOptStart, setNewOptStart] = useState("");
  const [newOptEnd, setNewOptEnd] = useState("");
  const [newPart, setNewPart] = useState("");
  const [votingAs, setVotingAs] = useState(null);
  const [sugDate, setSugDate] = useState("");
  const [sugStart, setSugStart] = useState("");
  const [sugEnd, setSugEnd] = useState("");

  const polls = world.polls || [];
  const options = world.options || [];
  const participants = world.participants || [];
  const votes = world.votes || [];
  const meetings = world.meetings || [];

  const poll = polls.find(p => p.id === selectedPollId);
  const pollOptions = options.filter(o => o.pollId === selectedPollId);
  const pollParticipants = participants.filter(p => p.pollId === selectedPollId);
  const pollVotes = votes.filter(v => v.pollId === selectedPollId);
  const activeParticipants = pollParticipants.filter(p => p.status !== "declined");

  const voteCounts = useMemo(() => {
    const c = {};
    for (const opt of pollOptions) {
      const ov = pollVotes.filter(v => v.optionId === opt.id);
      c[opt.id] = { yes: ov.filter(v => v.value === "yes").length, no: ov.filter(v => v.value === "no").length, maybe: ov.filter(v => v.value === "maybe").length };
    }
    return c;
  }, [pollOptions, pollVotes]);

  // Кворум
  const quorum = useMemo(() => {
    const totalSlots = activeParticipants.length * pollOptions.length;
    const votedSlots = pollVotes.length;
    const pct = totalSlots > 0 ? Math.round((votedSlots / totalSlots) * 100) : 0;
    const allVoted = totalSlots > 0 && votedSlots >= totalSlots;
    const notVoted = activeParticipants.filter(p => {
      const pv = pollVotes.filter(v => v.participantId === p.id);
      return pv.length < pollOptions.length;
    });
    return { totalSlots, votedSlots, pct, allVoted, notVoted };
  }, [activeParticipants, pollOptions, pollVotes]);

  // --- Список опросов ---
  if (!poll) return (
    <div style={s.container}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: s.v.gap * 2 }}>
        <h2 style={s.heading("h1")}>Опросы</h2>
        <span style={s.text("small")}>{polls.length} опросов · {meetings.length} встреч</span>
      </div>

      <div style={{ display: "flex", gap: s.v.gap, marginBottom: s.v.gap * 2 }}>
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название встречи..."
          onKeyDown={e => { if (e.key === "Enter" && newTitle.trim()) { exec("create_poll", { title: newTitle }); setNewTitle(""); } }}
          style={{ flex: 1, padding: s.v.padding * 0.7, borderRadius: s.v.radius, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.body, fontFamily: s.v.font, background: s.t.surface, color: s.t.text, outline: "none" }} />
        <button onClick={() => { if (newTitle.trim()) { exec("create_poll", { title: newTitle }); setNewTitle(""); } }}
          disabled={!newTitle.trim()} style={s.button()}>+ Создать</button>
      </div>

      {polls.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, ...s.text() }}>Создайте первый опрос</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: s.v.gap }}>
          {polls.sort((a, b) => b.createdAt - a.createdAt).map(p => (
            <div key={p.id} onClick={() => setSelectedPollId(p.id)}
              style={{ ...s.card, borderLeft: `3px solid ${s.statusColor(p.status)}`, cursor: "pointer", display: "flex", alignItems: "center", gap: s.v.gap }}>
              <div style={{ flex: 1 }}>
                <div style={s.heading("h2")}>{p.title}</div>
                <div style={s.text("small")}>{options.filter(o => o.pollId === p.id).length} вариантов · {participants.filter(pt => pt.pollId === p.id).length} участников</div>
              </div>
              <span style={s.badge(p.status)}>{PHASE_LABELS[p.status]}</span>
            </div>
          ))}
        </div>
      )}

      {meetings.length > 0 && (
        <>
          <div style={{ ...s.text("tiny"), textTransform: "uppercase", marginTop: s.v.gap * 3, marginBottom: s.v.gap }}>Встречи</div>
          {meetings.map(m => (
            <div key={m.id} style={{ ...s.card, borderLeft: `3px solid ${s.statusColor(m.status)}`, marginBottom: s.v.gap, display: "flex", alignItems: "center", gap: s.v.gap }}>
              <div style={{ flex: 1 }}>
                <div style={s.heading("h2")}>{m.title}</div>
                <div style={s.text("small")}>{m.date} {m.startTime}–{m.endTime}</div>
              </div>
              <span style={s.badge(m.status)}>{m.status}</span>
              {m.status === "confirmed" && (
                <button onClick={(e) => { e.stopPropagation(); exec("cancel_meeting", { id: m.id }); }} style={s.buttonOutline("danger")}>Отменить</button>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );

  // --- Детали опроса ---
  return (
    <div style={s.container}>
      <div style={{ display: "flex", alignItems: "center", gap: s.v.gap, marginBottom: s.v.gap }}>
        <button onClick={() => { setSelectedPollId(null); setVotingAs(null); }} style={s.buttonOutline()}>← Назад</button>
        <div style={{ flex: 1 }} />
        {poll.status !== "resolved" && poll.status !== "cancelled" && (
          <button onClick={() => { exec("cancel_poll", { pollId: poll.id }); setSelectedPollId(null); }} style={s.buttonOutline("danger")}>Отменить опрос</button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: s.v.gap, marginBottom: s.v.gap }}>
        <h2 style={s.heading("h1")}>{poll.title}</h2>
        <span style={s.badge(poll.status)}>{PHASE_LABELS[poll.status]}</span>
      </div>

      {/* Прогресс фаз */}
      <div style={{ display: "flex", gap: 4, marginBottom: s.v.gap * 2 }}>
        {["draft", "open", "closed", "resolved"].map((phase, i) => {
          const isCurrent = poll.status === phase;
          const isPast = ["draft", "open", "closed", "resolved"].indexOf(poll.status) > i;
          return <div key={phase} style={{ flex: 1, height: 4, borderRadius: 2, background: isCurrent ? s.statusColor(phase) : isPast ? s.t.accent : s.t.border, opacity: isCurrent ? 1 : isPast ? 0.5 : 0.2 }} />;
        })}
      </div>

      {/* ===== DRAFT ===== */}
      {poll.status === "draft" && (
        <>
          <div style={{ marginBottom: s.v.gap * 2 }}>
            <div style={{ ...s.text("tiny"), textTransform: "uppercase", marginBottom: s.v.gap }}>Варианты ({pollOptions.length})</div>
            {pollOptions.map(opt => <div key={opt.id} style={s.text("body")}>📅 {opt.date} {opt.startTime}–{opt.endTime}</div>)}
            <div style={{ display: "flex", gap: 6, marginTop: s.v.gap }}>
              <input type="date" value={newOptDate} onChange={e => setNewOptDate(e.target.value)} style={{ padding: "6px", borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.small, background: s.t.surface, color: s.t.text }} />
              <input type="time" value={newOptStart} onChange={e => setNewOptStart(e.target.value)} style={{ padding: "6px", borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.small, background: s.t.surface, color: s.t.text }} />
              <input type="time" value={newOptEnd} onChange={e => setNewOptEnd(e.target.value)} style={{ padding: "6px", borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.small, background: s.t.surface, color: s.t.text }} />
              <button onClick={() => { exec("add_time_option", { pollId: poll.id, date: newOptDate, startTime: newOptStart, endTime: newOptEnd }); setNewOptDate(""); setNewOptStart(""); setNewOptEnd(""); }}
                disabled={!newOptDate || !newOptStart || !newOptEnd} style={s.button()}>+</button>
            </div>
          </div>
          <div style={{ marginBottom: s.v.gap * 2 }}>
            <div style={{ ...s.text("tiny"), textTransform: "uppercase", marginBottom: s.v.gap }}>Участники ({pollParticipants.length})</div>
            {pollParticipants.map(p => <div key={p.id} style={s.text("body")}>👤 {p.name}</div>)}
            <div style={{ display: "flex", gap: 6, marginTop: s.v.gap }}>
              <input value={newPart} onChange={e => setNewPart(e.target.value)} placeholder="Имя..."
                onKeyDown={e => { if (e.key === "Enter" && newPart.trim()) { exec("invite_participant", { pollId: poll.id, name: newPart }); setNewPart(""); } }}
                style={{ flex: 1, padding: "6px 10px", borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.small, background: s.t.surface, color: s.t.text }} />
              <button onClick={() => { exec("invite_participant", { pollId: poll.id, name: newPart }); setNewPart(""); }}
                disabled={!newPart.trim()} style={s.button()}>+</button>
            </div>
          </div>
          <button onClick={() => exec("open_poll", { pollId: poll.id })}
            disabled={pollOptions.length === 0 || pollParticipants.length === 0}
            style={(pollOptions.length > 0 && pollParticipants.length > 0) ? s.button("success") : { ...s.button("muted"), cursor: "default" }}>
            ▶ Открыть голосование
          </button>
        </>
      )}

      {/* ===== OPEN ===== */}
      {poll.status === "open" && (
        <>
          {/* Выбор участника + decline */}
          <div style={{ marginBottom: s.v.gap }}>
            <div style={{ ...s.text("tiny"), textTransform: "uppercase", marginBottom: s.v.gap }}>Голосовать как:</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {activeParticipants.map(p => (
                <button key={p.id} onClick={() => setVotingAs(p.id)}
                  style={{ padding: "4px 14px", borderRadius: 20, border: votingAs === p.id ? `2px solid ${s.t.accent}` : `1px solid ${s.t.border}`,
                    background: votingAs === p.id ? s.t.accentBg : s.t.surface, fontSize: s.v.fontSize.small, cursor: "pointer", color: s.t.text, fontFamily: s.v.font }}>
                  {p.name}
                </button>
              ))}
              {votingAs && (
                <button onClick={() => { exec("decline_invitation", { participantId: votingAs }); setVotingAs(null); }}
                  style={s.buttonOutline("danger")}>Отклонить</button>
              )}
              {pollParticipants.filter(p => p.status === "declined").length > 0 && (
                <span style={{ ...s.text("tiny"), color: s.t.danger }}>
                  отклонили: {pollParticipants.filter(p => p.status === "declined").map(p => p.name).join(", ")}
                </span>
              )}
            </div>
          </div>

          {/* Матрица голосов */}
          {pollOptions.map(opt => {
            const vc = voteCounts[opt.id] || { yes: 0, no: 0, maybe: 0 };
            const myVote = pollVotes.find(v => v.optionId === opt.id && v.participantId === votingAs);
            const isSuggested = opt.suggestedBy;
            return (
              <div key={opt.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: s.v.gap, marginBottom: s.v.gap,
                borderLeft: isSuggested ? `3px solid ${s.t.info}` : undefined }}>
                <div style={{ flex: 1 }}>
                  <div style={s.heading("h2")}>{opt.date} {opt.startTime}–{opt.endTime}</div>
                  <div style={s.text("small")}>
                    <span style={{ color: s.t.success }}>✓ {vc.yes}</span> · <span style={{ color: s.t.warning }}>? {vc.maybe}</span> · <span style={{ color: s.t.danger }}>✕ {vc.no}</span>
                    {isSuggested && <span style={{ color: s.t.info, marginLeft: 6 }}>💡 предложение</span>}
                  </div>
                </div>
                {votingAs && !myVote && (
                  <>
                    <button onClick={() => exec("vote_yes", { optionId: opt.id, participantId: votingAs })} style={s.button("success")}>✓</button>
                    <button onClick={() => exec("vote_maybe", { optionId: opt.id, participantId: votingAs })} style={s.buttonOutline("warning")}>?</button>
                    <button onClick={() => exec("vote_no", { optionId: opt.id, participantId: votingAs })} style={s.button("danger")}>✕</button>
                  </>
                )}
                {myVote && <span style={s.badge(myVote.value)}>{VOTE_LABELS[myVote.value]}</span>}
              </div>
            );
          })}

          {/* suggest_alternative */}
          {votingAs && (
            <div style={{ ...s.card, border: `1px dashed ${s.t.info}`, marginBottom: s.v.gap }}>
              <div style={{ ...s.text("small"), color: s.t.info, marginBottom: s.v.gap }}>💡 Предложить другое время:</div>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="date" value={sugDate} onChange={e => setSugDate(e.target.value)} style={{ padding: "4px 6px", borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.small, background: s.t.surface, color: s.t.text }} />
                <input type="time" value={sugStart} onChange={e => setSugStart(e.target.value)} style={{ padding: "4px 6px", borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.small, background: s.t.surface, color: s.t.text }} />
                <input type="time" value={sugEnd} onChange={e => setSugEnd(e.target.value)} style={{ padding: "4px 6px", borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.small, background: s.t.surface, color: s.t.text }} />
                <button onClick={() => { if (sugDate && sugStart && sugEnd) { exec("suggest_alternative", { pollId: poll.id, date: sugDate, startTime: sugStart, endTime: sugEnd, participantId: votingAs }); setSugDate(""); setSugStart(""); setSugEnd(""); } }}
                  disabled={!sugDate || !sugStart || !sugEnd} style={s.button("info")}>Предложить</button>
              </div>
            </div>
          )}

          {/* Кворум */}
          <div style={{ ...s.card, marginBottom: s.v.gap, background: quorum.allVoted ? s.t.successBg : s.t.surface, border: `1px solid ${quorum.allVoted ? s.t.success : s.t.border}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: s.v.gap / 2 }}>
              <span style={{ ...s.text("small"), fontWeight: 600, color: quorum.allVoted ? s.t.success : s.t.text }}>
                {quorum.allVoted ? "✓ Все проголосовали" : `Кворум: ${quorum.votedSlots}/${quorum.totalSlots} (${quorum.pct}%)`}
              </span>
              <span style={s.text("tiny")}>{activeParticipants.length} уч. · {pollOptions.length} вар.</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: s.t.border }}>
              <div style={{ height: 6, borderRadius: 3, background: quorum.allVoted ? s.t.success : s.t.accent, width: `${quorum.pct}%`, transition: "width 0.3s" }} />
            </div>
            {quorum.notVoted.length > 0 && !quorum.allVoted && (
              <div style={{ ...s.text("tiny"), marginTop: s.v.gap / 2 }}>Ждём: {quorum.notVoted.map(p => p.name).join(", ")}</div>
            )}
          </div>

          {/* Дедлайн */}
          <div style={{ display: "flex", gap: s.v.gap, alignItems: "center", marginBottom: s.v.gap }}>
            {poll.deadline ? (
              <span style={{ ...s.text("small"), color: s.t.warning }}>⏰ Дедлайн: {poll.deadline}</span>
            ) : (
              <>
                <span style={s.text("small")}>⏰</span>
                <input type="datetime-local" id="crDeadline" style={{ padding: "4px 8px", borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.small, background: s.t.surface, color: s.t.text }} />
                <button onClick={() => { const v = document.getElementById("crDeadline").value; if (v) exec("set_deadline", { pollId: poll.id, deadline: v }); }}
                  style={s.button("warning")}>Установить</button>
              </>
            )}
          </div>

          <button onClick={() => exec("close_poll", { pollId: poll.id })} style={s.buttonOutline("warning")}>⏹ Закрыть голосование</button>
        </>
      )}

      {/* ===== CLOSED ===== */}
      {poll.status === "closed" && (
        <>
          <div style={{ ...s.text("tiny"), textTransform: "uppercase", marginBottom: s.v.gap }}>Результаты — выберите:</div>
          {pollOptions.sort((a, b) => (voteCounts[b.id]?.yes || 0) - (voteCounts[a.id]?.yes || 0)).map(opt => {
            const vc = voteCounts[opt.id] || { yes: 0, no: 0, maybe: 0 };
            const total = activeParticipants.length;
            const pct = total > 0 ? Math.round((vc.yes / total) * 100) : 0;
            return (
              <div key={opt.id} style={{ ...s.card, marginBottom: s.v.gap }}>
                <div style={{ display: "flex", alignItems: "center", gap: s.v.gap }}>
                  <div style={{ flex: 1 }}>
                    <div style={s.heading("h2")}>{opt.date} {opt.startTime}–{opt.endTime}</div>
                    <div style={s.text("small")}>
                      <span style={{ color: s.t.success, fontWeight: 600 }}>✓ {vc.yes}</span> · <span style={{ color: s.t.warning }}>? {vc.maybe}</span> · <span style={{ color: s.t.danger }}>✕ {vc.no}</span> · {pct}%
                    </div>
                  </div>
                  <button onClick={() => exec("resolve_poll", { pollId: poll.id, optionId: opt.id })} style={s.button()}>Выбрать</button>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: s.t.border, marginTop: s.v.gap }}>
                  <div style={{ height: 4, borderRadius: 2, background: s.t.success, width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ===== RESOLVED ===== */}
      {poll.status === "resolved" && (
        <div style={{ ...s.card, borderLeft: `3px solid ${s.t.success}`, background: s.t.successBg }}>
          <div style={{ ...s.heading("h2"), color: s.t.success, marginBottom: s.v.gap }}>✓ Встреча назначена</div>
          {meetings.filter(m => m.pollId === poll.id).map(m => (
            <div key={m.id} style={{ display: "flex", alignItems: "center", gap: s.v.gap }}>
              <span style={s.text("body")}>{m.date} {m.startTime}–{m.endTime} · {m.participantIds?.length || 0} участников</span>
              {m.status === "confirmed" && <button onClick={() => exec("cancel_meeting", { id: m.id })} style={s.buttonOutline("danger")}>Отменить</button>}
              {m.status === "cancelled" && <span style={s.badge("cancelled")}>Отменена</span>}
            </div>
          ))}
        </div>
      )}

      {/* ===== CANCELLED ===== */}
      {poll.status === "cancelled" && (
        <div style={{ ...s.card, background: s.t.dangerBg, textAlign: "center" }}>
          <span style={{ color: s.t.danger, fontWeight: 600 }}>Опрос отменён</span>
        </div>
      )}
    </div>
  );
}
