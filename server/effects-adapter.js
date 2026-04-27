/**
 * Адаптер EffectSink-контракта (@intent-driven/effect-sink) поверх host'овой
 * Φ-pipeline (ingestEffect + broadcast). Превращает emit-вызовы из llm-bridge
 * в обычные host-эффекты через ту же валидацию что и REST/WS.
 *
 * Контракт shape:
 *   bridge: { id, intent, α, entity, entityId?, params, source, __irr? }
 *   host:   { id, intent_id, alpha, target, value, scope, parent_id, ttl, context, created_at }
 *
 * Возвращает Promise<{ confirmed: boolean, rejection?: { code, message } }>.
 * Резолвится синхронно внутри ingestEffect (delay=0): broadcast effect:confirmed
 * | effect:rejected перехватывается wrappedBroadcast'ом.
 */
const { v4: uuid } = require("uuid");

function createHostEffectSink({ ingestEffect, broadcast }) {
  return {
    async emit(effect) {
      const hostId = uuid();

      const ctx = {
        id: effect.entityId ?? hostId,
        ...effect.params,
        source: effect.source,
      };
      if (effect.__irr) ctx.__irr = effect.__irr;

      return new Promise((resolve) => {
        let resolved = false;
        const wrappedBroadcast = (event, data) => {
          broadcast(event, data);
          if (!resolved && data?.id === hostId) {
            if (event === "effect:confirmed") {
              resolved = true;
              resolve({ confirmed: true });
            } else if (event === "effect:rejected") {
              resolved = true;
              resolve({
                confirmed: false,
                rejection: {
                  code: "INVARIANT_FAIL",
                  message: data.reason ?? "rejected",
                },
              });
            }
          }
        };

        try {
          ingestEffect(
            {
              id: hostId,
              intent_id: effect.intent,
              alpha: effect.α,
              target: effect.entity,
              value: null,
              scope: "account",
              parent_id: null,
              ttl: null,
              context: JSON.stringify(ctx),
              created_at: new Date().toISOString(),
            },
            { broadcast: wrappedBroadcast, delay: 0 }
          );
        } catch (err) {
          if (!resolved) {
            resolved = true;
            resolve({
              confirmed: false,
              rejection: {
                code: "INGEST_THREW",
                message: err instanceof Error ? err.message : String(err),
              },
            });
          }
          return;
        }

        // Safety net: ingestEffect with delay=0 resolves sync, но если по какой-то
        // причине broadcast не выстрелил — отдаём UNKNOWN чтобы не зависнуть.
        if (!resolved) {
          resolved = true;
          resolve({
            confirmed: false,
            rejection: {
              code: "UNKNOWN",
              message: "ingestEffect не вернул effect:confirmed/rejected синхронно",
            },
          });
        }
      });
    },
    broadcast,
  };
}

module.exports = { createHostEffectSink };
