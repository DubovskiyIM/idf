# IDF Conformance Tests

54 language-agnostic JSON tests that verify your implementation of the IDF specification.

## Structure

```
conformance/
├── level-1/    (24 tests) — Core: fold, lifecycle, causal, batch, scope
├── level-2/    (15 tests) — Algebra: 5 relation types derived from particles
└── level-3/    (15 tests) — Full: 7 integrity rules
```

Each test file is a JSON object:

```json
{
  "id": "level-1/fold-001",
  "level": 1,
  "name": "single add effect creates one entity",
  "description": "...",
  "input": {
    "effects": [ ... ],
    "ontology": { ... },
    "intents": { ... }   // level-2/3 only
  },
  "expected": {
    "world": { ... },
    "algebra": { ... }    // level-2
    "violations": [ ... ] // level-3
  }
}
```

---

## Running the Tests

The tests are declarative — they describe expected input/output for your implementation. You write a runner that:

1. Loads each test JSON file.
2. Applies your implementation to `test.input`.
3. Compares actual output to `test.expected`.
4. Reports pass/fail per test.

### Minimal JavaScript Runner

```js
import { readdirSync, readFileSync } from "node:fs";
import { fold } from "./your-implementation.js";  // your fold() function

const dir = "spec/conformance/level-1";
const tests = readdirSync(dir).filter(f => f.endsWith(".json"));

let passed = 0, failed = 0;

for (const file of tests) {
  const test = JSON.parse(readFileSync(`${dir}/${file}`, "utf8"));
  const { effects, ontology } = test.input;

  const actual = fold(effects, ontology);

  // Deep equality, normalising list order by id
  if (deepEqual(normalise(actual), normalise(test.expected.world))) {
    console.log(`✓ ${test.id}`);
    passed++;
  } else {
    console.log(`✗ ${test.id}: ${test.name}`);
    console.log("  expected:", JSON.stringify(test.expected.world));
    console.log("  actual:  ", JSON.stringify(actual));
    failed++;
  }
}

console.log(`\n${passed}/${passed + failed} tests passed`);

function normalise(world) {
  // Sort each collection by id for order-independent comparison
  return Object.fromEntries(
    Object.entries(world).map(([k, v]) =>
      [k, Array.isArray(v) ? [...v].sort((a, b) => a.id.localeCompare(b.id)) : v]
    )
  );
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}
```

Save as `run-conformance.js` and run:

```bash
node run-conformance.js
```

Expected output for a conformant implementation:

```
✓ level-1/fold-001
✓ level-1/fold-002
...
24/24 tests passed
```

---

## Porting to Other Languages

The tests are pure JSON — runner is ~30 LOC in any language:

- **Python:** use `json` + `pytest`
- **Go:** use `encoding/json` + `testing`
- **Rust:** use `serde_json` + `cargo test`
- **Ruby:** use `json` + `minitest`
- **Java/Kotlin:** use `jackson` + JUnit

### Python Example

```python
import json, os

def run_conformance(dir_path, fold_fn):
    tests = [f for f in os.listdir(dir_path) if f.endswith(".json")]
    passed = failed = 0

    for f in tests:
        test = json.load(open(f"{dir_path}/{f}"))
        actual = fold_fn(test["input"]["effects"], test["input"]["ontology"])
        expected = test["expected"]["world"]
        if normalise(actual) == normalise(expected):
            print(f"✓ {test['id']}")
            passed += 1
        else:
            print(f"✗ {test['id']}: {test['name']}")
            print(f"  expected: {expected}")
            print(f"  actual:   {actual}")
            failed += 1

    print(f"\n{passed}/{passed + failed} passed")
```

---

## Level 1 Tests (24)

Core fold semantics, effect lifecycle, causal ordering, batch, presentation, scope.

| Prefix | Count | What's verified |
|--------|-------|-----------------|
| `ontology-*` | 5 | Entity declaration, field schemas, ownerField |
| `intent-*` | 3 | Intent shape, particle grammar |
| `effect-*` | 3 | Effect lifecycle (proposed → confirmed / rejected) |
| `fold-*` | 3 | Basic fold produces correct world |
| `causal-*` | 5 | Topological sort by parent_id, cycle detection |
| `batch-*` | 3 | α:"batch" unwinding, atomic all-or-nothing |
| `presentation-*` | 2 | Presentation scope excluded from semantic fold |

## Level 2 Tests (15)

Intent relation derivation from particles.

| Prefix | Count | What's verified |
|--------|-------|-----------------|
| `relation-sequential-*` | 3 | ▷ derivation (field-level matching via conditions) |
| `relation-antagonistic-*` | 4 | ⇌ (strict pair-reversal + declared-as-hint) |
| `relation-excluding-*` | 3 | ⊕ (composition table application) |
| `relation-parallel-*` | 3 | ∥ (complement on shared entities) |
| `adjacency-*` | 2 | Adjacency map construction |

## Level 3 Tests (15)

Seven integrity rules on world + intent graph.

| Prefix | Count | Rule |
|--------|-------|------|
| `integrity-dead-intents-*` | 2 | No intent reachable? (dead code) |
| `integrity-orphan-effects-*` | 2 | Effect refers to non-existent entity |
| `integrity-witness-*` | 2 | Witness incomplete |
| `integrity-proportionality-*` | 3 | Confirmation proportional to reversibility |
| `integrity-antagonism-*` | 2 | Antagonist pair cannot coexist |
| `integrity-anchoring-*` | 2 | All particles anchored to ontology |
| `integrity-algebra-*` | 2 | Composition algebra satisfied |

---

## Declaring Your Conformance

In your implementation's README:

```markdown
## Conformance

Passes IDF Specification v1.0 **Level N** conformance tests.

- Level 1: X / 24 tests passing
- Level 2: Y / 15 tests passing
- Level 3: Z / 15 tests passing

Tests from: https://github.com/DubovskiyIM/idf/tree/main/spec/conformance
```

Partial conformance within a level is not permitted — declare the highest level you pass 100%.

---

## Reference Implementation

The JavaScript reference implementation ([`@intent-driven/core`](https://www.npmjs.com/package/@intent-driven/core)) passes all 54 tests at Level 3. See that package's conformance tests at `test/conformance.test.js` for a production-quality runner.

---

## Contributing New Tests

New conformance tests are welcomed via GitHub PR. Requirements:

1. **New test file** in the appropriate level directory, numbered sequentially.
2. **Specific requirement:** Each test MUST target a specific clause of the spec (cite §-section in `description`).
3. **Input minimal:** Test only the specific requirement under verification. Don't combine multiple concerns.
4. **Expected deterministic:** No dependency on implementation details like insertion order or id generation.
5. **Reference impl passes:** PR must include a run log showing `@intent-driven/core` passes the new test.

Proposed test naming: `<topic>-NNN.json` where NNN zero-pads to 3 digits (e.g. `fold-012.json`).
