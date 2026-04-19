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

  if (intentId === "top_up_wallet_by_card") {
    const wallet = world.wallets?.find((w) => w.id === ctx.walletId);
    if (!wallet) return null;
    const amount = Number(ctx.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const txId = `tx_${now}_${Math.random().toString(36).slice(2, 6)}`;
    return [
      mkEffect({
        alpha: "add", target: "transactions", scope: "account", value: null,
        context: {
          id: txId, walletId: wallet.id, amount, kind: "topup", status: "posted",
          note: ctx.cardLastFour ? `Card *${ctx.cardLastFour}` : "Card",
          createdAt: now,
        },
        desc: `top_up_wallet_by_card: add transactions`,
      }),
      mkEffect({
        alpha: "replace", target: "wallet.balance", scope: "account",
        value: (wallet.balance || 0) + amount,
        context: { id: wallet.id, userId: wallet.userId },
        desc: `top_up_wallet_by_card: replace wallet.balance`,
      }),
    ];
  }

  if (intentId === "accept_result" || intentId === "auto_accept_result") {
    const deal = world.deals?.find((d) => d.id === ctx.id);
    if (!deal) return null;
    if (!["on_review", "in_progress"].includes(deal.status)) return null;

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

  if (intentId === "select_executor") {
    const selectedResponse = world.responses?.find((r) => r.id === ctx.id);
    if (!selectedResponse) return null;
    const taskId = ctx.taskId || selectedResponse.taskId;

    const siblings = (world.responses || []).filter(
      (r) => r.taskId === taskId && r.id !== ctx.id
    );

    return [
      mkEffect({
        alpha: "replace", target: "response.status", scope: "account",
        value: "selected",
        context: { id: ctx.id },
        desc: `select_executor: replace response.status=selected`,
      }),
      ...siblings.map((r) => mkEffect({
        alpha: "replace", target: "response.status", scope: "account",
        value: "not_chosen",
        context: { id: r.id },
        desc: `select_executor: replace response.status=not_chosen (sibling)`,
      })),
    ];
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

  if (intentId === "confirm_deal") {
    const wallet = world.wallets?.find((w) => w.userId === ctx.customerId);
    if (!wallet) return null;
    const amount = Number(ctx.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
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
          customerId: ctx.customerId, executorId: ctx.executorId,
          taskId: ctx.taskId, responseId: ctx.responseId,
          amount, commission,
          status: "in_progress", deadline: ctx.deadline,
          createdAt: now,
          __irr: { point: "high", at: now, reason: "escrow reserved" },
        },
        desc: `confirm_deal: add deals`,
      }),
      mkEffect({
        alpha: "add", target: "transactions", scope: "account", value: null,
        context: {
          id: txId, walletId: wallet.id, dealId, amount,
          kind: "escrow-hold", status: "posted",
          note: `Escrow для сделки ${dealId}`, createdAt: now,
        },
        desc: `confirm_deal: add transactions (escrow-hold)`,
      }),
      mkEffect({
        alpha: "replace", target: "wallet.balance", scope: "account",
        value: (wallet.balance || 0) - amount,
        context: { id: wallet.id, userId: wallet.userId },
        desc: `confirm_deal: replace wallet.balance`,
      }),
      mkEffect({
        alpha: "replace", target: "wallet.reserved", scope: "account",
        value: (wallet.reserved || 0) + amount,
        context: { id: wallet.id, userId: wallet.userId },
        desc: `confirm_deal: replace wallet.reserved`,
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
