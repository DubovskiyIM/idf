# IDF Specification v1.0 — Part 1: Core Model

**Status:** Draft  
**Version:** 1.0  
**Date:** 2026-04-13  

---

## 1. Introduction

### 1.1 Purpose

This specification defines the core model of the Intent-Driven Framework (IDF): a formal system for describing, verifying, and executing intentional actions within a domain. The core model is transport-agnostic and rendering-agnostic — it defines the semantic foundation upon which UI renderers, API generators, smart contract compilers, and other consumers are built.

An IDF implementation takes as input an ontology (§2), a set of intentions (§3), and a stream of effects (§4), and produces as output a computable world (§5). All higher-level constructs — projections, algebras, integrity rules — are defined over this foundation.

### 1.2 Conformance Levels

This specification defines three conformance levels, each inclusive of all requirements from the previous level:

- **Level 1 (Core):** Fold semantics, effect lifecycle, causal ordering, batch unwinding, presentation effects, and scope rules. An implementation conformant at Level 1 MUST correctly compute World(t) from a stream of effects. Conformance test IDs: `level-1/*`.

- **Level 2 (Algebra):** All of Level 1, plus intent relation derivation from particles (§6). An implementation conformant at Level 2 MUST derive the five relation types (sequential, antagonistic, excluding, parallel) plus the adjacency map from intention definitions alone. Conformance test IDs: `level-2/*`.

- **Level 3 (Full):** All of Level 2, plus the seven integrity rules (§7). An implementation conformant at Level 3 MUST enforce all integrity invariants and report violations with structured diagnostics. Conformance test IDs: `level-3/*`.

Implementations MUST declare their conformance level. Partial conformance within a level is not permitted: an implementation either satisfies ALL requirements of a level or it does not claim that level.

### 1.3 Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

Additional terms used throughout this specification:

- **Domain:** A bounded context described by an ontology, a set of intentions, and a set of projections.
- **Actor:** A human user, an automated agent, or any system component that executes intentions.
- **World(t):** The computed state of all entities at logical time t.
- **Φ (Phi):** The complete, append-only set of effects. Subscripts denote subsets: Φ_confirmed, Φ_proposed.
- **Π (Pi):** The subset of Φ where `scope = "presentation"`.
- **≺ (precedes):** The causal ordering relation on effects.
- **⊕ (fold operator):** The sequential application operator that reduces a sorted effect sequence into a world.
- **Particle:** One of the four groups that compose an intention: conditions, effects, witnesses, confirmation.

---

## 2. Ontology

An ontology describes the structural vocabulary of a domain: the entity types, their fields, and their relationships. The ontology is static metadata — it does not change at runtime.

### 2.1 Entity

An Entity is a named domain type representing a class of persistent objects within the domain.

**Requirements:**

1. Entity names MUST be PascalCase identifiers matching the pattern `^[A-Z][a-zA-Z0-9]*$`.
2. Entity names MUST be unique within a domain. An ontology MUST NOT declare two entities with the same name.
3. Every entity has an implicit field `id` of type `id` (a string, unique per collection). This field MUST NOT be redeclared in the field list.
4. An ontology MUST declare at least one entity.

**Representation:**

An ontology is a map from entity names to entity descriptors:

```json
{
  "entities": {
    "Listing": {
      "fields": { ... },
      "ownerField": "sellerId"
    },
    "Bid": {
      "fields": { ... },
      "ownerField": "bidderId"
    }
  }
}
```

> **Schema:** See `schemas/ontology.schema.json`

### 2.2 Field

Fields describe entity properties. Each field is identified by a camelCase name and carries type information used for validation, access control, and UI derivation.

Two formats are defined:

#### 2.2.1 Typed Format (normative)

Each field is an object with the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | MUST | One of: `id`, `text`, `number`, `boolean`, `datetime`, `enum`, `image`, `file`, `audio`, `entityRef`. Implementations MAY extend with custom types prefixed by `x-`. |
| `read` | string[] | OPTIONAL | Roles that can read this field. `["*"]` means all roles. If omitted, the field is readable by all roles. |
| `write` | string[] | OPTIONAL | Roles that can write this field. `["*"]` means all roles. If omitted, the field is writable by all roles. |
| `required` | boolean | OPTIONAL | Whether the field MUST be present when creating an entity instance. Default: `false`. |
| `label` | string | OPTIONAL | Human-readable label for display purposes. |
| `values` | string[] | OPTIONAL | Allowed values when `type` is `"enum"`. MUST be present if and only if `type` is `"enum"`. |
| `valueLabels` | object | OPTIONAL | A map from enum value to human-readable display label. Keys MUST be a subset of `values`. |

**Type semantics:**

| Type | Value Domain | Notes |
|------|-------------|-------|
| `id` | Non-empty string | Unique identifier within collection |
| `text` | String | Arbitrary text |
| `number` | IEEE 754 double | Numeric value |
| `boolean` | `true` or `false` | Boolean flag |
| `datetime` | ISO 8601 string | Date, time, or datetime |
| `enum` | One of `values` | Constrained string |
| `image` | URL string | Image resource reference |
| `file` | URL string | File resource reference |
| `audio` | URL string | Audio resource reference |
| `entityRef` | String (entity id) | Foreign key to another entity |

