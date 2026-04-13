/**
 * @deprecated Используй агрегатные условия в intents.conditions:
 *   "ratio(votes.participantId, participants, pollId=target.id) >= 1.0"
 * Модуль будет удалён в следующем релизе.
 *
 * checkQuorum — проверяет, достигнут ли кворум для poll'а.
 *
 * Поддерживает декларативные политики из ontology.entities.Poll.quorum:
 *   closeWhen: "all_voted" | "quorum(0.8)" | "manual"
 *   absentVote: "abstain" | "no" | "exclude"
 *
 * Возвращает { reached: boolean, voted: number, total: number, policy: string }.
 */

function checkQuorum(pollId, world, ontology) {
  const poll = (world.polls || []).find(p => p.id === pollId);
  if (!poll || poll.status !== "open") return { reached: false, voted: 0, total: 0, policy: "none" };

  const participants = (world.participants || []).filter(p => p.pollId === pollId);
  const votes = (world.votes || []).filter(v => v.pollId === pollId);
  const votedIds = new Set(votes.map(v => v.participantId));

  const total = participants.length;
  const voted = votedIds.size;

  // Читаем policy из онтологии (fallback: all_voted)
  const quorumConfig = ontology?.entities?.Poll?.quorum || {};
  const closeWhen = quorumConfig.closeWhen || "all_voted";

  if (closeWhen === "manual") {
    return { reached: false, voted, total, policy: "manual" };
  }

  // quorum(N) — процентный кворум
  const quorumMatch = closeWhen.match(/^quorum\((\d*\.?\d+)\)$/);
  if (quorumMatch) {
    const threshold = parseFloat(quorumMatch[1]);
    const ratio = total > 0 ? voted / total : 0;
    return { reached: ratio >= threshold, voted, total, policy: closeWhen };
  }

  // all_voted (default)
  return {
    reached: total > 0 && voted >= total,
    voted,
    total,
    policy: "all_voted",
  };
}

module.exports = { checkQuorum };
