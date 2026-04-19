/**
 * Freelance domain — биржа услуг (12-й полевой тест).
 *
 * Тонкий buildEffects: только generic handler поверх particles.effects.
 * Cycle 1: публикация задачи → отклик (без escrow — Cycle 2).
 */
import { v4 as uuid } from "uuid";
export { INTENTS } from "./intents.js";
export { PROJECTIONS, ROOT_PROJECTIONS } from "./projections.js";
export { ONTOLOGY } from "./ontology.js";
export { getSeedEffects } from "./seed.js";
export { RULES } from "./rules.js";
import { INTENTS } from "./intents.js";

export const DOMAIN_ID = "freelance";
export const DOMAIN_NAME = "Фриланс — биржа услуг";

export function describeEffect(intentId, alpha, ctx, target) {
  const intent = INTENTS[intentId];
  return `${intent?.name || intentId}: ${alpha} ${target || ""}`;
}

// Инструментальный signal (κ-символ + описание) для SSE-стрима useEngine.
// Пока no-op — все escrow-эффекты описаны через describeEffect.
// Cycle 3+ может вернуть { κ: "💰", desc: "Escrow резервирование" } для важных.
export function signalForIntent(_intentId) {
  return null;
}

// Ownership-field auto-injection для creator intents: UI-формы не спрашивают
// customerId/authorId/executorId (ownership детали), viewer.id подставляется
// из ctx.userId перед применением effects.
const OWNERSHIP_INJECT = {
  create_task_draft: { customerId: "userId" },
  confirm_deal: { customerId: "userId" },
  leave_review: { authorId: "userId" },
  submit_response: { executorId: "userId" },
  top_up_wallet_by_card: { userId: "userId" },
};

