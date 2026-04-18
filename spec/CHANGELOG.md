# IDF Specification Changelog

## 1.1.1 — 2026-04-19 (Part 2 skeleton + Witness Protocol)

Patch release introducing Part 2 (`idf-v1.1-part2-crystallize.md`) as a skeleton document with one normative section. Backward-compatible — existing v1.0 and v1.1 conformance unchanged.

### Added

- **Part 2 document** (`idf-v1.1-part2-crystallize.md`) — skeleton for the derivation layer spec. Table of contents covers Projections, Slot Taxonomy, Crystallization Contract, Witness Protocol, Pattern Bank, Control Archetypes, Adapter Capability Surface, and Conformance.
- **§5 Witness Protocol** (normative) — resolves the forward reference in Part 1 §9.2:
  - `artifact.witnesses[]` is always present (MAY be empty).
  - Normative basis values: `"anchoring"`, `"pattern-bank"`, `"polymorphic-variant"`, `"temporal-section"`, `"alphabetical-fallback"`.
  - Normative reliability values: `"rule-based"`, `"constructive"`, `"heuristic"`.
  - Per-basis required fields and reliability constraints.
  - Deterministic ordering of witnesses (by `basis`, `slot`, `projection`, `chosen`) for artifact stability under permutation (Part 1 §9.1).
  - Explicit record requirement for `"alphabetical-fallback"` — the SHOULD from Part 1 §9.2 is now MUST-per-tied-group for Part 2 P2-L1 conformance.
- **`schemas/witness.schema.json`** — JSON Schema Draft-2020-12 definition. Uses `if`/`then` for basis-conditional required fields.
- **§9 Part 2 Conformance Levels** — `P2-L1` through `P2-L4`, with `P2-L1` (Witness Emission) fully defined.

### Still placeholder (v1.2)

- §2 Projection format (will add `schemas/projection.schema.json`)
- §3 Slot Taxonomy
- §4 Crystallization Contract (artifact schema)
- §6 Pattern Bank (trigger/structure/rationale + falsification)
- §7 Control Archetypes
- §8 Adapter Capability Surface

### Impact on impl claims

An implementation claiming v1.1 conformance that exposes Part 2 P2-L1 MUST:

1. Emit `artifact.witnesses[]` for every crystallized artifact.
2. Include a witness with `basis:"alphabetical-fallback"` for every tied salience group encountered.
3. Use only the normative `reliability` values, or namespaced custom values.
4. Sort witnesses per §5.5.

The `@intent-driven/core` reference implementation satisfies P2-L1 as of the version released with idf-sdk#45.

---

## 1.1.0 — 2026-04-19 (Determinism + Salience)

Minor release introducing two normative additions to the core format. Backward-compatible — existing v1.0 conformance tests continue to pass.

### Added

- **§3.5 Salience** — intent-level priority for bounded-slot contention.
  - Ordinal labels (`"primary" | "secondary" | "tertiary" | "utility"`) with normative numeric mapping (100/50/20/5) and a numeric escape hatch.
  - Computed default table derived from particles (creator → 80, phase-transition → 70, edit-main → 60, default → 40, destructive → 30, read-only → 10).
  - Mandatory ordering: declared salience descending, then lexicographic id as final tie-break.
- **§9 Determinism** — normative format-level property.
  - §9.1 Key-Permutation Invariance: `derive(π(INTENTS), ...) ≡ derive(INTENTS, ...)` for any permutation π.
  - §9.2 Explicit Tie-Break Only: implementations MUST NOT use iteration order / hash bucket order as an implicit tie-break.
  - §9.3 Conformance via input permutation (tests MUST pass under reverse-ordered input).
  - §9.4 Rationale: `format ≠ convention` requires this property.
- **`intent.schema.json`** updated with `salience` property (string enum or number).

### Motivated by

Empirical probe on 9 reference domains (`idf/scripts/functoriality-probe.mjs`) showed that 0/9 were strictly key-permutation invariant before this release: 16 of 121 projections produced semantically different artifacts under permutation. After implementing §9 in the reference implementation, all 121 projections are identical under permutation.

See `@intent-driven/core@0.16.0` release notes for the implementation-side change, including `intent.salience` support and the `alphabetical-fallback` witness that is emitted when a v1.1 implementation cannot resolve a tie by §3.5 means and falls through to lexicographic id comparison.

### Not yet in the spec

- **Part 2: Projections & Crystallization** still roadmap. The crystallizer's use of §3.5 salience and its emission of `alphabetical-fallback` witnesses are implementation-level concerns that will be formalized in Part 2.
- **v1.1 conformance tests** for §9 (`conformance/level-1/determinism-*.json`) are not yet in this release; the reference implementation verifies functoriality via `scripts/functoriality-probe.mjs` in the host repository.

---

## 1.0.0 — 2026-04-13 (Initial public release)

First publicly available version of the Intent-Driven Framework specification.

### Added

- **Part 1: Core Model** (`idf-v1.0-part1-core.md`, ~920 lines, RFC 2119 style)
  - §1 Introduction, conformance levels, terminology
  - §2 Ontology — entity types, field schemas with R/W matrix, ownerField
  - §3 Intentions — particles (conditions, effects, witnesses, confirmation)
  - §4 Effects — type α, target τ, scope σ, parent_id, status lifecycle, ttl
  - §5 Causal ordering ≺ — topological sort by parent_id
  - §6 Intent algebra — five relation types (▷, ⇌, ⊕, ∥, adjacency)
  - §7 Integrity rules — seven ∀-invariants
  - §8 Appendix — JSON wire formats, terminology glossary

- **Three conformance levels** with 54 language-agnostic JSON tests:
  - Level 1 (Core): 24 tests — fold, lifecycle, causal, batch, scope
  - Level 2 (Algebra): 15 tests — relation derivation from particles
  - Level 3 (Full): 15 tests — integrity rule enforcement

- **Five JSON Schema Draft-07 definitions** (`schemas/*.schema.json`):
  - `intent.schema.json`, `effect.schema.json`, `ontology.schema.json`,
    `world.schema.json`, `domain.schema.json`

- **Licensing:** Apache License 2.0 (`spec/LICENSE`) — anyone may implement
  in any language under any licence.

### Reference Implementation

Published to npm under `@intent-driven` scope:

- `@intent-driven/core@0.3.0` — passes all 54 conformance tests at Level 3
  (licensed BUSL-1.1 with 4-year Change Date to Apache 2.0)
- `@intent-driven/renderer@0.2.0`, `@intent-driven/canvas-kit@0.1.0`,
  `@intent-driven/adapter-{mantine,shadcn,apple,antd}@0.1.1` (MIT)

### Roadmap

Parts 2 and 3 are planned for future versions:

- **v1.1 Part 2: Projections & Crystallization** — projection archetypes
  (feed/catalog/detail/form/canvas/dashboard/wizard), slot assignment,
  primitive categories, crystallizer R1-R7 rules, capability surface.

- **v2.0 Part 3: Materialisations** — the four equal renderings (pixels
  / voice / agent-API / document) and the general materialisation contract.

---

## Governance

This specification is maintained under open governance. Issues, errata,
and proposals via https://github.com/DubovskiyIM/idf/issues.

- Editorial changes (clarifications, typos) — plain PR
- Normative changes (`MUST`/`SHOULD` additions or changes) — require
  rationale, new conformance tests, schema updates, reference-impl
  migration path
- Breaking wire-format changes — require major version bump
