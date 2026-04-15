# IDF JSON Schemas

JSON Schema Draft-07 definitions for the five core data types of the Intent-Driven Framework:

| Schema | Purpose | LOC |
|--------|---------|-----|
| [`intent.schema.json`](./intent.schema.json) | Intent structure — id, particles (conditions/effects/witnesses), confirmation | 136 |
| [`effect.schema.json`](./effect.schema.json) | Effect — type α, target τ, scope σ, parent_id, status, ttl | 68 |
| [`ontology.schema.json`](./ontology.schema.json) | Ontology — entities, fields with R/W matrix, roles, invariants | 143 |
| [`world.schema.json`](./world.schema.json) | World(t) — computed collections of entities | 21 |
| [`domain.schema.json`](./domain.schema.json) | Domain — name, ontology, intents, projections bundle | 37 |

Total: ~400 LOC across 5 schemas.

---

## Usage

### JavaScript / TypeScript (ajv)

```bash
npm install ajv
```

```js
import Ajv from "ajv";
import intentSchema from "@intent-driven/spec/schemas/intent.schema.json" with { type: "json" };
// or from local: import intentSchema from "./intent.schema.json" with { type: "json" };

const ajv = new Ajv();
const validate = ajv.compile(intentSchema);

const intent = {
  id: "create_order",
  particles: {
    conditions: [],
    effects: [{ type: "add", target: "Order", payload: { id: "o1" } }],
    witnesses: [],
    confirmation: { mode: "none" }
  }
};

if (validate(intent)) {
  console.log("valid");
} else {
  console.log("errors:", validate.errors);
}
```

### Python (jsonschema)

```bash
pip install jsonschema
```

```python
import json
from jsonschema import validate, ValidationError

with open("spec/schemas/intent.schema.json") as f:
    schema = json.load(f)

intent = {
    "id": "create_order",
    "particles": {
        "conditions": [],
        "effects": [{"type": "add", "target": "Order", "payload": {"id": "o1"}}],
        "witnesses": [],
        "confirmation": {"mode": "none"}
    }
}

try:
    validate(intent, schema)
    print("valid")
except ValidationError as e:
    print("error:", e.message)
```

### Go (gojsonschema)

```bash
go get github.com/xeipuuv/gojsonschema
```

```go
package main

import (
    "fmt"
    "github.com/xeipuuv/gojsonschema"
)

func main() {
    schema := gojsonschema.NewReferenceLoader("file://spec/schemas/intent.schema.json")
    intent := gojsonschema.NewStringLoader(`{
        "id": "create_order",
        "particles": {
            "conditions": [],
            "effects": [{"type": "add", "target": "Order", "payload": {"id": "o1"}}],
            "witnesses": [],
            "confirmation": {"mode": "none"}
        }
    }`)

    result, err := gojsonschema.Validate(schema, intent)
    if err != nil { panic(err) }

    if result.Valid() {
        fmt.Println("valid")
    } else {
        for _, desc := range result.Errors() {
            fmt.Println("error:", desc)
        }
    }
}
```

---

## Schema Normativity

These schemas are **normative** — they define the canonical wire format for IDF data exchange between implementations. An implementation that claims IDF conformance MUST accept data matching these schemas and MUST emit data matching these schemas for its public API.

Schemas are versioned together with the spec. Schema changes in a new spec version require a new major version (e.g. v1.x → v2.x) if they break backward compatibility, or a minor version if strictly additive.

---

## Cross-references with the Specification

Each section of `idf-v1.0-part1-core.md` that defines a data structure ends with a `> **Schema:**` reference:

- §2 Ontology → `ontology.schema.json`
- §3 Intentions → `intent.schema.json`
- §4 Effects → `effect.schema.json`
- §5 World computation → `world.schema.json`
- §8 Appendix — full JSON wire formats

Refer to the main spec for normative requirements (`MUST`, `SHOULD`). The schemas enforce structural correctness — semantic correctness (e.g. causal ordering, integrity rules) is verified by the [conformance tests](../conformance/).

---

## Tooling

For bulk validation of a directory of JSON files:

```bash
# ajv-cli (JavaScript)
npx ajv validate -s spec/schemas/intent.schema.json -d "my-domain/intents/*.json"

# yajsv (Go)
yajsv -s spec/schemas/intent.schema.json my-domain/intents/*.json
```

---

## Licence

Apache License 2.0 — see [`../LICENSE`](../LICENSE).
