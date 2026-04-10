/*
 * Кристаллизованная проекция: poll_overview
 * Источник: PROJECTIONS.poll_overview — "один опрос со всеми вариантами и голосами"
 * Намерения (8): create_poll, add_time_option, invite_participant, open_poll,
 *                vote_yes, vote_no, close_poll, resolve_poll
 * Сущности: Poll, TimeOption, Participant, Vote, Meeting
 * Рабочий процесс: draft → open → closed → resolved (раздел 9a манифеста)
 */

import { useState, useMemo } from "react";
import { getStyles } from "./theme.js";

const PHASE_LABELS = {
  draft: "Подготовка", open: "Голосование", closed: "Выбор", resolved: "Готово", cancelled: "Отменён"
};

export default function PollOverviewProjection({ world, exec, theme = "light", variant = "clean" }) {
  const s = getStyles(theme, variant);
  const [selectedPollId, setSelectedPollId] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [newOptDate, setNewOptDate] = useState("");
  const [newOptStart, setNewOptStart] = useState("");
  const [newOptEnd, setNewOptEnd] = useState("");
  const [newPart, setNewPart] = useState("");
  const [votingAs, setVotingAs] = useState(null);

  const polls = world.polls || [];
  const options = world.options || [];
  const participants = world.participants || [];
  const votes = world.votes || [];
  const meetings = world.meetings || [];

  const poll = polls.find(p => p.id === selectedPollId);
  const pollOptions = options.filter(o => o.pollId === selectedPollId);
  const pollParticipants = participants.filter(p => p.pollId === selectedPollId);
  const pollVotes = votes.filter(v => v.pollId === selectedPollId);

  const voteCounts = useMemo(() => {
    const c = {};
    for (const opt of pollOptions) {
      const ov = pollVotes.filter(v => v.optionId === opt.id);
      c[opt.id] = { yes: ov.filter(v => v.value === "yes").length, no: ov.filter(v => v.value === "no").length };
    }
    return c;
  }, [pollOptions, pollVotes]);

  // Список опросов
  if (!poll) return (
    <div style={s.container}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: s.v.gap * 2 }}>
        <h2 style={s.heading("h1")}>Опросы</h2>
        <span style={s.text("small")}>{polls.length} опросов · {meetings.length} встреч</span>
      </div>

      {/* create_poll */}
      <div style={{ display: "flex", gap: s.v.gap, marginBottom: s.v.gap * 2 }}>
        <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название встречи..."
          onKeyDown={e => { if (e.key === "Enter" && newTitle.trim()) { exec("create_poll", { title: newTitle }); setNewTitle(""); } }}
          style={{ flex: 1, padding: s.v.padding * 0.7, borderRadius: s.v.radius, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.body, fontFamily: s.v.font, outline: "none", background: s.t.surface, color: s.t.text }} />
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
                <div style={s.text("small")}>
                  {options.filter(o => o.pollId === p.id).length} вариантов · {participants.filter(pt => pt.pollId === p.id).length} участников
                </div>
              </div>
              <span style={s.badge(p.status)}>{PHASE_LABELS[p.status]}</span>
            </div>
          ))}
        </div>
      )}

      {/* Встречи */}
      {meetings.length > 0 && (
        <>
          <div style={{ ...s.text("tiny"), textTransform: "uppercase", letterSpacing: "0.05em", marginTop: s.v.gap * 3, marginBottom: s.v.gap }}>Назначенные встречи</div>
          {meetings.map(m => (
            <div key={m.id} style={{ ...s.card, borderLeft: `3px solid ${s.statusColor("confirmed")}`, marginBottom: s.v.gap }}>
              <div style={s.heading("h2")}>{m.title}</div>
              <div style={s.text("small")}>{m.date} {m.startTime}–{m.endTime} · {m.participantIds?.length || 0} участников</div>
            </div>
          ))}
        </>
      )}
    </div>
  );

  // Детали опроса
  return (
    <div style={s.container}>
      <button onClick={() => { setSelectedPollId(null); setVotingAs(null); }}
        style={{ ...s.buttonOutline(), marginBottom: s.v.gap }}>← Назад</button>

      <div style={{ display: "flex", alignItems: "center", gap: s.v.gap, marginBottom: s.v.gap }}>
        <h2 style={s.heading("h1")}>{poll.title}</h2>
        <span style={s.badge(poll.status)}>{PHASE_LABELS[poll.status]}</span>
      </div>

      {/* Индикатор рабочего процесса */}
      <div style={{ display: "flex", gap: 4, marginBottom: s.v.gap * 2 }}>
        {["draft", "open", "closed", "resolved"].map((phase, i) => {
          const isCurrent = poll.status === phase;
          const isPast = ["draft", "open", "closed", "resolved"].indexOf(poll.status) > i;
          return (
            <div key={phase} style={{
              flex: 1, height: 4, borderRadius: 2,
              background: isCurrent ? s.statusColor(phase) : isPast ? s.t.accent : s.t.border,
              opacity: isCurrent ? 1 : isPast ? 0.5 : 0.2,
            }} />
          );
        })}
      </div>

      {/* DRAFT */}
      {poll.status === "draft" && (
        <>
          <div style={{ marginBottom: s.v.gap * 2 }}>
            <div style={{ ...s.text("tiny"), textTransform: "uppercase", marginBottom: s.v.gap }}>Варианты ({pollOptions.length})</div>
            {pollOptions.map(opt => (
              <div key={opt.id} style={{ ...s.text("body"), marginBottom: 4 }}>📅 {opt.date} {opt.startTime}–{opt.endTime}</div>
            ))}
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
            {pollParticipants.map(p => (
              <div key={p.id} style={{ ...s.text("body"), marginBottom: 4 }}>👤 {p.name}</div>
            ))}
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
            style={s.button("success")}>▶ Открыть голосование</button>
        </>
      )}

      {/* OPEN */}
      {poll.status === "open" && (
        <>
          <div style={{ marginBottom: s.v.gap }}>
            <div style={{ ...s.text("tiny"), textTransform: "uppercase", marginBottom: s.v.gap }}>Голосовать как:</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {pollParticipants.map(p => (
                <button key={p.id} onClick={() => setVotingAs(p.id)}
                  style={{ padding: "4px 14px", borderRadius: 20, border: votingAs === p.id ? `2px solid ${s.t.accent}` : `1px solid ${s.t.border}`,
                    background: votingAs === p.id ? s.t.accentBg : s.t.surface, fontSize: s.v.fontSize.small, cursor: "pointer", color: s.t.text, fontFamily: s.v.font }}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {pollOptions.map(opt => {
            const vc = voteCounts[opt.id] || { yes: 0, no: 0 };
            const myVote = pollVotes.find(v => v.optionId === opt.id && v.participantId === votingAs);
            return (
              <div key={opt.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: s.v.gap, marginBottom: s.v.gap }}>
                <div style={{ flex: 1 }}>
                  <div style={s.heading("h2")}>{opt.date} {opt.startTime}–{opt.endTime}</div>
                  <div style={s.text("small")}>
                    <span style={{ color: s.t.success }}>✓ {vc.yes}</span> · <span style={{ color: s.t.danger }}>✕ {vc.no}</span>
                  </div>
                </div>
                {votingAs && !myVote && (
                  <>
                    <button onClick={() => exec("vote_yes", { optionId: opt.id, participantId: votingAs })} style={s.button("success")}>✓ Да</button>
                    <button onClick={() => exec("vote_no", { optionId: opt.id, participantId: votingAs })} style={s.button("danger")}>✕ Нет</button>
                  </>
                )}
                {myVote && <span style={s.badge(myVote.value)}>{myVote.value === "yes" ? "✓ Доступен" : "✕ Недоступен"}</span>}
              </div>
            );
          })}

          <button onClick={() => exec("close_poll", { pollId: poll.id })} style={s.buttonOutline("warning")}>⏹ Закрыть голосование</button>
        </>
      )}

      {/* CLOSED */}
      {poll.status === "closed" && (
        <>
          <div style={{ ...s.text("tiny"), textTransform: "uppercase", marginBottom: s.v.gap }}>Результаты — выберите:</div>
          {pollOptions.sort((a, b) => (voteCounts[b.id]?.yes || 0) - (voteCounts[a.id]?.yes || 0)).map(opt => {
            const vc = voteCounts[opt.id] || { yes: 0, no: 0 };
            const total = pollParticipants.length;
            const pct = total > 0 ? Math.round((vc.yes / total) * 100) : 0;
            return (
              <div key={opt.id} style={{ ...s.card, marginBottom: s.v.gap }}>
                <div style={{ display: "flex", alignItems: "center", gap: s.v.gap }}>
                  <div style={{ flex: 1 }}>
                    <div style={s.heading("h2")}>{opt.date} {opt.startTime}–{opt.endTime}</div>
                    <div style={s.text("small")}>
                      <span style={{ color: s.t.success, fontWeight: 600 }}>✓ {vc.yes}</span> · <span style={{ color: s.t.danger }}>✕ {vc.no}</span> · {pct}% доступны
                    </div>
                  </div>
                  <button onClick={() => exec("resolve_poll", { pollId: poll.id, optionId: opt.id })} style={s.button()}>Выбрать</button>
                </div>
                {/* Прогресс-бар */}
                <div style={{ height: 4, borderRadius: 2, background: s.t.border, marginTop: s.v.gap }}>
                  <div style={{ height: 4, borderRadius: 2, background: s.t.success, width: `${pct}%`, transition: "width 0.3s" }} />
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* RESOLVED */}
      {poll.status === "resolved" && (
        <div style={{ ...s.card, borderLeft: `3px solid ${s.t.success}`, background: s.t.successBg }}>
          <div style={{ ...s.heading("h2"), color: s.t.success, marginBottom: s.v.gap }}>✓ Встреча назначена</div>
          {meetings.filter(m => m.pollId === poll.id).map(m => (
            <div key={m.id} style={s.text("body")}>
              {m.date} {m.startTime}–{m.endTime} · {m.participantIds?.length || 0} участников
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
