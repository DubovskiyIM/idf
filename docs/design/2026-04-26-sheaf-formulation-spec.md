# Design — Sheaf-формулировка целостности (формализация ядра)

**Дата:** 2026-04-26
**Статус:** Draft / direction note (deferred research, не implementation plan).
**Категория:** Формализация ядра.
**Severity:** Вторичное. Не на критическом пути M1.x. Полная формализация требует математика; операционная часть выделена в §2.12a/§2.12b.
**Источник:** External design review 2026-04-26 (второе письмо).
**Backlog item:** `docs/backlog.md` §2.12.
**Связь с manifest v2.1:** **возможная** глава в Часть III (Алгебра): «Целостность как когомология». Не commitment.

---

## 1. Тезис

Целостность IDF-домена сейчас определяется **как набор инвариантов, которые мы проверяем**. Sheaf-формулировка переформулирует: **целостность — математическое свойство домена, для которого инварианты — наша аппроксимация**.

Это меняет статус формата: «формат с эвристическим валидатором» → «формат с математически определимым понятием корректности».

В дух IDF («формат, не фреймворк»). В дух v2.1 («drift-protection как формальные detector'ы»).

---

## 2. Базовая структура (минимальный sketch)

| Компонент | Что значит | В IDF |
|---|---|---|
| **Site / база** | Poset (частично упорядоченное множество) ролей | 5 base roles `owner / viewer / agent / observer / admin`. Открытое множество. |
| **Sections** | Данные на каждой роли | `viewerWorld(role) = filterWorldForRole(world, role, ontology)` |
| **Restriction maps** | Как `viewerWorld(r₂)` ограничивается до `viewerWorld(r₁)` при `r₁ ≤ r₂` | `filterWorldForRole` — фильтр по `ownerField` + `role.scope` + `visibleFields` |
| **Покрытие (cover)** | Набор ролей, который «вместе видит всё» | Не формализовано |
| **Sheaf-аксиома (склейка)** | Если данные согласованы попарно на пересечении — склеиваются в глобальный объект | Не проверяется |
| **H⁰** | Глобальные сечения — что видно из любой роли | Аналог: «общедоступная часть мира» |
| **H¹** | Препятствия к склейке | Аналог: cross-role inconsistency, не уловимая локально |

---

## 3. Класс багов, который sheaf-формулировка ловит, а локальные инварианты — нет

**Пример (из external review):**
- `owner` может писать в `task.estimate`
- `viewer` не видит `task.estimate` (`visibleFields` исключает)
- `agent` может писать в `task.estimate` при условии `viewer.approved == true`
- `viewer` не видит `viewer.approved`

Каждое правило локально валидно. Вместе — неразрешимая ситуация: agent зависит от условия, которое viewer должен одобрить, но не может видеть. Это **препятствие к согласованности на пересечении ролей**, формально — ненулевая когомология H¹.

**Без sheaf**: ловится через **простой cross-reference static analysis** (см. §2.12b). Sheaf даёт **классификацию класса**, не алгоритм.

---

## 4. Где натяжки

### 4.1 Решётка ролей не одна, а две

`agent ⊆ owner` по **visible-set'ам**, но `agent ⊄ owner` по **execute-set'ам** (`canExecute`):
- `owner.canExecute` = типичные CRUD над собственными row'ами.
- `agent.canExecute` ⊃ `agent_execute_preapproved_order` — недоступен owner'у.

Это **read-poset × execute-poset** (не одна решётка). Sheaf-формализм должен учесть пару с дополнительной структурой. Удваивает сложность когомологии.

### 4.2 H¹ конечной poset вычислимо тривиально

Для конечного poset из 5 элементов когомология считается напрямую через cochain complex (rank kernel - rank image). Гротендиковские topologies / sites / sheaves of categories Spivak'а — аппарат для **бесконечного / непрерывного**. У нас 5 ролей.

**Импликация:** формализм полезен **как язык классификации** (H⁰ vs H¹ vs локальное), **не как computational tool**.

### 4.3 Cosheaf-Φ — спекулятивно

Φ — единый append-only лог, не разделённый по ролям. Эффект от admin'а **не** «расширение» эффекта от viewer'а; они независимые добавления. Inclusion-структуры между Φ_role нет.

**Что работает двойственно**: для каждой роли r определить `Φ_r` = эффекты, **видимые** этой ролью. Тогда:

```
restrict_r ∘ fold = fold ∘ filter_r
```

`filter` и `fold` коммутируют. Это **sheaf-морфизм между Φ-уровнем и world-уровнем**, не cosheaf. Это менее сильное утверждение, но операционно проверяемое.

### 4.4 «Почему именно 5 ролей» — sheaf не отвечает

Критерий «достаточно богатой, чтобы restrictions генерировали viewerWorld'ы; достаточно простой, чтобы H¹ был вычислим» выполняется при любом разумном выборе. Реальное обоснование 5 ролей — эмпирическое (13 полевых тестов).

Sheaf даёт ответ на **другой** вопрос: «как формально проверить, что текущий выбор не имеет patological holes».

---

## 5. Что брать из формулировки сейчас (operational)

### 5.1 Классификация warnings (§2.12 общий уровень)

Сейчас `domain-audit.json` — плоский список 187 findings. Классифицировать по природе препятствия:

| Класс | Природа | Пример |
|---|---|---|
| **Local** | Нарушение в одной точке | Поле `Task.priority` объявлено, но не используется ни в одном intent |
| **Pairwise (H¹-like)** | Согласовано локально, не глобально | `intent.precondition` ссылается на поле, недоступное роли с этим intent в canExecute |
| **Global (H⁰-like)** | Что-то невидимо для всех ролей, хотя должно быть | Только admin видит обязательное поле — другие role'ы получат validation error на каждом read |

**Реализация без когомологии** — отдельные lint-passes; classification — поле в каждом finding'е.

### 5.2 Operational §2.12a: `role.extends` + monotonic linter

Extension к ontology schema:

```ts
type Role = {
  base: "owner" | "viewer" | "agent" | "observer" | "admin";
  extends?: string[];           // ← новое: имена других ролей в poset
  visibleFields: Record<string, string[]>;
  canExecute: string[];
  // ...
};
```

Linter в `audit-report.mjs` (ось «role-monotonicity»):

```
∀ roleA, roleB: roleA.extends.includes(roleB) →
  ∀ entity: visibleFields(roleA, entity) ⊇ visibleFields(roleB, entity)
```

Нарушение → warning «role inheritance broken» с classification «Pairwise (H¹-like)».

### 5.3 Operational §2.12b: cross-role precondition analyzer

Для каждого `intent.precondition`:

```
∀ intent, ∀ role с intent ∈ role.canExecute:
  ∀ field referenced в precondition:
    field должен быть в visibleFields(role)
```

Нарушение → warning «precondition refers to invisible field» с classification «Pairwise (H¹-like)». Использует `@intent-driven/core/conditionParser.js` для парсинга expressions.

---

## 6. Что **не** делает этот документ

- Не пишет имплементацию sheaf-теории.
- Не определяет точную форму site / Гротендиковской topology.
- Не выбирает sheaf of sets / types / records.
- Не доказывает H⁰ / H¹ для конкретного домена.
- Не касается cosheaf-Φ — отложено до encounter с математиком.

---

## 7. Open questions для будущего sheaf-исследования

1. **Site structure.** Sheaf над poset ролей — простейший случай. Нужен ли site с Гротендиковской topology?
2. **Sheaf of...?** Sheaf of sets / types / records (Spivak-style для DB). Какой ближе к world?
3. **H¹ computation.** Эффективная для конечных poset. Для open-set base roles (5+ доменно-специфичных) — практически вычислимо?
4. **Cosheaf-Φ formalization.** Двойственная конструкция — есть ли натуральная формулировка для event-sourcing?
5. **Sheaf над эволюционирующей базой.** Если онтология меняется (см. §2.8 schema-versioning), решётка ролей тоже. Sheaf над движущейся базой — возможно ближе к stacks. Возможный original contribution.

---

## 8. Acceptance — что должно быть готово, чтобы закрыть §2.12

- [ ] §2.12a реализована — `role.extends` в schema, monotonic linter в `audit-report.mjs`.
- [ ] §2.12b реализована — cross-role precondition analyzer.
- [ ] `domain-audit.json` finding'и классифицированы (Local / Pairwise / Global).
- [ ] (Deferred) Manifest v2.1 — глава «Целостность как когомология» в Часть III, **с участием математика**.
- [ ] (Deferred) `idf-spec/` L4 conformance class — sheaf-аксиома как requirement.

§2.12a и §2.12b — **самостоятельные P1-tasks**, можно делать без sheaf-теории. §2.12c (полная формализация) — открытый research item, не commitment.
