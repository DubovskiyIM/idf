# IDF Specification v1.1 — Part 2: Projections, Crystallization, Witnesses

**Status:** Draft (§1, §5 normative; §2–4, §6–8 placeholders for v1.2)
**Version:** 1.1
**Date:** 2026-04-19
**Relationship to Part 1:** Part 2 depends on Part 1 (Core Model). Every Part 2 normative requirement is compatible with and additive to Part 1.

---

## Table of Contents

1. Introduction
2. Projection *(placeholder — v1.2)*
3. Slot Taxonomy *(placeholder — v1.2)*
4. Crystallization Contract *(placeholder — v1.2)*
5. **Witness Protocol** *(normative)*
6. Pattern Bank *(placeholder — v1.2)*
7. Control Archetypes *(placeholder — v1.2)*
8. Adapter Capability Surface *(placeholder — v1.2)*
9. Conformance

---

## 1. Introduction

### 1.1 Purpose

Part 1 defines the **data model** of IDF: ontology, intent, effect, world computation, intent algebra, integrity. Part 1 is complete for any implementation that only needs to fold effects and compute relations.

Part 2 defines the **derivation layer**: how a projection (an abstract view declaration, oriented at an entity) combined with an intent set and ontology produces a structured artifact that downstream materializers (pixels, voice, document, agent-API) consume.

Part 1 can be implemented without Part 2 (a pure data layer). Part 2 cannot be implemented without Part 1 — it consumes Part 1's intent and ontology formats as input.

### 1.2 Relationship to §9 (Determinism) of Part 1

Part 1 §9 states that any derivation from the input triple `(INTENTS, PROJECTIONS, ONTOLOGY)` MUST be deterministic as a function of semantic content. §9.2 explicitly points forward:

> "A derivation that reaches step 3 above [lexicographic id tie-break] is producing a semantically arbitrary choice; the implementation SHOULD record this fact in any derivation trace it emits (see Part 2 for the witness record protocol)."

§5 of this document is the forward reference: it defines the normative witness record protocol.

### 1.3 Scope of This Draft

This release contains normative content only for §5 (Witness Protocol). Sections §2–§4 and §6–§8 are placeholders describing their intended scope; an implementation MUST NOT rely on their contents as normative until v1.2.

The rationale for shipping §5 independently: §9.2 of Part 1 references a forward-defined protocol. Without §5 in place, that reference is unresolvable — impl cannot claim v1.1 conformance. §5 is small and self-contained enough to stand on its own.

### 1.4 Terminology

The terms in §1.3 of Part 1 apply here. Additionally:

- **Artifact.** The output of the crystallization derivation for a single projection: an object that consumers (materializers) render. The precise shape is defined in §4 (placeholder; see Part 1 §9 for the general property an artifact must satisfy).
- **Witness record.** An entry in `artifact.witnesses[]` that documents a specific structural decision made during derivation. Format defined in §5.
- **Tied group.** A maximal set of ≥2 candidates for a single bounded slot that share the same salience value after §3.5 (Part 1) evaluation.

---

## 2. Projection *(placeholder — v1.2)*

*This section will formalize the projection declaration: archetypes (feed, catalog, detail, form, canvas, dashboard, wizard), mainEntity, query field, layout hints, views, and the projection JSON schema (`schemas/projection.schema.json`).*

*Pending from v1.0: `schemas/projection.schema.json` does not yet exist.*

---

## 3. Slot Taxonomy *(placeholder — v1.2)*

*This section will formalize the six canonical slots (`header`, `toolbar`, `hero`, `body`, `context`, `fab`, `overlay`), archetype-specific extensions (`sections`, `primaryCTA`, `footer`, `viewSwitcher`), capacity semantics for each slot, and the rules by which contention resolves.*

---

## 4. Crystallization Contract *(placeholder — v1.2)*

*This section will formalize the mapping `(INTENTS, PROJECTIONS, ONTOLOGY) → Record<projectionId, Artifact>`, archetype-specific slot assignment semantics, and the artifact JSON schema (`schemas/artifact.schema.json`).*

*Until this section is normative, an implementation MAY produce any artifact shape consistent with Part 1 §9 (Determinism), and MUST emit witnesses per §5 whenever it performs a structural decision described in §5.*