#### 2.2.2 Array Format (legacy, conformant)

A field list as a string array:

```json
["id", "title", "status", "sellerId", "price"]
```

This is equivalent to the typed format where each field has its type inferred from its name. The inference algorithm is implementation-defined but SHOULD use the following heuristics:

- Fields ending in `Id` → `entityRef`
- Fields named `status` → `enum`
- Fields named `price`, `amount`, `count`, `rating` → `number`
- Fields ending in `At`, `Time`, `Date` → `datetime`
- Fields named `id` → `id`
- All others → `text`

Implementations MUST support both formats. When both formats are present for the same entity, the typed format takes precedence.

### 2.3 Owner Field

An entity MAY declare `ownerField`: a string naming a field that identifies the owner of each entity instance.

**Requirements:**

1. The named field MUST exist in the entity's field list.
2. The named field SHOULD be of type `entityRef` referencing a User or Actor entity, but this is not enforced at the ontology level.
3. An entity MUST NOT declare more than one `ownerField`.

**Semantics:**

- **Access control:** An actor whose id matches the `ownerField` value of an entity instance is considered the owner of that instance. Ownership grants implicit write access for intentions that target that instance.
- **Projection derivation:** Ownership information enables generation of "my items" filtered views without explicit intention definitions.
- **Validation:** The agent and API layers SHOULD check ownership before allowing write operations on entities with a declared `ownerField`, unless the actor has an elevated role that bypasses ownership checks.

### 2.4 Entity Relationships

Entity relationships are derived from field definitions. Two detection methods are defined, in priority order:

**Method 1 — Explicit (typed format):**

A field with `type: "entityRef"` declares an explicit foreign key relationship. The referenced entity is determined by stripping the `Id` suffix from the field name and matching (case-insensitive) against declared entity names.

Example: A field named `listingId` with `type: "entityRef"` in the `Bid` entity references the `Listing` entity.

**Method 2 — Heuristic (array format):**

In array-format field lists, any field name ending with `Id` (excluding the field `id` itself) is treated as a potential foreign key. The referenced entity is determined by the same suffix-stripping rule.

**Requirements:**

1. An implementation MUST support both detection methods.
2. The field `id` MUST NOT be treated as a foreign key under any method.
3. If a field name after suffix stripping does not match any declared entity name (case-insensitive), the relationship SHOULD be flagged as unresolved. Behavior for unresolved relationships is implementation-defined.
4. Circular references (Entity A references Entity B which references Entity A) are permitted and MUST NOT cause errors in ontology validation.

> **Conformance:** `level-1/ontology-001` through `level-1/ontology-005`

---

## 3. Intention

An Intention is the atomic semantic unit of the IDF model. It represents a named action that an actor can perform within a domain, complete with preconditions, effects, informational requirements, and interaction guidance.

### 3.1 Particles

An intention consists of a name (its identifier) and four particle groups:

#### 3.1.1 Conditions

Conditions are an array of string predicates that define when an intention is applicable. Each predicate is a boolean expression over entity fields and the current time.

**Syntax:**

Each condition string MUST conform to one of the following patterns:

| Pattern | Example | Semantics |
|---------|---------|-----------|
| `entity.field = value` | `listing.status = "active"` | Equality |
| `entity.field != value` | `order.status != "completed"` | Inequality |
| `entity.field > value` | `bid.amount > 0` | Greater than |
| `entity.field >= value` | `bid.amount >= 100` | Greater than or equal |
| `entity.field < value` | `poll.optionCount < 20` | Less than |
| `entity.field <= value` | `booking.endTime <= now` | Less than or equal |
| `entity.field IN [v1, v2, ...]` | `listing.status IN ["active", "paused"]` | Set membership |
| `entity.field != null` | `listing.sellerId != null` | Non-null check |
| `entity.field = null` | `listing.winnerId = null` | Null check |

String values in conditions MUST be quoted with double quotes. Numeric values MUST NOT be quoted. The keyword `now` refers to the current timestamp and MUST be supported.

**Applicability rule:**

An intention is applicable in World(t) if and only if ALL its conditions evaluate to `true` in that world. Formally:

```
applicable(I, W(t)) ⟺ ∀ c ∈ I.conditions: eval(c, W(t)) = true
```

An empty conditions array (or absent conditions) means the intention is always applicable.

**Condition classification:**

Conditions are classified into two types based on their temporal behavior:

- **Static:** A condition that depends solely on World(t) and changes only when an effect modifies the referenced field. Example: `listing.status = "active"`.
- **Temporal:** A condition that depends on the current time (`now`) and changes continuously without any effect being applied. Example: `booking.endTime <= now`.

An implementation MUST evaluate all conditions before confirming an effect. An implementation SHOULD distinguish static from temporal conditions to enable reactive scheduling (e.g., scheduling a re-evaluation when a temporal condition is expected to change truth value).

#### 3.1.2 Effects

Effects are an array of effect declarations describing the state changes that occur when the intention is executed.

Each effect declaration is an object with the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `α` | string | MUST | Algebraic type: `"add"`, `"replace"`, `"remove"`, or `"batch"` |
| `target` | string | MUST | Entity field path (e.g., `"listing.status"`) for `replace`, or collection name (e.g., `"listings"`) for `add`/`remove` |
| `σ` | string | OPTIONAL | Scope override. Default: `"account"` |
| `value` | any | OPTIONAL | New value for `replace`; sub-effects array for `batch` |

