/**
 * Серверный builder эффектов для agent-разрешённых freelance-intent'ов.
 *
 * Зеркалит часть client-side src/domains/freelance/domain.js::buildEffects,
 * но только для write-intents из roles.agent.canExecute:
 *   - submit_response  — executor публикует отклик (pending)
 *   - leave_review     — одна сторона deal.completed пишет отзыв
 *   - reply_to_review  — адресат отвечает на отзыв (1 reply max)
 *
 * Read-only intents (search_tasks, filter_by_category, view_*) в этом
 * builder'е возвращают null — они не предназначены для /exec, и агент
 * получает данные через /api/agent/:domain/world + resources/read.
 *
 * Ownership injection: viewer.id подставляется в executorId/authorId
 * если не передан в params (симметрично client OWNERSHIP_INJECT).
 *
 * Принимает (intentId, params, viewer, world); возвращает массив
 * effect-объектов в формате Φ или null.
 */

const { v4: uuid } = require("uuid");

function ts() {
  return new Date().toLocaleTimeString("ru", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function makeEffect(intentId, props) {
  return {
    id: uuid(),
    intent_id: intentId,
    parent_id: null,
    status: "proposed",
    ttl: null,
    created_at: Date.now(),
    time: ts(),
    ...props,
  };
}

function buildFreelanceEffects(intentId, params, viewer, world) {
  const now = Date.now();
  const viewerId = viewer?.id;

  switch (intentId) {
    // ─── submit_response ─────────────────────────────────────────────
    case "submit_response": {
      const taskId = params.taskId;
      const executorId = params.executorId || viewerId;
      if (!taskId || !executorId) return null;

      const task = (world.tasks || []).find(t => t.id === taskId);
      if (!task) return null;
      if (task.status !== "published") return null;

      // No-dup guard: один active Response от данного executor на эту Task.
      const hasActive = (world.responses || []).some(
        r => r.taskId === taskId && r.executorId === executorId && r.status === "pending"
      );
      if (hasActive) return null;

      const price = Number(params.price);
      const deliveryDays = Number(params.deliveryDays);
      if (!Number.isFinite(price) || price <= 0) return null;
      if (!Number.isFinite(deliveryDays) || deliveryDays <= 0) return null;

      const responseId = params.id || `r_${now}_${Math.random().toString(36).slice(2, 6)}`;
      const nextCount = (task.responsesCount || 0) + 1;

      return [
        makeEffect(intentId, {
          alpha: "add", target: "responses", scope: "account", value: null,
          context: {
            id: responseId,
            executorId, taskId,
            price, deliveryDays,
            message: params.message || "",
            status: "pending",
            createdAt: now,
          },
          desc: "submit_response: add responses (status=pending)",
        }),
        makeEffect(intentId, {
          alpha: "replace", target: "task.responsesCount", scope: "account",
          value: nextCount,
          context: { id: taskId },
          desc: `submit_response: responsesCount ${task.responsesCount || 0} → ${nextCount}`,
        }),
      ];
    }

    // ─── leave_review ────────────────────────────────────────────────
    case "leave_review": {
      const dealId = params.dealId;
      const authorId = params.authorId || viewerId;
      const targetUserId = params.targetUserId;
      const role = params.role;
      const rating = Number(params.rating);

      if (!dealId || !authorId || !targetUserId || !role) return null;
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;

      const deal = (world.deals || []).find(d => d.id === dealId);
      if (!deal) return null;
      if (deal.status !== "completed") return null;

      // Author должен быть участником deal (customer или executor).
      if (authorId !== deal.customerId && authorId !== deal.executorId) return null;

      const reviewId = params.id || `rev_${now}_${Math.random().toString(36).slice(2, 6)}`;
      return [makeEffect(intentId, {
        alpha: "add", target: "reviews", scope: "account", value: null,
        context: {
          id: reviewId,
          authorId, dealId, targetUserId, role,
          rating,
          comment: params.comment || "",
          reply: "",
          createdAt: now,
        },
        desc: "leave_review: add reviews",
      })];
    }

    // ─── reply_to_review ─────────────────────────────────────────────
    case "reply_to_review": {
      const reviewId = params.id;
      const replyText = String(params.reply || "").trim();
      if (!reviewId || !replyText) return null;

      const review = (world.reviews || []).find(r => r.id === reviewId);
      if (!review) return null;
      // Ownership: ответить может только targetUserId (адресат).
      if (review.targetUserId !== viewerId) return null;
      // Only one reply.
      if (review.reply && review.reply.trim()) return null;

      return [makeEffect(intentId, {
        alpha: "replace", target: "review.reply", scope: "account",
        value: replyText,
        context: { id: reviewId },
        desc: "reply_to_review: set review.reply",
      })];
    }

    default:
      // Read-only и session-level intents (search_tasks, view_*,
      // session_set_active_role) не имеют server-side effects в этом
      // слое — агент читает через /world. Вернуть null вместо пустого
      // массива, чтобы /exec ответил 400 build_failed с понятной
      // диагностикой.
      return null;
  }
}

module.exports = { buildFreelanceEffects };