---

## 5. Witness Protocol

### 5.1 Witnesses Array

Every artifact produced by a crystallization derivation MUST include a `witnesses` property: an array of witness records. Implementations MUST emit `witnesses: []` even when the array is empty (the key MUST be present).

### 5.2 Witness Record Shape

A witness record is an object with the following properties:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `basis` | string | MUST | Kind of structural decision (§5.3). |
| `reliability` | string | MUST | `"rule-based"` \| `"heuristic"` \| `"constructive"` (§5.4). |
| `pattern` | string | MAY | Identifier of the rule or pattern that produced the witness. Semantic meaning is basis-specific. |
| `slot` | string | MAY | Name of the slot to which the decision applies (e.g., `"toolbar"`). |
| `projection` | string | MAY | Identifier of the projection in whose artifact the witness appears. |
| `requirements` | array | MAY | Per-requirement breakdown: `[{kind, ok, spec}]`. Required when basis implies trigger evaluation (e.g., pattern-bank matching). |
| (other) | any | MAY | Basis-specific fields. See §5.3 for per-basis requirements. |

Additional properties MAY be present. Consumers MUST ignore properties they do not recognize.

### 5.3 Basis Values (Normative)

The following basis values are normative. An implementation MAY define additional basis values for implementation-specific witnesses; such values SHOULD be namespaced (e.g., `"vendor:feature-x"`) to avoid future collision with normative values.

#### 5.3.1 `"anchoring"`

Emitted when the derivation verifies that an intent's entities are anchored to the ontology (Part 1 §7.5).

Required additional fields: `requirements[]` with per-entity checks.
Permissible reliability values: `"rule-based"` or `"constructive"`.

#### 5.3.2 `"pattern-bank"`

Emitted when a structural pattern matched the projection. Pattern Bank is an implementation mechanism — precise semantics are out of scope for §5 and will be defined in §6 (placeholder). §5 only standardizes the witness record shape.

Required additional fields: `pattern` (string identifier), `requirements[]`.
Permissible reliability values: `"rule-based"`.

#### 5.3.3 `"polymorphic-variant"`

Emitted when the projection's `mainEntity` is a polymorphic entity (has `discriminator` and `variants`). One witness per projection.

Required additional fields: `pattern: "polymorphic:variant-resolution"`, `requirements[{kind: "entity-has-discriminator", ok: true, spec: {entity, discriminator, variants: [...]}}]`.
Permissible reliability values: `"rule-based"`.

#### 5.3.4 `"temporal-section"`

Emitted when a detail-archetype artifact contains a section rendered as an event timeline (one witness per such section).

Required additional fields: `pattern: "temporal:event-timeline"`, `requirements[{kind: "sub-entity-temporality", ok: true, spec: {entity, temporality}}]`.
Permissible reliability values: `"rule-based"`.

#### 5.3.5 `"alphabetical-fallback"` *(new in v1.1)*

Emitted when, after applying §3.5 salience ranking (Part 1) to a set of ≥2 candidates for a bounded slot, two or more candidates remain tied and the implementation resolved the tie by lexicographic comparison of their identifiers.

This witness is the **record required by Part 1 §9.2** when a derivation reaches the lexicographic tie-break step.

Required additional fields:

| Property | Type | Semantics |
|----------|------|-----------|
| `slot` | string | Canonical slot name (e.g., `"toolbar"`). |
| `projection` | string | Identifier of the projection whose artifact contains this witness. |
| `salience` | number | The salience value shared by all members of the tied group. |
| `chosen` | string | Identifier of the intent selected by the lexicographic tie-break (`min` in lexicographic order of the tied group). |
| `peers` | array of strings | Identifiers of the other tied candidates, in lexicographic order. |
| `recommendation` | string | Human-readable hint directing the author toward resolving the tie via `intent.salience`. |

Permissible reliability: `"heuristic"` only. An implementation MUST NOT emit an `alphabetical-fallback` witness with `reliability: "rule-based"` — the choice is by definition not rule-based.

**Emission rule:** an implementation MUST emit one `alphabetical-fallback` witness per tied group encountered during derivation. If a projection has multiple tied groups (e.g., different slots, or multiple salience bands within one slot), the implementation MUST emit one witness per group.

