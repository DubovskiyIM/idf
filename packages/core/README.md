# @intent-driven/core

Reference implementation of the [IDF Specification](../../spec/idf-v1.0-part1-core.md) — a formal, language-agnostic standard for building applications from user intentions.

**IDF is not a UI framework.** It is a formal system for describing, verifying, and executing intentional actions within a domain. UI renderers, API generators, smart contract compilers, and test harnesses are all equal consumers of the same intention set.

## What is IDF?

Most systems model either the **system** (state machines, event sourcing) or the **actor** (decision theory, utility functions). IDF models the **encounter** between them.

An **intention** describes what a user comes to do — not what the screen looks like, not what the API endpoint is, not what the database query is. From a set of intentions and a domain ontology, IDF derives:

- **World state** — computed from an append-only effect stream, never stored
- **Intent algebra** — a graph of relations (sequential, antagonistic, excluding, parallel) derived automatically from intention particles
- **Integrity verification** — seven rules that catch dead intents, orphan effects, incomplete witnesses, and algebraic conflicts before any code runs
- **Projections** — what the user needs to see, derivable from intentions (~78% coverage across 5 domains)
- **Workflows** — phase graphs derivable from condition satisfiability classes

One source of truth. Multiple targets: React UI, REST API, OpenAPI spec, test suite, smart contract, compliance process.

## Install

```bash
npm install @intent-driven/core
```

## Quick Start

```js
import { fold, computeAlgebra, checkIntegrity, deriveProjections } from '@intent-driven/core';

// Define your domain
const ONTOLOGY = {
  entities: {
    Task: {
      fields: {
        id: { type: "id" },
        title: { type: "text" },
        status: { type: "enum", values: ["draft", "active", "done"] },
      },
    },
  },
};

const INTENTS = {
  create_task: {
    name: "Create task",
    creates: "Task(draft)",
    particles: {
      entities: ["task: Task"],
      conditions: [],
      effects: [{ α: "add", target: "tasks" }],
      witnesses: ["title"],
      confirmation: "enter",
    },
  },
  publish_task: {
    name: "Publish",
    particles: {
      entities: ["task: Task"],
      conditions: ["task.status = 'draft'"],
      effects: [{ α: "replace", target: "task.status", value: "active" }],
      witnesses: ["title", "status"],
      confirmation: "click",
    },
  },
  complete_task: {
    name: "Complete",
    particles: {
      entities: ["task: Task"],
      conditions: ["task.status = 'active'"],
      effects: [{ α: "replace", target: "task.status", value: "done" }],
      witnesses: [],
      confirmation: "click",
    },
  },
};

// 1. Compute world from effects
const effects = [
  { id: "e1", intent_id: "create_task", alpha: "add", target: "tasks",
    value: null, scope: "account", parent_id: null, status: "confirmed",
    ttl: null, context: { id: "t1", title: "Write spec", status: "draft" },
    created_at: 1000 },
];
const world = fold(effects, { task: "tasks" });
// → { tasks: [{ id: "t1", title: "Write spec", status: "draft" }] }

// 2. Derive intent algebra
const algebra = computeAlgebra(INTENTS, ONTOLOGY);
// algebra.publish_task.sequentialIn → ["create_task"]
// algebra.complete_task.sequentialIn → ["publish_task"]

// 3. Verify integrity
const result = checkIntegrity(INTENTS, {}, ONTOLOGY);
// result.passed → true (no errors)

// 4. Derive projections
const projections = deriveProjections(INTENTS, ONTOLOGY);
// → { task_list: { kind: "catalog", mainEntity: "Task", ... },
//    task_detail: { kind: "detail", mainEntity: "Task", ... } }
```

## API

### Level 1: Core

| Function | Description |
|----------|-------------|
| `fold(effects, typeMap?)` | Compute world state from confirmed effects |
| `causalSort(effects)` | Topological sort by parent_id (causal ordering) |
| `applyPresentation(world, effects, typeMap?)` | Overlay visual-only effects on world copy |
| `filterByStatus(effects, ...statuses)` | Filter effects by lifecycle status |
| `foldDrafts(effects)` | Fold only draft effects (Δ stream) |
| `pluralize(name)` | Entity name → collection name (User → users) |

### Level 2: Algebra

| Function | Description |
|----------|-------------|
| `computeAlgebra(intents, ontology)` | Derive intent relation graph (▷ ⇌ ⊕ ∥) |
| `parseCondition(condition)` | Parse condition string → structured AST |
| `checkComposition(alpha1, alpha2)` | Check effect composition compatibility |

### Level 3: Integrity

| Function | Description |
|----------|-------------|
| `checkIntegrity(intents, projections, ontology)` | Verify 7 integrity rules |

### Derivation

| Function | Description |
|----------|-------------|
| `deriveProjections(intents, ontology)` | Derive projections from intentions (R1-R7) |
| `mergeProjections(derived, authored)` | Shallow merge authored overrides on derived |
| `analyzeIntents(intents, entityNames?)` | Analyze intent patterns (creators, mutators, feedSignals) |
| `detectForeignKeys(ontology)` | Detect entity relationships from ontology |

## Conformance

This package implements all three conformance levels of IDF Specification v1.0 Part 1:

| Level | Name | What it covers |
|-------|------|---------------|
| 1 | Core | fold, causal sort, batch, TTL, scope, lifecycle |
| 2 | Algebra | Sequential ▷, antagonistic ⇌, excluding ⊕, parallel ∥ |
| 3 | Full | 7 integrity rules |

54 conformance tests in `spec/conformance/` validate the implementation against the specification. These tests are language-agnostic JSON files — any implementation in any language can use them.

```bash
# Run conformance tests
cd packages/core && npx vitest run --config vitest.config.js
```

## Specification

The full specification is at [`spec/idf-v1.0-part1-core.md`](../../spec/idf-v1.0-part1-core.md). JSON Schemas for all data structures are in [`spec/schemas/`](../../spec/schemas/).

## The Core Insight

> **Any executable artifact is a projection of intentions onto a specific target. UI is a special case where the target is human perception.**

IDF started as "Intent-Driven Frontend" — deriving UI from intentions. But the core model is target-agnostic. The same intention set crystallizes into:

- **React UI** — screens, forms, navigation (the prototype)
- **REST/GraphQL API** — endpoints, schemas (the agent layer)
- **Test suites** — property-based tests from conditions + effects
- **Compliance processes** — workflows from condition phases
- **Smart contracts** — verified state machines from effects + algebra

The specification defines the core model. This package is the reference implementation. Build your own.

## License

MIT

## Links

- [IDF Specification v1.0](../../spec/idf-v1.0-part1-core.md)
- [JSON Schemas](../../spec/schemas/)
- [Conformance Tests](../../spec/conformance/)
- [Manifesto (Russian)](../../docs/manifesto-v1.3.md)