Effect declarations are templates — they describe what will happen, not the concrete persisted effects. Concrete effects (§4) are instantiated from these declarations at execution time, populated with actor-supplied parameters and system-generated identifiers.

#### 3.1.3 Witnesses

Witnesses are an array of strings naming fields that the actor needs to observe before making an informed decision about executing the intention.

**Semantics:**

Witnesses have no runtime effect on fold or validation. They are purely informational: they tell the crystallizer (or any consumer) which data to present to the actor when offering the intention. Witnesses inform the actor, not the system.

**Computed witnesses:**

A witness MAY be a string expression rather than a simple field name. Two forms are defined:

- `count(collection)` — the number of entities in the named collection. Example: `count(bids)`.
- `ratio(collection.field = value, collection)` — the ratio of entities matching a predicate to the total in the collection. Example: `ratio(votes.value = "yes", votes)`.

Computed witnesses are evaluated at render time, not at fold time. They do not affect the world computation.

#### 3.1.4 Confirmation

Confirmation is a string indicating the expected interaction pattern for executing the intention.

Defined values:

| Value | Semantics |
|-------|-----------|
| `"click"` | Single button press or tap. No additional input required. |
| `"enter"` | Text input followed by submission. Typically a single field. |
| `"form"` | Multi-field form requiring the actor to fill several parameters. |

Custom confirmation strings are permitted. An implementation MUST accept any string value. The confirmation particle guides crystallization and UI rendering but has no effect on core semantics (fold, validation, lifecycle).

> **Schema:** See `schemas/intent.schema.json`

### 3.2 Creates Declaration

An intention MAY declare a `creates` property: a string indicating that executing the intention produces a new entity instance.

**Syntax:**

The `creates` value MUST conform to one of two forms:

1. **Simple:** `"EntityName"` — declares creation of an entity with no implied initial status. Example: `"Bid"`.
2. **With implied status:** `"EntityName(initialStatus)"` — declares creation of an entity with an initial status field value. Example: `"Listing(draft)"`.

**Semantics:**

The parenthesized suffix is an implied status: for the purposes of algebra derivation (§6.1), it is treated as an implicit `replace entity.status = "initialStatus"` effect. This allows the algebra to trace the status lifecycle without requiring the intention to explicitly declare the status-setting effect.

**Normalization:**

Implementations MUST normalize `creates` by stripping the parenthesized suffix when computing entity references for relationship derivation. That is, `"Listing(draft)"` and `"Listing"` both reference the `Listing` entity.

### 3.3 Antagonist Declaration

An intention MAY declare an `antagonist` property: a string referencing the identifier of another intention.

**Semantics:**

The antagonist declaration asserts semantic mutual exclusion between two intentions. For example, `publish_listing` might declare `antagonist: "unpublish_listing"`, indicating that the two represent opposing actions on the same entity.

The declaration is a hint, not a derivation. The intent algebra (§6.2) uses antagonist declarations as input but classifies each declared pair as either structurally confirmed (both intentions have opposing `replace` effects on the same field) or heuristic (the declaration exists but structural confirmation fails). See §7.7 for validation of heuristic antagonists.

**Requirements:**

1. The referenced intention MUST exist in the domain's intention set. An implementation SHOULD warn if it does not.
2. Antagonist declarations are not required to be symmetric. If A declares B as antagonist, B is not required to declare A (though it SHOULD for clarity).

### 3.4 Irreversibility

An intention MAY declare an `irreversibility` property with one of three values:

| Value | Semantics |
|-------|-----------|
| `"low"` | Effects are easily reversible (e.g., toggling a setting) |
| `"medium"` | Effects require effort to reverse (e.g., editing a published post) |
| `"high"` | Effects are practically irreversible (e.g., deleting an account, completing a financial transaction) |

**Semantics:**

Irreversibility governs confirmation proportionality (§7.4): high-irreversibility intentions SHOULD require more deliberate confirmation (e.g., a confirmation dialog rather than a single click). However, irreversibility has no effect on core fold semantics — it is metadata for consumers.

> **Conformance:** `level-1/intent-001` through `level-1/intent-008`

---

## 4. Effect

An Effect is a persisted, immutable record of a state change produced by executing an intention. Effects are the atoms of state in IDF: the world is never stored directly but is always computed from the complete set of confirmed effects.

### 4.1 Algebraic Types

An effect has the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | MUST | Unique identifier. MUST be unique across all effects in the system. |
| `intent_id` | string | MUST | The identifier of the intention that produced this effect. |
| `alpha` | string | MUST | One of: `"add"`, `"replace"`, `"remove"`, `"batch"`. |
| `target` | string | MUST | Collection name (for `add`/`remove`) or entity field path (for `replace`). |
| `value` | any | OPTIONAL | New value for `replace`; sub-effects array for `batch`; absent for `add`/`remove`. |
| `scope` | string | MUST | Visibility scope (see §4.5). |
| `parent_id` | string | OPTIONAL | Causal parent effect id (see §4.3). |
| `status` | string | MUST | One of: `"proposed"`, `"confirmed"`, `"rejected"`. |
| `ttl` | integer | OPTIONAL | Time-to-live in milliseconds (see §4.4). |
| `context` | object | MUST | Entity context. MUST contain at minimum an `id` field for targeted operations (`replace`, `remove`). For `add`, contains the full entity data. |
| `created_at` | integer | MUST | Unix timestamp in milliseconds of effect creation. |
| `resolved_at` | integer | OPTIONAL | Unix timestamp in milliseconds of confirmation or rejection. MUST be set when `status` transitions from `"proposed"`. |

