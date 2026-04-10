import { useState, useMemo } from "react";

const POLL_STATUS_COLORS = { draft: "#6b7280", open: "#22c55e", closed: "#f59e0b", resolved: "#6366f1", cancelled: "#ef4444" };
const VOTE_COLORS = { yes: "#22c55e", no: "#ef4444", maybe: "#f59e0b" };
const VOTE_LABELS = { yes: "✓ Доступен", no: "✕ Недоступен", maybe: "? Возможно" };

export default function PlanningUI({ world, drafts, exec }) {
  const [view, setView] = useState("polls");
  const [newTitle, setNewTitle] = useState("");
  const [newOptionDate, setNewOptionDate] = useState("");
  const [newOptionStart, setNewOptionStart] = useState("");
  const [newOptionEnd, setNewOptionEnd] = useState("");
  const [newParticipant, setNewParticipant] = useState("");
  const [selectedPollId, setSelectedPollId] = useState(null);
  const [votingAs, setVotingAs] = useState(null);

  const polls = world.polls || [];
  const options = world.options || [];
  const participants = world.participants || [];
  const votes = world.votes || [];
  const meetings = world.meetings || [];

  const selectedPoll = polls.find(p => p.id === selectedPollId);
  const pollOptions = options.filter(o => o.pollId === selectedPollId);
  const pollParticipants = participants.filter(p => p.pollId === selectedPollId);
  const pollVotes = votes.filter(v => v.pollId === selectedPollId);

  // Подсчёт голосов по варианту
  const voteCounts = useMemo(() => {
    const counts = {};
    for (const opt of pollOptions) {
      const optVotes = pollVotes.filter(v => v.optionId === opt.id);
      counts[opt.id] = { yes: optVotes.filter(v => v.value === "yes").length, no: optVotes.filter(v => v.value === "no").length, maybe: optVotes.filter(v => v.value === "maybe").length };
    }
    return counts;
  }, [pollOptions, pollVotes]);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Навигация */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => { setView("polls"); setSelectedPollId(null); }}
          style={{ padding: "6px 14px", borderRadius: 6, border: view === "polls" ? "2px solid #6366f1" : "1px solid #d1d5db", background: view === "polls" ? "#eef2ff" : "#fff", color: "#1a1a2e", fontSize: 12, cursor: "pointer" }}>
          Опросы ({polls.length})
        </button>
        <button onClick={() => setView("meetings")}
          style={{ padding: "6px 14px", borderRadius: 6, border: view === "meetings" ? "2px solid #6366f1" : "1px solid #d1d5db", background: view === "meetings" ? "#eef2ff" : "#fff", color: "#1a1a2e", fontSize: 12, cursor: "pointer" }}>
          Встречи ({meetings.length})
        </button>
      </div>

      {/* Список опросов */}
      {view === "polls" && !selectedPollId && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#1a1a2e" }}>Опросы</h2>
          {/* Создание опроса */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название встречи..."
              onKeyDown={e => { if (e.key === "Enter" && newTitle.trim()) { exec("create_poll", { title: newTitle }); setNewTitle(""); } }}
              style={{ flex: 1, padding: "10px 14px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none" }} />
            <button onClick={() => { if (newTitle.trim()) { exec("create_poll", { title: newTitle }); setNewTitle(""); } }}
              disabled={!newTitle.trim()}
              style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: newTitle.trim() ? "#6366f1" : "#d1d5db", color: "#fff", fontSize: 14, cursor: newTitle.trim() ? "pointer" : "default", fontWeight: 600 }}>
              + Создать
            </button>
          </div>
          {/* Список */}
          {polls.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Нет опросов</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {polls.sort((a, b) => b.createdAt - a.createdAt).map(poll => (
                <div key={poll.id} onClick={() => setSelectedPollId(poll.id)}
                  style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 8, padding: "12px 16px", border: "1px solid #e5e7eb", borderLeft: `3px solid ${POLL_STATUS_COLORS[poll.status]}`, cursor: "pointer" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{poll.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      {options.filter(o => o.pollId === poll.id).length} вариантов · {participants.filter(p => p.pollId === poll.id).length} участников
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: POLL_STATUS_COLORS[poll.status], textTransform: "uppercase" }}>{poll.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Детали опроса */}
      {view === "polls" && selectedPoll && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <button onClick={() => setSelectedPollId(null)} style={{ background: "none", border: "none", color: "#6366f1", cursor: "pointer", fontSize: 12 }}>← Назад</button>
            <div style={{ flex: 1 }} />
            {selectedPoll.status !== "resolved" && selectedPoll.status !== "cancelled" && (
              <button onClick={() => { exec("cancel_poll", { pollId: selectedPoll.id }); setSelectedPollId(null); }}
                style={{ padding: "4px 12px", borderRadius: 4, border: "1px solid #ef4444", background: "#fff", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>
                Отменить опрос
              </button>
            )}
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4, color: "#1a1a2e" }}>{selectedPoll.title}</h2>
          <div style={{ fontSize: 12, color: POLL_STATUS_COLORS[selectedPoll.status], fontWeight: 600, textTransform: "uppercase", marginBottom: 16 }}>{selectedPoll.status}</div>

          {/* DRAFT: добавление вариантов и участников */}
          {selectedPoll.status === "draft" && (
            <>
              {/* Варианты */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>Варианты времени ({pollOptions.length})</div>
                {pollOptions.map(opt => (
                  <div key={opt.id} style={{ fontSize: 13, color: "#1a1a2e", marginBottom: 4 }}>📅 {opt.date} {opt.startTime}–{opt.endTime}</div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input type="date" value={newOptionDate} onChange={e => setNewOptionDate(e.target.value)} style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 12 }} />
                  <input type="time" value={newOptionStart} onChange={e => setNewOptionStart(e.target.value)} style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 12 }} />
                  <input type="time" value={newOptionEnd} onChange={e => setNewOptionEnd(e.target.value)} style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 12 }} />
                  <button onClick={() => { exec("add_time_option", { pollId: selectedPoll.id, date: newOptionDate, startTime: newOptionStart, endTime: newOptionEnd }); setNewOptionDate(""); setNewOptionStart(""); setNewOptionEnd(""); }}
                    disabled={!newOptionDate || !newOptionStart || !newOptionEnd}
                    style={{ padding: "6px 12px", borderRadius: 4, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, cursor: "pointer" }}>+</button>
                </div>
              </div>
              {/* Участники */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>Участники ({pollParticipants.length})</div>
                {pollParticipants.map(p => (
                  <div key={p.id} style={{ fontSize: 13, color: "#1a1a2e", marginBottom: 4 }}>👤 {p.name}</div>
                ))}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <input value={newParticipant} onChange={e => setNewParticipant(e.target.value)} placeholder="Имя участника..."
                    onKeyDown={e => { if (e.key === "Enter" && newParticipant.trim()) { exec("invite_participant", { pollId: selectedPoll.id, name: newParticipant }); setNewParticipant(""); } }}
                    style={{ flex: 1, padding: "6px 10px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 12 }} />
                  <button onClick={() => { exec("invite_participant", { pollId: selectedPoll.id, name: newParticipant }); setNewParticipant(""); }}
                    disabled={!newParticipant.trim()}
                    style={{ padding: "6px 12px", borderRadius: 4, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, cursor: "pointer" }}>+</button>
                </div>
              </div>
              {/* Открыть */}
              <button onClick={() => exec("open_poll", { pollId: selectedPoll.id })}
                disabled={pollOptions.length === 0 || pollParticipants.length === 0}
                style={{ padding: "10px 24px", borderRadius: 6, border: "none", background: (pollOptions.length > 0 && pollParticipants.length > 0) ? "#22c55e" : "#d1d5db", color: "#fff", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                ▶ Открыть голосование
              </button>
            </>
          )}

          {/* OPEN: голосование */}
          {selectedPoll.status === "open" && (
            <>
              {/* Выбор участника */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>Голосовать как:</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {pollParticipants.filter(p => p.status !== "declined").map(p => (
                    <button key={p.id} onClick={() => setVotingAs(p.id)}
                      style={{ padding: "4px 12px", borderRadius: 20, border: votingAs === p.id ? "2px solid #6366f1" : "1px solid #d1d5db", background: votingAs === p.id ? "#eef2ff" : "#fff", fontSize: 12, cursor: "pointer", color: "#1a1a2e" }}>
                      {p.name}
                    </button>
                  ))}
                  {votingAs && (
                    <button onClick={() => { exec("decline_invitation", { participantId: votingAs }); setVotingAs(null); }}
                      style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid #ef4444", background: "#fff", fontSize: 11, cursor: "pointer", color: "#ef4444" }}>
                      Отклонить
                    </button>
                  )}
                  {pollParticipants.filter(p => p.status === "declined").length > 0 && (
                    <span style={{ fontSize: 10, color: "#ef4444" }}>
                      отклонили: {pollParticipants.filter(p => p.status === "declined").map(p => p.name).join(", ")}
                    </span>
                  )}
                </div>
              </div>
              {/* Матрица голосов */}
              <div style={{ marginBottom: 16 }}>
                {pollOptions.map(opt => {
                  const vc = voteCounts[opt.id] || { yes: 0, no: 0 };
                  const myVote = pollVotes.find(v => v.optionId === opt.id && v.participantId === votingAs);
                  return (
                    <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 6 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>{opt.date} {opt.startTime}–{opt.endTime}</div>
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                          <span style={{ color: VOTE_COLORS.yes }}>✓ {vc.yes}</span> · <span style={{ color: VOTE_COLORS.maybe }}>? {vc.maybe || 0}</span> · <span style={{ color: VOTE_COLORS.no }}>✕ {vc.no}</span>
                        </div>
                      </div>
                      {votingAs && !myVote && (
                        <>
                          <button onClick={() => exec("vote_yes", { optionId: opt.id, participantId: votingAs })}
                            style={{ padding: "4px 12px", borderRadius: 4, border: "none", background: "#22c55e", color: "#fff", fontSize: 11, cursor: "pointer" }}>✓ Да</button>
                          <button onClick={() => exec("vote_maybe", { optionId: opt.id, participantId: votingAs })}
                            style={{ padding: "4px 12px", borderRadius: 4, border: "1px solid #f59e0b", background: "#fff", color: "#f59e0b", fontSize: 11, cursor: "pointer" }}>? Возм.</button>
                          <button onClick={() => exec("vote_no", { optionId: opt.id, participantId: votingAs })}
                            style={{ padding: "4px 12px", borderRadius: 4, border: "none", background: "#ef4444", color: "#fff", fontSize: 11, cursor: "pointer" }}>✕ Нет</button>
                        </>
                      )}
                      {myVote && (
                        <span style={{ fontSize: 12, fontWeight: 600, color: VOTE_COLORS[myVote.value] }}>
                          {myVote.value === "yes" ? "✓ Доступен" : myVote.value === "maybe" ? "? Возможно" : "✕ Недоступен"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* suggest_alternative */}
              {votingAs && (
                <div style={{ marginBottom: 12, padding: 12, background: "#f9fafb", borderRadius: 8, border: "1px dashed #d1d5db" }}>
                  <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 6 }}>💡 Предложить другое время:</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input type="date" id="sugDate" style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 11 }} />
                    <input type="time" id="sugStart" style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 11 }} />
                    <input type="time" id="sugEnd" style={{ padding: "4px 6px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 11 }} />
                    <button onClick={() => {
                      const d = document.getElementById("sugDate").value;
                      const s = document.getElementById("sugStart").value;
                      const e = document.getElementById("sugEnd").value;
                      if (d && s && e) exec("suggest_alternative", { pollId: selectedPoll.id, date: d, startTime: s, endTime: e, participantId: votingAs });
                    }} style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "#6366f1", color: "#fff", fontSize: 11, cursor: "pointer" }}>
                      Предложить
                    </button>
                  </div>
                </div>
              )}

              {/* Кворум: прогресс голосования */}
              {(() => {
                const activeParticipants = pollParticipants.filter(p => p.status !== "declined");
                const totalSlots = activeParticipants.length * pollOptions.length;
                const votedSlots = pollVotes.length;
                const pct = totalSlots > 0 ? Math.round((votedSlots / totalSlots) * 100) : 0;
                const allVoted = totalSlots > 0 && votedSlots >= totalSlots;
                // Кто не голосовал
                const notVoted = activeParticipants.filter(p => {
                  const pVotes = pollVotes.filter(v => v.participantId === p.id);
                  return pVotes.length < pollOptions.length;
                });

                return (
                  <div style={{ marginBottom: 12, padding: 12, background: allVoted ? "#f0fdf4" : "#f9fafb", borderRadius: 8, border: `1px solid ${allVoted ? "#bbf7d0" : "#e5e7eb"}` }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: allVoted ? "#22c55e" : "#1a1a2e" }}>
                        {allVoted ? "✓ Все проголосовали" : `Кворум: ${votedSlots}/${totalSlots} голосов (${pct}%)`}
                      </span>
                      <span style={{ fontSize: 11, color: "#6b7280" }}>{activeParticipants.length} участников · {pollOptions.length} вариантов</span>
                    </div>
                    {/* Прогресс-бар */}
                    <div style={{ height: 6, borderRadius: 3, background: "#e5e7eb", marginBottom: notVoted.length > 0 ? 6 : 0 }}>
                      <div style={{ height: 6, borderRadius: 3, background: allVoted ? "#22c55e" : "#6366f1", width: `${pct}%`, transition: "width 0.3s" }} />
                    </div>
                    {notVoted.length > 0 && !allVoted && (
                      <div style={{ fontSize: 10, color: "#6b7280" }}>
                        Ждём: {notVoted.map(p => p.name).join(", ")}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Дедлайн */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
                {selectedPoll.deadline ? (
                  <span style={{ fontSize: 12, color: "#f59e0b" }}>⏰ Дедлайн: {selectedPoll.deadline}</span>
                ) : (
                  <>
                    <span style={{ fontSize: 11, color: "#6b7280" }}>⏰ Дедлайн:</span>
                    <input type="datetime-local" id="deadlineInput"
                      style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #d1d5db", fontSize: 11 }} />
                    <button onClick={() => {
                      const val = document.getElementById("deadlineInput").value;
                      if (val) exec("set_deadline", { pollId: selectedPoll.id, deadline: val });
                    }} style={{ padding: "4px 10px", borderRadius: 4, border: "none", background: "#f59e0b", color: "#fff", fontSize: 11, cursor: "pointer" }}>
                      Установить
                    </button>
                  </>
                )}
              </div>

              {/* Закрыть */}
              <button onClick={() => exec("close_poll", { pollId: selectedPoll.id })}
                style={{ padding: "10px 24px", borderRadius: 6, border: "1px solid #f59e0b", background: "#fff", color: "#f59e0b", fontSize: 14, cursor: "pointer", fontWeight: 600 }}>
                ⏹ Закрыть голосование
              </button>
            </>
          )}

          {/* CLOSED: resolve */}
          {selectedPoll.status === "closed" && (
            <>
              <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", marginBottom: 6 }}>Результаты — выберите время:</div>
              {pollOptions.sort((a, b) => (voteCounts[b.id]?.yes || 0) - (voteCounts[a.id]?.yes || 0)).map(opt => {
                const vc = voteCounts[opt.id] || { yes: 0, no: 0 };
                return (
                  <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>{opt.date} {opt.startTime}–{opt.endTime}</div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: VOTE_COLORS.yes, fontWeight: 600 }}>✓ {vc.yes}</span> · <span style={{ color: VOTE_COLORS.no }}>✕ {vc.no}</span>
                      </div>
                    </div>
                    <button onClick={() => exec("resolve_poll", { pollId: selectedPoll.id, optionId: opt.id })}
                      style={{ padding: "6px 16px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                      Выбрать
                    </button>
                  </div>
                );
              })}
            </>
          )}

          {/* RESOLVED */}
          {selectedPoll.status === "resolved" && (
            <div style={{ background: "#f0fdf4", borderRadius: 8, padding: 16, border: "1px solid #bbf7d0" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#22c55e", marginBottom: 4 }}>✓ Встреча назначена</div>
              {meetings.filter(m => m.pollId === selectedPoll.id).map(m => (
                <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 13, color: "#1a1a2e", flex: 1 }}>
                    {m.date} {m.startTime}–{m.endTime} · {m.participantIds?.length || 0} участников
                  </span>
                  {m.status === "confirmed" && (
                    <button onClick={() => exec("cancel_meeting", { id: m.id })}
                      style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #ef4444", background: "#fff", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>
                      Отменить
                    </button>
                  )}
                  {m.status === "cancelled" && (
                    <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>ОТМЕНЕНА</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* CANCELLED */}
          {selectedPoll.status === "cancelled" && (
            <div style={{ background: "#fef2f2", borderRadius: 8, padding: 16, border: "1px solid #fecaca", textAlign: "center", color: "#ef4444", fontWeight: 600 }}>
              Опрос отменён
            </div>
          )}
        </div>
      )}

      {/* Встречи */}
      {view === "meetings" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#1a1a2e" }}>Встречи</h2>
          {meetings.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>Нет встреч. Создайте опрос.</div>
          ) : meetings.map(m => (
            <div key={m.id} style={{ background: "#fff", borderRadius: 8, padding: "12px 16px", border: "1px solid #e5e7eb", borderLeft: "3px solid #22c55e", marginBottom: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{m.title}</div>
              <div style={{ fontSize: 13, color: "#6b7280" }}>{m.date} {m.startTime}–{m.endTime}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
