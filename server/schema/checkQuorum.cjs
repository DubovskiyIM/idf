/**
 * checkQuorum — проверяет, достигнут ли кворум для poll'а.
 *
 * Кворум = все участники проголосовали хотя бы раз.
 * Возвращает { reached: boolean, voted: number, total: number }.
 */

function checkQuorum(pollId, world) {
  const poll = (world.polls || []).find(p => p.id === pollId);
  if (!poll || poll.status !== "open") return { reached: false, voted: 0, total: 0 };

  const participants = (world.participants || []).filter(p => p.pollId === pollId);
  const votes = (world.votes || []).filter(v => v.pollId === pollId);
  const votedIds = new Set(votes.map(v => v.participantId));

  return {
    reached: participants.length > 0 && votedIds.size >= participants.length,
    voted: votedIds.size,
    total: participants.length,
  };
}

module.exports = { checkQuorum };