**Semantics of each α-type:**

**`add`** — Creates a new entity instance. The `target` field MUST be a collection name (plural, lowercase). The `context` object contains the entity fields including `id`. If an entity with the same `id` already exists in the target collection, behavior is implementation-defined (the implementation SHOULD reject the effect or perform an upsert).

**`replace`** — Updates a single field on an existing entity. The `target` field MUST be an entity field path of the form `"entity.field"` (e.g., `"listing.status"`). The `context.id` field identifies the entity instance. The `value` field contains the new field value. If the targeted entity does not exist in the collection, the implementation MAY create a partial entity containing only `{id, [field]: value}` (upsert semantics) or MAY reject the effect.

**`remove`** — Deletes an entity instance. The `target` field MUST be a collection name. The `context.id` field identifies the entity instance to remove. If the entity does not exist, the implementation SHOULD treat this as a no-op (idempotent removal).

**`batch`** — An atomic group of sub-effects. The `value` field MUST be an array of effect objects. Validation is all-or-nothing: if ANY sub-effect fails validation, the ENTIRE batch MUST be rejected. Sub-effects within a batch MUST NOT declare their own `parent_id` — the batch effect itself serves as their causal container.

**Composition table** for two effects on the same target:

| `α₁` \ `α₂` | replace | add | remove | batch |
|---|---|---|---|---|
| **replace** | last-write-wins by ≺ | ⊥ | ⊥ | valid |
| **add** | ⊥ | merge | depends on ≺ | valid |
| **remove** | ⊥ | depends on ≺ | merge | valid |
| **batch** | valid | valid | valid | valid |

`⊥` denotes a forbidden composition — an implementation MUST detect these at integrity check time (§7.6) rather than silently accepting them at runtime.

- **replace + replace** on the same field: last-write-wins, ordered by ≺ (or by `created_at` if no causal relationship).
- **add + remove** (or **remove + add**) on the same entity: validity depends on ≺ ordering. If `add ≺ remove`, the sequence is valid (create then delete). If `remove ≺ add`, the sequence is valid (delete then recreate). Without ≺ ordering, behavior is implementation-defined.
- **add + add** on the same entity id: merge fields from both effects. Conflicting fields use last-write-wins by ≺.
- **remove + remove** on the same entity id: merge (idempotent).
- **batch** composes with any type: the batch is unwound (§5.3) and each sub-effect is composed individually.

> **Schema:** See `schemas/effect.schema.json`  
> **Conformance:** `level-1/effect-001` through `level-1/effect-015`

### 4.2 Lifecycle

Every effect transitions through exactly one of two terminal paths:

```
proposed → confirmed
proposed → rejected
```

An effect MUST be created in the `proposed` state. An effect MUST NOT transition from `confirmed` to any other state, nor from `rejected` to any other state. The lifecycle is strictly monotonic.

**Validation before confirmation:**

An implementation MUST perform the following validation steps before transitioning an effect to `confirmed`:

1. **Cascade check:** If `parent_id` is set and the referenced parent effect has `status: "rejected"`, this effect MUST be rejected.
2. **Condition check:** All conditions of the originating intention (identified by `intent_id`) MUST evaluate to `true` in World(t) at the time of confirmation. If any condition fails, the effect MUST be rejected.
3. **Existence check:** For `replace` and `remove` operations, the target entity (identified by `context.id`) MUST exist in World(t), unless the implementation explicitly supports upsert semantics for `replace`.
4. **Batch validation:** For `batch` effects, each sub-effect in the `value` array MUST be validated recursively. If any sub-effect fails validation, the entire batch MUST be rejected.

**Resolution timestamp:**

An implementation MUST set `resolved_at` to the current Unix timestamp (milliseconds) when transitioning an effect from `proposed` to either `confirmed` or `rejected`.

### 4.3 Causal Ordering

Effects MAY declare `parent_id` referencing the `id` of another effect. This establishes a causal dependency: the child effect is semantically dependent on the parent.

**Definition of ≺:**

`f₁ ≺ f₂` (read: "f₁ causally precedes f₂") if and only if `f₁.id` is in the transitive closure of the `parent_id` chain of `f₂`. Formally:

- Base case: `f₁ ≺ f₂` if `f₂.parent_id = f₁.id`.
- Transitive: `f₁ ≺ f₃` if there exists `f₂` such that `f₁ ≺ f₂` and `f₂ ≺ f₃`.

**Cascade rejection:**

If effect f transitions to `rejected`, ALL effects g where `f ≺ g` MUST also transition to `rejected`. This cascade MUST be applied recursively and atomically: no causal descendant of a rejected effect may remain `confirmed` or `proposed`.

**Topological sort requirement:**

