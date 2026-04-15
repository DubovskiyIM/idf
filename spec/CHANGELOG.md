# IDF Specification Changelog

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
