// src/domains/gravitino/ontology.js
import { ontology as imported } from "./imported.js";

/**
 * Host-level field enrichment. Поверх imported ontology добавляем
 * declarative `field.primitive` hints (core@0.53+ declarative primitive
 * hint механизм, idf-sdk#198) для custom rendering.
 *
 * Text-heuristic / role-heuristic для json-полей даёт raw JSON blob;
 * с hint'ом renderer вызывает соответствующий primitive:
 *   - Table.columns (json) → SchemaEditor (renderer@0.30.0, idf-sdk#196)
 *
 * Future host-annotations (Stage 4-7):
 *   - Role.securableObjects → permissionMatrix primitive (Stage 5)
 *   - Catalog.tags / Catalog.policies → chip primitive (Stage 7)
 */
function enrichFieldsWithPrimitives(entities) {
  const enriched = { ...entities };

  // Table.columns — primary Stage 3 deliverable (Gravitino docs сравнение
  // G26). Без hint'а рендерится как text с bind на json-array — blob.
  if (enriched.Table?.fields?.columns) {
    enriched.Table = {
      ...enriched.Table,
      fields: {
        ...enriched.Table.fields,
        columns: {
          ...enriched.Table.fields.columns,
          primitive: "schemaEditor",
          label: "Columns",
        },
      },
    };
  }

  return enriched;
}

export const ONTOLOGY = {
  entities: enrichFieldsWithPrimitives(imported.entities),
  roles: imported.roles || { owner: { base: "owner" } },
  invariants: imported.invariants || [],
  features: imported.features || {},
};