Before fold (§5.1), the set of confirmed effects MUST be sorted such that for any pair `f₁ ≺ f₂`, `f₁` appears before `f₂` in the sorted sequence. Effects without a causal relationship (neither `f₁ ≺ f₂` nor `f₂ ≺ f₁`) SHOULD be ordered by `created_at` as a tiebreaker. This tiebreaker MUST be deterministic: effects with equal `created_at` SHOULD be further ordered by `id` (lexicographic).

**Cycle handling:**

Cycles in the `parent_id` graph MUST be detected by the implementation. Behavior on cycle detection is implementation-defined, but the implementation SHOULD reject all effects participating in the cycle. An implementation MUST NOT enter an infinite loop when processing cyclic parent references.

**Orphaned references:**

A `parent_id` value that references a non-existent effect id MUST be treated as if `parent_id` were absent (the effect is a root with no causal dependency). An implementation SHOULD log a warning for orphaned references.

> **Conformance:** `level-1/causal-001` through `level-1/causal-012`

### 4.4 TTL (Time-To-Live)

An effect MAY declare `ttl` as a positive integer representing a duration in milliseconds.

**Expiration rule:**

An effect is expired when `now - created_at > ttl`, where `now` is the current Unix timestamp in milliseconds and `created_at` is the effect's creation timestamp.

**Requirements:**

1. When an effect expires, it MUST be automatically transitioned to `rejected`.
2. Cascade rejection (§4.3) applies: all causal descendants of the expired effect MUST also be rejected.
3. An implementation MUST check TTL expiration either eagerly (via timer or scheduler) or lazily (at the next fold or query). The specific strategy is implementation-defined.
4. The world MUST NOT reflect expired effects. An expired effect that has not yet been formally rejected MUST be treated as rejected during fold computation.
5. An effect with `ttl: 0` expires immediately and MUST be rejected.

### 4.5 Scope

The `scope` field declares the visibility boundary of an effect.

| Scope | Semantics |
|-------|-----------|
| `"session"` | Visible only within the originating session. Lost when the session ends. |
| `"device"` | Visible on the originating device across sessions. |
| `"account"` | Visible to all sessions and devices belonging to the actor's account. |
| `"shared"` | Visible to a defined group of actors. Group membership is implementation-defined. |
| `"global"` | Visible to all actors in the system. |
| `"presentation"` | Visual-only effect, excluded from the semantic fold. See §5.4. |

**Requirements:**

1. The default scope is `"account"`. If `scope` is absent or empty, the implementation MUST treat it as `"account"`.
2. Effects with `scope: "presentation"` MUST NOT participate in the semantic fold (§5.1). They form the presentation stream Π (§5.4).
3. Scope governs visibility, not persistence. An implementation MAY persist effects of any scope but MUST enforce visibility rules when computing World(t) for a given actor.
4. Implementations MAY define additional scope values prefixed with `x-`. Unknown scope values SHOULD be treated as `"account"`.

> **Conformance:** `level-1/scope-001` through `level-1/scope-003`

---

## 5. World Computation

The world is the central derived artifact of IDF. It is never stored as primary state — it is always computed from the complete set of confirmed effects. This section defines the computation formally.

### 5.1 Fold Semantics

The world at time t is defined as:

```
World(t) = fold(⊕, ∅, sort≺(Φ_confirmed ↓ t))
```

Where:

- **Φ_confirmed** is the set of all effects with `status: "confirmed"`.
- **↓ t** restricts the set to effects with `created_at ≤ t`.
- **sort≺** is the topological sort by causal ordering (§4.3, §5.2).
- **∅** is the empty world: an empty object `{}` with no collections and no entities.
- **⊕** is the sequential apply operator: given a world state and an effect, it produces a new world state.

The resulting world is a map of collection names to entity arrays:

```
World = { [collection: string]: Entity[] }
```

Where each `Entity` is an object with at minimum an `id` field and zero or more additional fields.

**Pluralization rules for collection names:**

Collection names are derived from entity names by the following rules, applied in order:

1. If the entity name ends in `s`, append `es` (e.g., `Status` → `statuses`).
2. If the entity name ends in `y` preceded by a consonant, replace `y` with `ies` (e.g., `Category` → `categories`).
3. Otherwise, append `s` (e.g., `Listing` → `listings`, `Bid` → `bids`).
4. The result is lowercased.

An implementation MAY provide custom pluralization rules or an override map, but the above rules MUST be the default.

**Apply rules for ⊕:**

For each effect in the sorted sequence, the fold operator applies the following transformation based on `alpha`:

- **`add`:** Insert `context` as a new entity into the collection named by `target`. The entity's `id` is `context.id`. If `context.id` is absent, the effect's `id` SHOULD be used as the entity's `id`.

- **`replace`:** Parse `target` as `"entity.field"`. Determine the collection name from the entity name using pluralization rules. Find the entity with `id = context.id` in that collection. Set the field (the segment after the dot) to `value`. If no entity with that `id` exists, the implementation MAY create a partial entity `{id: context.id, [field]: value}` (upsert) or skip the effect.

- **`remove`:** Find the entity with `id = context.id` in the collection named by `target`. Remove it from the collection. If no entity with that `id` exists, the effect is a no-op.

