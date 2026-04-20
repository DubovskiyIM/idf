# Freelance — 12-й полевой тест IDF

Биржа услуг: customer публикует задачу → executor откликается → escrow-подтверждение → сдача работы → приёмка → reviews.

## Статус: working state (Cycle 1 + escrow core)

### Реализовано

- **3 роли**: guest / customer / executor с base-таксономией
- **12 сущностей**: User, CustomerProfile, ExecutorProfile, Skill, ExecutorSkill, Category, Task, Response, Deal, Wallet, Transaction, Review
- **46 intents**, в том числе:
  - Auth (5): register / verify / login / logout / reset
  - Task lifecycle (8): draft → moderation → published → closed
  - Response (5): submit / edit / withdraw / view / select_executor
  - Deal escrow (7): confirm_deal / submit_work_result / accept_result / auto_accept / request_revision / submit_revision / cancel_deal_mutual
  - Wallet (7): top_up / view_balance / view_history + 4 internal (reserve / release / refund / commission)
  - Review (3): leave / reply / view
- **6 invariants**: task FSM, response FK, cardinality (1 selected per task), deal FSM, aggregate (wallet.reserved = Σ escrow-hold), referential (customerId ≠ executorId)
- **2 Rules**: auto_accept_after_3d (schedule), recalc_rating (aggregation, weightedAvg с halfLife 180d)
- **7 projections** (5 в ROOT): task_catalog_public (authored market-filter), my_task_list / my_response_list / my_deal_list / my_wallet_detail (derived R7/R7b/R3b + field-level authored overrides), + task_detail / deal_detail (derived + field-level override с `toolbar` whitelist — per-role через ownership cond + permittedFor, role-specific wrapper'ы удалены в Stage 5)
- **Escrow computation layer** (custom `buildEffects`): 6 custom branches
  - `top_up_wallet_by_card` — Transaction(topup) + replace wallet.balance
  - `confirm_deal` — Deal(in_progress) + Transaction(escrow-hold) + replace customer.balance/reserved; guard: balance >= amount
  - `accept_result` / `auto_accept_result` — replace deal.status=completed + Transaction(release → executor) + Transaction(commission → customer) + wallet.balance/reserved пересчёт
  - `cancel_deal_mutual` — replace deal.status=cancelled + Transaction(refund) + возврат customer.balance/reserved
  - `select_executor` — multi-effect для invariant task_has_at_most_one_selected_response (selected + siblings → not_chosen)
  - `leave_review` guard — null если deal не completed или author не участник
- **Manual smoke**: 7 happy-path + 4 negative шагов в [`MANUAL_SMOKE.md`](./MANUAL_SMOKE.md)
- **Тестовое покрытие**: 157 unit-тестов passing (92 доменных + 65 escrow). Escrow-тесты в [`escrow.test.js`](./escrow.test.js).

### Намеренно отложено

- **Real Stripe / PSP integration** — top_up_wallet_by_card используется как mock (instant wallet crediting, card только как metadata)
- **Admin-dispute resolution** — только mutual_cancel; полный диспут с арбитром в Cycle 3+
- **Chat между customer и executor** — Cycle 3
- **KYC / verified badges** — Cycle 4
- **Canvas для analytics** (рейтинги, статистика deals) — Cycle 4
- **Agent-preapproval** — пока нет (invest/delivery имеют)
- **Polymorphic dispute types** — unifilar mutual-cancel сейчас
- **Role.scope для Deal по executorId** — сейчас `"own"` с server-side костылём (deals где viewer=customer OR viewer=executor)
- **Agent-smoke integration** — unit-тесты покрывают buildEffects; полный integration через `/api/agent/freelance/exec` — отдельный PR (требует запуска server + seed'а новых пользователей)

### Известные компромиссы

1. **Commission hardcoded 10%** в `buildCustomEffects` — разумная default для MVP, вынести в ontology features или per-category override — следующий itera
2. **FSM allows `new → in_progress` напрямую** — пропускаем `awaiting_payment` шаг в упрощённой модели (реальный PSP ввёл бы промежуточное состояние)
3. **auto_accept_after_3d rule** — объявлен, но требует server-side scheduler для реальной работы (schedule extension существует, testable только через ручной fast-forward времени)
4. **Deal.executorId видимость через `"own"`** — server-side filter в `filterWorldForRole` должен проверять и customerId и executorId. Подлежит замене на role.scope в будущей ревизии

### Структура файлов

```
src/domains/freelance/
  ontology.js                  (388 LOC) — 12 entities, 3 roles, 6 invariants
  intents.js                   (848 LOC) — 46 intents, 8 категорий
  projections.js               (158 LOC) — 8 projections, 4 ROOT
  domain.js                    (252 LOC) — generic + 6 custom buildEffects branches
  rules.js                     (37 LOC)  — 2 rules
  seed.js                      (225 LOC) — 5 users + 10 tasks + 20 responses + 3 deals + 5 transactions + 3 reviews
  MANUAL_SMOKE.md              — 7-шаговый manual test
  README.md                    — этот файл
  ontology.test.js             — ontology + roles + invariants
  intents.test.js              — intent structure + irreversibility markers
  projections.test.js          — archetypes, ROOT, subCollections
  rules.test.js                — schedule / aggregation syntax
  filterworld-multi-role.test.js — viewer-scoping
  escrow.test.js               — NEW: custom buildEffects для escrow + select + leave_review
```

### Команды

```bash
npm test src/domains/freelance         # 157 unit-тестов
npm run server && npm run dev          # UI-тестирование по MANUAL_SMOKE.md
```
