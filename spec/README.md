# Intent-Driven Framework — Specification

> **Status:** Draft · **Version:** 1.0 · **Language:** English (normative) · **License:** Apache 2.0

Formal specification of the Intent-Driven Framework (IDF): a paradigm for building applications from declarations of intent and projection, with rendering derived rather than authored.

This repository contains:

- **[`idf-v1.0-part1-core.md`](./idf-v1.0-part1-core.md)** — the normative specification document (~920 lines, RFC 2119 style).
- **[`conformance/`](./conformance/)** — 54 language-agnostic JSON conformance tests across 3 levels.
- **[`schemas/`](./schemas/)** — JSON Schema Draft-07 definitions for `intent`, `effect`, `ontology`, `world`, `domain`.

---

## Quick Start

The spec is language-neutral. Pass the JSON conformance tests in your language of choice, and your implementation is conformant.

```bash
# Clone repo
git clone https://github.com/DubovskiyIM/idf.git
cd idf/spec

# Read the spec
cat idf-v1.0-part1-core.md

# Browse conformance tests
ls conformance/level-1/  # 24 tests
ls conformance/level-2/  # 15 tests
ls conformance/level-3/  # 15 tests

# Validate data against schemas
ajv validate -s schemas/intent.schema.json -d your-intent.json
```

---

## Conformance Levels

The spec defines three inclusive conformance levels:

| Level | Scope | Tests | What's verified |
|-------|-------|-------|-----------------|
| **L1 — Core** | Fold semantics, effect lifecycle, causal ordering, batch, presentation, scope | 24 | World(t) correctly computed from effect stream |
| **L2 — Algebra** | L1 + intent relation derivation from particles | 15 | Five relation types (▷, ⇌, ⊕, ∥, adjacency) derived from definitions alone |
| **L3 — Full** | L2 + seven integrity rules | 15 | All schema-level ∀-invariants enforced with structured diagnostics |

An implementation declares its level and MUST pass 100% of its level's tests and all lower-level tests. Partial conformance within a level is not permitted.

Details: `idf-v1.0-part1-core.md` §1.2 and each `conformance/level-*/README.md`.

---

## Structure of the Specification

The specification is organised into 8 sections (§1-§8) with ~150 numbered requirements using RFC 2119 language (`MUST`, `SHOULD`, `MAY`).

| § | Topic | Lines |
|---|-------|-------|
| §1 | Introduction, conformance levels, terminology | 1-45 |
| §2 | Ontology — entity types, field schemas, typed fields with R/W matrix | 46-180 |
| §3 | Intentions — particles (conditions, effects, witnesses, confirmation) | 181-335 |
| §4 | Effects — type α, target τ, scope σ, parent_id, status lifecycle | 336-390 |
| §5 | Causal ordering ≺ — topological sort by parent_id with DFS cycle guard | 391-440 |
| §6 | Intent algebra — five relation types derived from particle shape | 441-620 |
| §7 | Integrity rules — seven ∀-invariants over world and intent graph | 621-820 |
| §8 | Appendix — JSON wire formats, terminology glossary, references | 821-923 |

---

## Reference Implementation

The JavaScript reference implementation is distributed as npm packages under the [`@intent-driven`](https://www.npmjs.com/org/intent-driven) scope:

| Package | Version | Role |
|---------|---------|------|
| [`@intent-driven/core`](https://www.npmjs.com/package/@intent-driven/core) | 0.3.0 | Core engine: fold, algebra, crystallizer, materialisations, invariants |
| [`@intent-driven/renderer`](https://www.npmjs.com/package/@intent-driven/renderer) | 0.2.0 | Rendering layer: archetypes, primitives, adapter registry |
| [`@intent-driven/adapter-*`](https://www.npmjs.com/org/intent-driven) | 0.1.1 | Four UI-kit adapters (Mantine, shadcn, Apple, AntD) |

**Note on licensing:** `@intent-driven/core` is distributed under **Business Source License 1.1** (BUSL-1.1), which converts to Apache 2.0 on 2030-04-15 (four-year Change Date). The specification itself (this directory) is Apache 2.0 from day one — anyone may implement it in any language under any licence. The reference implementation's terms only apply if you use the npm package.

---

## Implementing the Specification

### Step 1 — Read the core spec

Start with `idf-v1.0-part1-core.md`. The RFC 2119 language makes requirements explicit: `MUST`, `SHOULD`, `MAY`.

### Step 2 — Write a conformance test runner

Each test file has a `.input` object and an `.expected` object. Your runner applies your implementation to `input` and compares to `expected` using deep equality (modulo sort order for lists).

See [`conformance/README.md`](./conformance/README.md) for a minimal JavaScript runner example (~30 LOC) that you can port to any language.

### Step 3 — Implement Level 1 first

Level 1 is the core: fold semantics, effect lifecycle, causal ordering. An implementation passing Level 1 can already render a real domain; Level 2 and 3 add derivation convenience and integrity enforcement.

### Step 4 — Use the JSON schemas for validation

`schemas/*.schema.json` are JSON Schema Draft-07. Use `ajv` (JavaScript), `jsonschema` (Python), `ginger` (Go), or any JSON Schema library to validate your intent/effect/ontology data.

### Step 5 — Declare your conformance level

In your project's README:

```
## Conformance

This implementation passes IDF Specification v1.0 Level N conformance
tests (N of 54 tests passing). Target level: N.

Conformance tests from: github.com/DubovskiyIM/idf/tree/main/spec/conformance
```

---

## Changelog

- **v1.0** — Initial public release (2026-04-13)

See [`CHANGELOG.md`](./CHANGELOG.md) for full history.

---

## Contributing

The specification is under open governance. Issues, clarifications, errata, and proposals for v1.1+ welcome via GitHub Issues on the main repository: <https://github.com/DubovskiyIM/idf/issues>.

Proposed changes that affect normative requirements (`MUST`/`SHOULD`) require:
1. A written rationale (use case that current spec doesn't address or handles poorly)
2. New or updated conformance tests demonstrating the change
3. Schema updates if wire format affected
4. Confirmation that the reference implementation either already satisfies the change or has a clear migration path

Editorial changes (clarifications, typos, non-normative rewording) can be proposed as plain PRs.

---

## Related Documents

| Document | Audience | Status |
|----------|----------|--------|
| [`idf-v1.0-part1-core.md`](./idf-v1.0-part1-core.md) | Implementers | This spec |
| [`../docs/manifesto-v1.7.md`](../docs/manifesto-v1.7.md) | Practitioners, authors | Reference implementation notes + insights |
| [`../docs/field-test-*.md`](../docs/) | Domain authors | 11 field-test reports showing paradigm applied to real domains |
| `part-2-projections.md` | Implementers | **Not yet published** — planned for v1.1 (projections, archetypes, crystallizer) |
| `part-3-materialisations.md` | Implementers | **Not yet published** — planned for v2.0 (document, voice, agent-API) |

---

## Licence

**Apache License 2.0** — see [`LICENSE`](./LICENSE).

Anyone may implement this specification in any programming language, under any license, for any purpose (commercial, non-commercial, personal, governmental). No royalties, no attribution requirement beyond what Apache 2.0 requires.

The specification text itself is copyright © 2026 Ignat Dubovsky and the IDF Specification Authors.