- **`batch`:** Unwrap the sub-effects in `value` and apply each one sequentially using the same rules (see §5.3).

**Exclusions:**

The following effects MUST be excluded from the semantic fold:

1. Effects with `target` starting with `"drafts"` (draft namespace).
2. Effects with `scope: "presentation"` (presentation stream, see §5.4).

**Normative property:**

The world is NEVER stored as primary state. It is always computed from effects. An implementation MUST be able to reconstruct any `World(t)` from Φ alone, given the same set of effects and the same time parameter. Two implementations processing the same Φ MUST produce identical World(t) values.

> **Conformance:** `level-1/fold-001` through `level-1/fold-020`

### 5.2 Causal Sort

Before applying fold, the set of confirmed effects MUST be sorted topologically by the `parent_id` relation so that for any pair `f₁ ≺ f₂`, `f₁` appears before `f₂` in the sorted sequence.

**Requirements:**

1. The sort MUST be stable: effects without a causal relationship (neither `f₁ ≺ f₂` nor `f₂ ≺ f₁`) MUST preserve their relative order as determined by `created_at` (ascending). Effects with identical `created_at` MUST be further ordered by `id` (lexicographic, ascending).

2. Orphaned `parent_id` references — those pointing to effect ids not present in the input set — MUST be treated as roots. The effect with the orphaned reference is placed according to its `created_at` value, as if it had no `parent_id`.

3. Cycles MUST be detected. When a cycle is detected, the implementation SHOULD treat all effects in the cycle as roots (removing their `parent_id` edges) and place them in `created_at` order. An implementation MUST NOT loop infinitely or crash on cyclic input.

**Algorithm:**

Both DFS-based topological sort and Kahn's algorithm (BFS-based) are conformant. The specific algorithm is implementation-defined, provided it satisfies the requirements above.

**Complexity:**

The sort SHOULD complete in O(n + e) time where n is the number of effects and e is the number of parent-child edges.

> **Conformance:** `level-1/causal-sort-001` through `level-1/causal-sort-006`

### 5.3 Batch Unwinding

When the fold operator encounters an effect with `alpha: "batch"`, it MUST unwind the batch into its constituent sub-effects and apply them individually.

**Procedure:**

1. Read the `value` array of the batch effect. Each element is a sub-effect object.
2. Iterate over the array in order (index 0 first).
3. For each sub-effect, apply it using the standard ⊕ rules for its `alpha` type.
4. If a sub-effect is itself a batch (`alpha: "batch"`), unwind it recursively. There is no depth limit imposed by this specification, but implementations SHOULD guard against excessive nesting (e.g., depth > 100).

**Inherited properties:**

Sub-effects within a batch inherit the following properties from the batch effect unless they explicitly override them:

| Property | Inherited | Override permitted |
|----------|-----------|-------------------|
| `intent_id` | Yes | No — sub-effects MUST share the batch's `intent_id` |
| `scope` | Yes | Yes — a sub-effect MAY declare its own scope |
| `parent_id` | No — sub-effects MUST NOT declare `parent_id` | No |
| `status` | Yes — all sub-effects share the batch's lifecycle | No |

> **Conformance:** `level-1/batch-001` through `level-1/batch-005`

### 5.4 Presentation Effects (Π)

Effects with `scope: "presentation"` form a separate logical stream Π (Pi). Presentation effects represent visual or cosmetic state changes — such as the position of a node on a canvas, a user's scroll position, or a panel's collapsed state — that do not affect the semantic world.

**Visual state computation:**

The visual state at time t is defined as:

```
Visual(t) = applyPresentation(World(t), sort≺(Π_confirmed ↓ t))
```

Where:

- `World(t)` is the semantic world computed by §5.1 (excluding presentation effects).
- `Π_confirmed` is the set of all confirmed effects with `scope: "presentation"`.
- `sort≺` is the same causal sort (§5.2).
- `applyPresentation` operates on a **copy** of World(t), leaving the original unmodified.

**Restrictions on presentation effects:**

1. Presentation effects MUST use `alpha: "replace"` only. The `add` and `remove` algebraic types MUST NOT be used with `scope: "presentation"`. An implementation MUST reject presentation effects with `alpha: "add"` or `alpha: "remove"`.
2. Presentation effects modify existing entities only — they overlay visual properties onto entities that exist in the semantic world.
3. Presentation effects MUST NOT be counted when evaluating conditions (§3.1.1) or computed witnesses (§3.1.3).

**Distinguishability:**

An implementation MUST keep semantic effects (Φ minus Π) and presentation effects (Π) distinguishable at all times. They MAY share physical storage provided the `scope: "presentation"` discriminator is preserved and queryable.

> **Conformance:** `level-1/presentation-001` through `level-1/presentation-003`

---

## 6. Intent Algebra

The intent algebra derives a graph of relations between intentions from their particles. The graph is a computed artifact — it has no independent source of truth and MUST be recomputed when the intention set changes.

The output is an adjacency map: `{ [intentId]: IntentRelations }` where `IntentRelations` contains five lists: `sequentialIn`, `sequentialOut`, `antagonists`, `excluding`, `parallel`.

### 6.1 Sequential (▷)

`I₁ ▷ I₂` means an effect of I₁ makes a condition of I₂ satisfiable.

**Derivation algorithm:**