**Singletons are not tied groups:** if a candidate's salience is unique among candidates, no witness is emitted for it.

### 5.4 Reliability Values (Normative)

| Value | Meaning |
|-------|---------|
| `"rule-based"` | The witness is the product of a named rule with explicit, checkable requirements. An artifact consumer MAY treat this witness as a positive assertion. |
| `"constructive"` | The witness is backed by a constructive proof (e.g., all referenced entities exist in the ontology, all particles type-check). An artifact consumer MAY treat this witness as a verified assertion. |
| `"heuristic"` | The witness records an algorithmic choice that is not derivable from rules or constructive proofs. An artifact consumer MUST NOT treat this witness as an assertion of correctness; it is information about the derivation, not about the input. |

An implementation MAY emit new reliability values (e.g., `"experimental"`) only if the value is namespaced. Consumers MUST treat unrecognized reliability values as `"heuristic"` by default.

### 5.5 Ordering

Witness records within `artifact.witnesses[]` MUST be emitted in deterministic order. Implementations MUST order witnesses by the following key tuple, ascending:

1. `basis` (lexicographic)
2. `slot` (lexicographic; empty string if absent)
3. `projection` (lexicographic; empty string if absent)
4. `chosen` (lexicographic; empty string if absent)

This ensures that artifact diffs are stable under permutation (Part 1 §9.1).

### 5.6 Consumer Contract

An implementation of a materializer (pixels, voice, document, agent-API) SHOULD expose `artifact.witnesses` to downstream tools. In particular:

- **Studio-type tools:** SHOULD highlight `reliability: "heuristic"` witnesses as potential spec-debt for the author.
- **Lint tools:** SHOULD treat `basis: "alphabetical-fallback"` witnesses as warnings. A domain with zero such witnesses has no unresolved tied choices.
- **Conformance tools:** MUST use `witnesses[]` as part of the artifact equality check (with §5.5 ordering). Two conformant implementations MUST emit identical witness sets.

### 5.7 Conformance Test Fixtures

Fixtures for §5 will be added to `conformance/level-1/witness-*.json` in v1.2. Until then, an implementation claiming v1.1 conformance MUST self-verify §5 emission against its own reference test suite.

> **Schema:** `schemas/witness.schema.json` (new in v1.1)

---

## 6. Pattern Bank *(placeholder — v1.2)*

*This section will formalize Pattern Bank: the structure-rewriting mechanism that matches declarative patterns (trigger + structure + rationale) against a projection and applies approved patterns. It will also formalize the falsification framework.*

---

## 7. Control Archetypes *(placeholder — v1.2)*

*This section will formalize the mapping from a single intent to a control archetype (button, inline-form, overlay-modal, wizard, etc.) based on `intent.confirmation` and parameters.*

---

## 8. Adapter Capability Surface *(placeholder — v1.2)*

*This section will formalize `adapter.capabilities` — the declarative contract between a crystallization-derived artifact and a UI adapter about which primitives the adapter supports, so that crystallize can fall back gracefully.*

---

## 9. Conformance

### 9.1 Part 2 Conformance Levels

| Level | Name | Scope |
|-------|------|-------|
| P2-L1 | Witness Emission | Implementation MUST emit witnesses per §5, with correct `basis` and `reliability` values, and §5.5 ordering. |
| P2-L2 | Projection & Slot | Reserved for v1.2 (§2, §3). |
| P2-L3 | Crystallization Contract | Reserved for v1.2 (§4). |
| P2-L4 | Full | All Part 2 sections normative. |

### 9.2 Combined Conformance

An implementation MAY declare conformance at the joint level: e.g., "IDF v1.1 Part 1 Level 3, Part 2 Level P2-L1 conformant". Without Part 2 conformance, an implementation MAY still claim Part 1 conformance alone.

### 9.3 Versioning

This Part follows the same versioning policy as Part 1 (see Part 1 §8.3). Additions that convert a placeholder section (§2–§4, §6–§8) into a normative section will increment the MINOR version.

---

© 2026 IDF Authors. This specification is licensed under Creative Commons Attribution 4.0 International (CC BY 4.0).