function buildCustomEffects(intentId, ctx, world) {
  const now = Date.now();
  const mkEffect = (props) => ({
    id: uuid(),
    intent_id: intentId,
    parent_id: null,
    status: "proposed",
    ttl: null,
    created_at: now,
    ...props,
  });

  // submit_response: executor откликается на Task.status=published.
  // Guards:
  //   - task существует и status=published (иначе silent-reject: return null)
  //   - нет активного pending-отклика от того же executor'а на ту же Task
  //     (response_unique_per_executor_task — SDK cardinality не поддерживает
  //      композитный groupBy, enforcement здесь)
  // Side-effects:
  //   - add Response с status=pending
  //   - replace task.responsesCount += 1 (живой счётчик)
  if (intentId === "submit_response") {
    const taskId = ctx.taskId;
    const executorId = ctx.executorId || ctx.userId;
    if (!taskId || !executorId) return null;

    const task = world.tasks?.find((t) => t.id === taskId);
    if (!task) return null;
    if (task.status !== "published") return null;

    const hasActive = (world.responses || []).some(
      (r) => r.taskId === taskId && r.executorId === executorId && r.status === "pending"
    );
    if (hasActive) return null;

    const price = Number(ctx.price);
    const deliveryDays = Number(ctx.deliveryDays);
    if (!Number.isFinite(price) || price <= 0) return null;
    if (!Number.isFinite(deliveryDays) || deliveryDays <= 0) return null;

    const responseId = ctx.id || `r_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const nextCount = (task.responsesCount || 0) + 1;

    return [
      mkEffect({
        alpha: "add", target: "responses", scope: "account", value: null,
        context: {
          id: responseId,
          executorId, taskId,
          price, deliveryDays,
          message: ctx.message || "",
          status: "pending",
          createdAt: now,
        },
        desc: "submit_response: add responses (status=pending)",
      }),
      mkEffect({
        alpha: "replace", target: "task.responsesCount", scope: "account",
        value: nextCount,
        context: { id: taskId },
        desc: `submit_response: responsesCount ${task.responsesCount || 0} → ${nextCount}`,
      }),
    ];
  }

  // edit_response: правка активного отклика.
  // Guards: response.status=pending, response.executorId === me.
  if (intentId === "edit_response") {
    const responseId = ctx.id;
    const response = world.responses?.find((r) => r.id === responseId);
    if (!response) return null;
    if (response.status !== "pending") return null;
    if (response.executorId !== (ctx.userId || ctx.executorId)) return null;

    const patch = { id: responseId };
    if (ctx.price !== undefined && ctx.price !== "") {
      const p = Number(ctx.price);
      if (Number.isFinite(p) && p > 0) patch.price = p;
    }
    if (ctx.deliveryDays !== undefined && ctx.deliveryDays !== "") {
      const d = Number(ctx.deliveryDays);
      if (Number.isFinite(d) && d > 0) patch.deliveryDays = d;
    }
    if (ctx.message !== undefined) patch.message = ctx.message;
    // Нечего менять — no-op
    if (Object.keys(patch).length === 1) return null;

    return [mkEffect({
      alpha: "replace", target: "response", scope: "account", value: null,
      context: patch,
      desc: "edit_response: replace response (pending → pending patched)",
    })];
  }

  // withdraw_response: soft-delete через status=withdrawn (сохраняем историю).
  // Guards: status=pending, executorId === me. Сопутствующий эффект —
  // декремент task.responsesCount.
  if (intentId === "withdraw_response") {
    const responseId = ctx.id;
    const response = world.responses?.find((r) => r.id === responseId);
    if (!response) return null;
    if (response.status !== "pending") return null;
    if (response.executorId !== (ctx.userId || ctx.executorId)) return null;

    const task = world.tasks?.find((t) => t.id === response.taskId);
    const nextCount = Math.max(0, (task?.responsesCount || 0) - 1);

    const effects = [
      mkEffect({
        alpha: "replace", target: "response.status", scope: "account",
        value: "withdrawn",
        context: { id: responseId },
        desc: "withdraw_response: status pending → withdrawn",
      }),
    ];
    if (task) {
      effects.push(mkEffect({
        alpha: "replace", target: "task.responsesCount", scope: "account",
        value: nextCount,
        context: { id: task.id },
        desc: `withdraw_response: responsesCount ${task.responsesCount || 0} → ${nextCount}`,
      }));
    }
    return effects;
  }

  // create_task_draft: каждая новая Task стартует в status:"draft",
  // responsesCount:0. Форма (formModal) не спрашивает эти поля — они —
  // invariant нового объекта, а не пользовательский ввод.
  if (intentId === "create_task_draft") {
    const id = ctx.id || `task_${now}_${Math.random().toString(36).slice(2, 6)}`;
    return [mkEffect({
      alpha: "add", target: "tasks", scope: "account", value: null,
      context: {
        id,
        customerId: ctx.customerId || ctx.userId,
        title: ctx.title,
        description: ctx.description || "",
        categoryId: ctx.categoryId,
        budget: ctx.budget != null ? Number(ctx.budget) : null,
        deadline: ctx.deadline || null,
        type: ctx.type || "remote",
        city: ctx.city || "",
        status: "draft",
        responsesCount: 0,
        createdAt: now,
      },
      desc: "create_task_draft: add tasks (status=draft)",
    })];
  }

  if (intentId === "top_up_wallet_by_card") {
    // walletId приоритет: явно переданный (из routeParams/target.id на detail)
    // → свой кошелёк по viewer.userId.
    const userId = ctx.userId || ctx.clientId;
    const wallet = world.wallets?.find(
      (w) => (ctx.walletId ? w.id === ctx.walletId : w.userId === userId)
    );
    if (!wallet) return null;
    // Guard: только свой кошелёк.
    if (wallet.userId !== userId) return null;

    const amount = Number(ctx.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    // cardLastFour обязателен и ровно 4 цифры (UI validation — первый эшелон,
    // серверная проверка — второй; пустая строка / неверная длина → null).
    const cardLastFour = String(ctx.cardLastFour || "").trim();
    if (!/^\d{4}$/.test(cardLastFour)) return null;

    const txId = `tx_${now}_${Math.random().toString(36).slice(2, 6)}`;
    return [
      mkEffect({
        alpha: "add", target: "transactions", scope: "account", value: null,
        context: {
          id: txId, walletId: wallet.id, amount,
          kind: "topup", status: "posted",
          note: `Card *${cardLastFour}`,
          createdAt: now,
        },
        desc: `top_up_wallet_by_card: add transactions (topup)`,
      }),
      mkEffect({
        alpha: "replace", target: "wallet.balance", scope: "account",
        value: (wallet.balance || 0) + amount,
        context: { id: wallet.id, userId: wallet.userId },
        desc: `top_up_wallet_by_card: balance ${wallet.balance || 0} → ${(wallet.balance || 0) + amount}`,
      }),
    ];
  }

  if (intentId === "accept_result" || intentId === "auto_accept_result") {
    const deal = world.deals?.find((d) => d.id === ctx.id);
    if (!deal) return null;
    // Только из on_review — иначе можно принимать работу до её сдачи.
    // Повторный accept_result на completed тоже отсекается здесь.
    if (deal.status !== "on_review") return null;
    // Для ручного accept — customer-ownership guard.
    if (intentId === "accept_result") {
      const viewerId = ctx.userId || ctx.clientId;
      if (deal.customerId !== viewerId) return null;
    }

    const custWallet = world.wallets?.find((w) => w.userId === deal.customerId);
    const exeWallet  = world.wallets?.find((w) => w.userId === deal.executorId);
    if (!custWallet || !exeWallet) return null;

    const amount = Number(deal.amount);
    const commission = Number(deal.commission) || 0;
    const payout = amount - commission;
    if (!Number.isFinite(payout) || payout < 0) return null;

    const rTx = `tx_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const cTx = `tx_${now + 1}_${Math.random().toString(36).slice(2, 6)}`;

    return [
      mkEffect({
        alpha: "replace", target: "deal.status", scope: "account",
        value: "completed",
        context: { id: deal.id, completedAt: now },
        desc: `${intentId}: replace deal.status=completed`,
      }),
      mkEffect({
        alpha: "add", target: "transactions", scope: "account", value: null,
        context: {
          id: rTx, walletId: exeWallet.id, dealId: deal.id,
          amount: payout, kind: "release", status: "posted",
          note: `Payout для сделки ${deal.id}`, createdAt: now,
        },
        desc: `${intentId}: add transactions (release)`,
      }),
      mkEffect({
        alpha: "add", target: "transactions", scope: "account", value: null,
        context: {
          id: cTx, walletId: custWallet.id, dealId: deal.id,
          amount: commission, kind: "commission", status: "posted",
          note: `Комиссия платформы ${commission}`, createdAt: now,
        },
        desc: `${intentId}: add transactions (commission)`,
      }),
      mkEffect({
        alpha: "replace", target: "wallet.balance", scope: "account",
        value: (exeWallet.balance || 0) + payout,
        context: { id: exeWallet.id, userId: exeWallet.userId },
        desc: `${intentId}: replace executor wallet.balance`,
      }),
      mkEffect({
        alpha: "replace", target: "wallet.reserved", scope: "account",
        value: Math.max(0, (custWallet.reserved || 0) - amount),
        context: { id: custWallet.id, userId: custWallet.userId },
        desc: `${intentId}: replace customer wallet.reserved`,
      }),
    ];
  }

  if (intentId === "leave_review") {
    const deal = world.deals?.find((d) => d.id === ctx.dealId);
    if (!deal) return null;
    if (deal.status !== "completed") return null;
    const author = ctx.authorId || ctx.userId;
    if (author !== deal.customerId && author !== deal.executorId) return null;
    return undefined;
  }

  // select_executor: customer выбирает один Response → selected; все остальные
  // Response'ы этой task (включая ранее-selected при смене решения) →
  // not_chosen. Guards: customer-ownership task'а + response.status=pending.
  //
  // Критический порядок effects: сначала демотируем siblings (включая
  // previously-selected), потом промотируем выбранный. Иначе между
  // emit promote(B) и emit demote(A) world имеет 2 selected → инвариант
  // task_has_at_most_one_selected_response откатывает promote. Правильный
  // порядок гарантирует, что на каждом шаге ≤1 selected.
  if (intentId === "select_executor") {
    const selectedResponse = world.responses?.find((r) => r.id === ctx.id);
    if (!selectedResponse) return null;
    if (selectedResponse.status !== "pending") return null;

    const taskId = ctx.taskId || selectedResponse.taskId;
    const task = world.tasks?.find((t) => t.id === taskId);
    if (!task) return null;

    // Customer-ownership guard: только владелец task'а может выбирать.
    const viewerId = ctx.userId || ctx.clientId;
    if (task.customerId !== viewerId) return null;

    // Siblings, которые надо демотировать: всё кроме ctx.id, status ∈
    // {pending, selected} (withdrawn/not_chosen не трогаем — final states).
    const siblings = (world.responses || []).filter(
      (r) => r.taskId === taskId && r.id !== ctx.id &&
             (r.status === "pending" || r.status === "selected")
    );

    const effects = siblings.map((r) => mkEffect({
      alpha: "replace", target: "response.status", scope: "account",
      value: "not_chosen",
      context: { id: r.id },
      desc: `select_executor: demote sibling ${r.id} (${r.status} → not_chosen)`,
    }));
    // Promote выбранный ПОСЛЕ всех demote — инвариант видит ≤1 selected
    // на каждом шаге.
    effects.push(mkEffect({
      alpha: "replace", target: "response.status", scope: "account",
      value: "selected",
      context: { id: ctx.id },
      desc: `select_executor: promote ${ctx.id} (pending → selected)`,
    }));
    return effects;
  }

  if (intentId === "cancel_deal_mutual") {
    const deal = world.deals?.find((d) => d.id === ctx.id);
    if (!deal) return null;
    if (["completed", "cancelled"].includes(deal.status)) return null;

    const custWallet = world.wallets?.find((w) => w.userId === deal.customerId);
    if (!custWallet) return null;

    const amount = Number(deal.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const txId = `tx_${now}_${Math.random().toString(36).slice(2, 6)}`;

    return [
      mkEffect({
        alpha: "replace", target: "deal.status", scope: "account",
        value: "cancelled",
        context: { id: deal.id, cancelledAt: now, cancelReason: ctx.reason },
        desc: `cancel_deal_mutual: replace deal.status=cancelled`,
      }),
      mkEffect({
        alpha: "add", target: "transactions", scope: "account", value: null,
        context: {
          id: txId, walletId: custWallet.id, dealId: deal.id, amount,
          kind: "refund", status: "posted",
          note: `Refund по сделке ${deal.id}: ${ctx.reason || "mutual cancel"}`,
          createdAt: now,
        },
        desc: `cancel_deal_mutual: add transactions (refund)`,
      }),
      mkEffect({
        alpha: "replace", target: "wallet.balance", scope: "account",
        value: (custWallet.balance || 0) + amount,
        context: { id: custWallet.id, userId: custWallet.userId },
        desc: `cancel_deal_mutual: replace wallet.balance`,
      }),
      mkEffect({
        alpha: "replace", target: "wallet.reserved", scope: "account",
        value: Math.max(0, (custWallet.reserved || 0) - amount),
        context: { id: custWallet.id, userId: custWallet.userId },
        desc: `cancel_deal_mutual: replace wallet.reserved`,
      }),
    ];
  }

  // request_revision: customer возвращает работу на доработку.
  // on_review → revision_requested. Комментарий (причина) сохраняется в
  // Deal.revisionComment. Revokes auto-accept timer (через revokeOn
  // в rules.js). Повторение цикла revision → submit не ограничено.
  if (intentId === "request_revision") {
    const deal = world.deals?.find((d) => d.id === ctx.id);
    if (!deal) return null;
    if (deal.status !== "on_review") return null;
    const viewerId = ctx.userId || ctx.clientId;
    if (deal.customerId !== viewerId) return null;
    const comment = String(ctx.comment || "").trim();
    if (!comment) return null;

    return [
      mkEffect({
        alpha: "replace", target: "deal", scope: "account", value: null,
        context: {
          id: deal.id,
          revisionComment: comment,
          revisionRequestedAt: now,
        },
        desc: `request_revision: store comment on Deal`,
      }),
      mkEffect({
        alpha: "replace", target: "deal.status", scope: "account",
        value: "revision_requested",
        context: { id: deal.id },
        desc: `request_revision: deal.status on_review → revision_requested`,
      }),
    ];
  }

  // submit_revision: executor сдаёт правки → revision_requested → on_review.
  // Перезапускает auto-accept timer через rule trigger на submit_revision.
  if (intentId === "submit_revision") {
    const deal = world.deals?.find((d) => d.id === ctx.id);
    if (!deal) return null;
    if (deal.status !== "revision_requested") return null;
    const viewerId = ctx.userId || ctx.clientId;
    if (deal.executorId !== viewerId) return null;
    if (!ctx.result || !String(ctx.result).trim()) return null;

    return [
      mkEffect({
        alpha: "replace", target: "deal", scope: "account", value: null,
        context: {
          id: deal.id,
          result: String(ctx.result).trim(),
          links: ctx.links ? String(ctx.links).trim() : (deal.links || ""),
          submittedAt: now,
        },
        desc: `submit_revision: update result+links on Deal`,
      }),
      mkEffect({
        alpha: "replace", target: "deal.status", scope: "account",
        value: "on_review",
        context: { id: deal.id },
        desc: `submit_revision: deal.status revision_requested → on_review (cycle ${(deal.revisionComment ? '≥1' : '1')})`,
      }),
    ];
  }

  // submit_work_result: executor сдаёт работу → deal.status in_progress → on_review.
  // Guards: deal.status=in_progress, deal.executorId = viewer.
  // Result/links сохраняются в Deal.context для дальнейшего просмотра.
  if (intentId === "submit_work_result") {
    const deal = world.deals?.find((d) => d.id === ctx.id);
    if (!deal) return null;
    if (deal.status !== "in_progress") return null;
    const viewerId = ctx.userId || ctx.clientId;
    if (deal.executorId !== viewerId) return null;
    if (!ctx.result || !String(ctx.result).trim()) return null;

    return [
      mkEffect({
        alpha: "replace", target: "deal", scope: "account", value: null,
        context: {
          id: deal.id,
          result: String(ctx.result).trim(),
          links: ctx.links ? String(ctx.links).trim() : "",
          submittedAt: now,
        },
        desc: `submit_work_result: store result+links on Deal`,
      }),
      mkEffect({
        alpha: "replace", target: "deal.status", scope: "account",
        value: "on_review",
        context: { id: deal.id },
        desc: `submit_work_result: deal.status in_progress → on_review`,
      }),
    ];
  }

  if (intentId === "confirm_deal") {
    // ctx.id = response.id (per-item call на Response.status=selected).
    // Всё остальное (customer/executor/task/amount/deadline) derive'ится.
    const response = world.responses?.find((r) => r.id === ctx.id);
    if (!response) return null;
    if (response.status !== "selected") return null;

    const task = world.tasks?.find((t) => t.id === response.taskId);
    if (!task) return null;

    // Customer-ownership guard.
    const viewerId = ctx.userId || ctx.clientId;
    if (task.customerId !== viewerId) return null;

    // Защита от повторного подтверждения: если уже есть Deal на эту task
    // со статусом in_progress/on_review/completed — return null.
    const existingDeal = (world.deals || []).find(
      (d) => d.taskId === task.id && ["in_progress", "on_review", "completed"].includes(d.status)
    );
    if (existingDeal) return null;

    const wallet = world.wallets?.find((w) => w.userId === task.customerId);
    if (!wallet) return null;

    const amount = Number(response.price);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    // Balance check — недостаточно средств => silent reject.
    if ((wallet.balance || 0) < amount) return null;

    const COMMISSION_RATE = 0.1;
    const commission = Math.round(amount * COMMISSION_RATE);
    const dealId = `deal_${now}_${Math.random().toString(36).slice(2, 6)}`;
    const txId = `tx_${now}_${Math.random().toString(36).slice(2, 6)}`;

    return [
      mkEffect({
        alpha: "add", target: "deals", scope: "account", value: null,
        context: {
          id: dealId,
          customerId: task.customerId, executorId: response.executorId,
          taskId: task.id, responseId: response.id,
          amount, commission,
          status: "in_progress",
          deadline: task.deadline || null,
          createdAt: now,
          // __irr: markers irreversibility — IrreversibleBadge читает отсюда.
          __irr: { point: "high", at: now, reason: "escrow reserved" },
        },
        desc: `confirm_deal: add Deal(in_progress) customer=${task.customerId} executor=${response.executorId} amount=${amount}`,
      }),
      mkEffect({
        alpha: "add", target: "transactions", scope: "account", value: null,
        context: {
          id: txId, walletId: wallet.id, dealId, amount,
          kind: "escrow-hold", status: "posted",
          note: `Escrow для сделки ${dealId}`, createdAt: now,
        },
        desc: `confirm_deal: add Transaction(escrow-hold)`,
      }),
      mkEffect({
        alpha: "replace", target: "wallet.balance", scope: "account",
        value: (wallet.balance || 0) - amount,
        context: { id: wallet.id, userId: wallet.userId },
        desc: `confirm_deal: wallet.balance ${wallet.balance || 0} → ${(wallet.balance || 0) - amount}`,
      }),
      mkEffect({
        alpha: "replace", target: "wallet.reserved", scope: "account",
        value: (wallet.reserved || 0) + amount,
        context: { id: wallet.id, userId: wallet.userId },
        desc: `confirm_deal: wallet.reserved ${wallet.reserved || 0} → ${(wallet.reserved || 0) + amount}`,
      }),
    ];
  }

  return undefined;
}

export function buildEffects(intentId, ctx, world, drafts) {
  const intent = INTENTS[intentId];
  if (!intent) return null;
  const intentEffects = intent.particles?.effects || [];
  if (intentEffects.length === 0) return null;

  const injectRules = OWNERSHIP_INJECT[intentId];
  if (injectRules && ctx.userId) {
    const patches = {};
    for (const [field, source] of Object.entries(injectRules)) {
      if (ctx[field] === undefined && ctx[source] !== undefined) {
        patches[field] = ctx[source];
      }
    }
    if (Object.keys(patches).length > 0) ctx = { ...ctx, ...patches };
  }

  const customEffects = buildCustomEffects(intentId, ctx, world);
  if (customEffects !== undefined) return customEffects;

  const now = Date.now();
  const effects = [];
  const push = (props) => effects.push({
    id: uuid(), intent_id: intentId, parent_id: null, status: "proposed",
    ttl: null, created_at: now, ...props,
  });

  for (const iEf of intentEffects) {
    const alpha = iEf.α;
    const target = iEf.target;
    const scope = iEf.σ || "account";

    switch (alpha) {
      case "add": {
        const entityId = ctx.id || `${target.slice(0, 4)}_${now}_${Math.random().toString(36).slice(2, 6)}`;
        push({
          alpha: "add", target, scope, value: null,
          context: { id: entityId, ...ctx, createdAt: now },
          desc: describeEffect(intentId, "add", ctx, target),
        });
        break;
      }
      case "replace": {
        const entityId = ctx.id || ctx.entityId;
        const field = target.includes(".") ? target.split(".").pop() : target;
        const resolvedValue =
          iEf.value !== undefined ? iEf.value
          : ctx[field] !== undefined ? ctx[field]
          : ctx.value;
        if (entityId && resolvedValue !== undefined) {
          push({
            alpha: "replace", target, scope, value: resolvedValue,
            context: { id: entityId, userId: ctx.userId || ctx.ownerId },
            desc: describeEffect(intentId, "replace", ctx, target),
          });
        }
        break;
      }
      case "remove": {
        const entityId = ctx.id || ctx.entityId;
        if (entityId) {
          push({
            alpha: "remove", target, scope, value: null,
            context: { id: entityId, userId: ctx.userId || ctx.ownerId },
            desc: describeEffect(intentId, "remove", ctx, target),
          });
        }
        break;
      }
    }
  }

  return effects.length > 0 ? effects : null;
}