For each condition c in I₂, parse c as `{entity, field, op, value}`. For each effect e in I₁:

- If `e.alpha` is `replace` AND `e.target` matches `entity.field` AND `e.value` matches the condition's value → `I₁ ▷ I₂`.
- If `e.alpha` is `remove` AND the condition tests `= null` on the removed entity → `I₁ ▷ I₂`.
- If `e.alpha` is `add` AND the condition tests `!= null` → implementation SHOULD NOT generate ▷ (high false-positive risk).

**Creates implied status:** If I₁ has `creates: "Entity(status)"`, this implies a synthetic `replace entity.status = "status"` for ▷ derivation purposes. This ensures workflow graphs are connected from creation intents.

When `I₁ ▷ I₂`, `I₁` is added to `I₂.sequentialIn` and `I₂` is added to `I₁.sequentialOut`.

> **Conformance:** `level-2/seq-001` through `level-2/seq-010`

### 6.2 Antagonistic (⇌)

`I₁ ⇌ I₂` means applying I₁ then I₂ (or vice versa) returns the world to the prior state.

**Derivation algorithm:**

For each effect e₁ in I₁, search for a reversing effect e₂ in I₂:

- `replace` + `replace` on same target with different values → bistable reversal candidate.
- `add` + `remove` on same collection → reversal.
- `remove` + `add` on same collection → reversal.

`I₁ ⇌ I₂` is recognized only if reversal effects cover ALL changes on both sides (complete reversal).

**Declared antagonist classification:**

If an intention declares `antagonist: "other_id"`, the implementation MUST classify it:

- **Structural witness:** The derivation algorithm confirmed full effect pair-reversal.
- **Heuristic witness:** The declaration is accepted on the author's authority, but derivation did not find structural reversal.

Both classifications are valid — heuristic declarations are not errors. The classification MUST be reported by integrity rule §7.7.

> **Conformance:** `level-2/ant-001` through `level-2/ant-008`

### 6.3 Excluding (⊕)

`I₁ ⊕ I₂` means effects of I₁ and I₂ conflict by the composition table (§4.1).

**Derivation algorithm:**

For each pair `(e₁, e₂) ∈ I₁.effects × I₂.effects` operating on the same target, check the composition table. If any pair yields ⊥ → `I₁ ⊕ I₂`.

Note: `replace` + `replace` on the same target is NOT ⊕ — it resolves by causal ordering (last-write-wins). Only structural mismatches (e.g., `replace` + `add` on the same entity) produce ⊕.

> **Conformance:** `level-2/excl-001` through `level-2/excl-005`

### 6.4 Parallel (∥)

`I₁ ∥ I₂` means the intentions share entities but have none of the above relations.

**Derivation algorithm:**

After computing ▷, ⇌, and ⊕ for all pairs, two intentions are ∥ if:

1. Their effects reference at least one shared entity (by target entity name), AND
2. No ▷, ⇌, or ⊕ relation exists between them.

∥ is the weakest relation — it means "safe to execute independently on shared entities."

> **Conformance:** `level-2/par-001` through `level-2/par-004`

### 6.5 Adjacency Map

The complete output of the algebra is a map from each intent id to its relation sets:

```json
{
  "publish_listing": {
    "sequentialIn": ["create_listing"],
    "sequentialOut": ["place_bid", "buy_now"],
    "antagonists": ["cancel_listing"],
    "excluding": [],
    "parallel": ["edit_listing"]
  }
}
```

An implementation MUST produce a complete adjacency map (every intent id present as a key). Empty relation arrays MUST be included, not omitted.

> **Conformance:** `level-2/map-001` through `level-2/map-003`

---

## 7. Integrity Rules

Seven rules verified against the intention set and ontology. All rules operate on static definitions, not on World(t) at runtime.

Severity levels:

- **error** — blocks further processing (crystallization, validation).
- **warning** — advisory, does not block.
- **info** — informational.

### 7.1 No Dead Intents

For every intention I in the set, there MUST exist at least one reachable world state in which ALL conditions of I are simultaneously satisfiable.

**Detection heuristic:** An intention with non-empty conditions and zero `sequentialIn` edges in the ▷-graph is a dead intent candidate — unless its conditions reference seed/initial state.

Severity: **warning**.

> **Conformance:** `level-3/dead-001` through `level-3/dead-003`

### 7.2 No Orphan Effects

Every effect declared in an intention MUST be observable: there MUST exist at least one projection whose entities intersect with the effect's target entity.

If no projections are provided (pure-core usage without crystallization), this rule SHOULD be skipped.

Severity: **warning**.

> **Conformance:** `level-3/orphan-001` through `level-3/orphan-003`

### 7.3 Witness Completeness

For every intention I, the set of witnesses SHOULD cover all entity fields referenced in conditions. Formally: for each condition c referencing `entity.field`, either:

- `field` appears in `witnesses(I)`, OR
- `field` is an implicit witness: `me.id`, `now`, or a field guaranteed by projection context (e.g., a filter ensures only matching entities are visible).

Severity: **info**.

> **Conformance:** `level-3/witness-001` through `level-3/witness-003`

### 7.4 Confirmation Proportionality

The confirmation strength SHOULD be proportional to effect irreversibility:

- `irreversibility: "high"` → confirmation SHOULD require explicit typed input or multi-step flow.
- `irreversibility: "medium"` → confirmation SHOULD require explicit click with description.
- `irreversibility: "low"` or absent → single click is sufficient.

The core model MUST expose the `irreversibility` value for downstream consumers. Enforcement is consumer-specific (e.g., crystallization for UI, documentation for agent layer).

Severity: **warning**.

> **Conformance:** `level-3/confirm-001` through `level-3/confirm-002`

### 7.5 Anchoring

Every entity, field, and collection referenced in intention particles MUST exist in the ontology:

- Each entity name parsed from `particles.entities` entries → MUST match an ontology entity.
- Each effect target `entity.field` → `entity` MUST match an ontology entity, `field` MUST exist in that entity's fields (for typed format; for array format, `field` MUST be present in the array).
- Each witness field → MUST be resolvable to an ontology entity field.

This is the only rule with **error** severity — a failed anchoring check MUST block crystallization and SHOULD block effect validation.

Severity: **error**.

> **Conformance:** `level-3/anchor-001` through `level-3/anchor-005`

### 7.6 Algebra Composition

No two intentions that are commonly applicable (their conditions can be simultaneously true in some world state) SHOULD have effects that yield ⊥ in the composition table (§4.1).

Detection: if `I₁ ⊕ I₂` AND the conjunction of conditions `C(I₁) ∧ C(I₂)` is satisfiable → this rule is violated. If `C(I₁) ∧ C(I₂)` is unsatisfiable, the exclusion is safe (the intentions are never both applicable).

Severity: **warning**.

> **Conformance:** `level-3/composition-001` through `level-3/composition-002`

### 7.7 Antagonist Validation

Every declared `antagonist` MUST be classified by the algebra (§6.2):

- **Structural:** full effect pair-reversal confirmed by derivation.
- **Heuristic:** accepted on author's declaration, no structural backing.

The implementation MUST report the classification for each declared antagonist. Heuristic classifications are valid but inform the author that their declaration relies on domain knowledge, not formal structure.

Severity: **info**.

> **Conformance:** `level-3/antagonist-001` through `level-3/antagonist-003`

---

## 8. Conformance

### 8.1 Conformance Levels

| Level | Name | Requires | Test Suite |
|-------|------|----------|------------|
| 1 | Core | §2–§5: Ontology, Intentions, Effects, World Computation | `conformance/level-1/` |
| 2 | Algebra | Level 1 + §6: Intent relation derivation | `conformance/level-2/` |
| 3 | Full | Level 2 + §7: All integrity rules | `conformance/level-3/` |

An implementation MUST declare which level it targets. An implementation claiming Level N conformance MUST pass ALL test cases for levels 1 through N.

### 8.2 Conformance Test Format

All conformance tests are JSON files with the following structure:

**Level 1 (fold/effect):**

```json
{
  "id": "level-1/fold-001",
  "level": 1,
  "name": "fold applies add effect to empty world",
  "description": "A single add effect creates one entity in the world",
  "input": {
    "effects": [
      {
        "id": "e1",
        "intent_id": "create_user",
        "alpha": "add",
        "target": "users",
        "value": null,
        "scope": "account",
        "parent_id": null,
        "status": "confirmed",
        "ttl": null,
        "context": { "id": "u1", "name": "Alice", "email": "alice@test.com" },
        "created_at": 1000
      }
    ],
    "ontology": {
      "entities": {
        "User": {
          "fields": {
            "id": { "type": "id" },
            "name": { "type": "text" },
            "email": { "type": "text" }
          }
        }
      }
    }
  },
  "expected": {
    "world": {
      "users": [
        { "id": "u1", "name": "Alice", "email": "alice@test.com" }
      ]
    }
  }
}
```

**Level 2 (algebra):**

```json
{
  "id": "level-2/seq-001",
  "level": 2,
  "name": "replace effect creates sequential link",
  "input": {
    "intents": { ... },
    "ontology": { ... }
  },
  "expected": {
    "relations": {
      "publish_listing": {
        "sequentialIn": ["create_listing"]
      }
    }
  }
}
```

**Level 3 (integrity):**

```json
{
  "id": "level-3/anchor-001",
  "level": 3,
  "name": "anchoring detects missing entity",
  "input": {
    "intents": { ... },
    "ontology": { ... }
  },
  "expected": {
    "findings": [
      { "rule": "anchoring", "intentId": "bad_intent", "severity": "error", "message": "Entity 'Foo' not found in ontology" }
    ]
  }
}
```

An implementation reads JSON input, executes its own code, and compares output to `expected`. A test passes if the output matches. Partial matching: for Level 2, only the relations listed in `expected.relations` are checked (other relations MAY be present). For Level 3, all listed findings MUST be present (additional findings MAY be present).

### 8.3 Versioning

This specification follows semantic versioning:

- **PATCH** increment: editorial corrections, no normative changes.
- **MINOR** increment: new optional features, additional conformance tests, non-breaking clarifications.
- **MAJOR** increment: changes to normative requirements that may break existing conformant implementations.

An implementation SHOULD declare both its conformance level and the specification version: e.g., "IDF v1.0 Level 2 conformant".

---

© 2026 IDF Authors. This specification is licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).
