// src/domains/gravitino/ontology.js
import { ontology as imported } from "./imported.js";

/**
 * Host-level field enrichment. Поверх imported ontology добавляем
 * declarative `field.primitive` hints (core@0.53+, idf-sdk#198) для
 * custom rendering. Без hint'ов json/array-поля выпадают в text-default
 * (raw blob); hint привязывает custom primitive per field.
 *
 * Активные аннотации:
 *   - Table.columns (json)           → SchemaEditor     (renderer@0.30.0 #196)
 *   - Role.securableObjects (json)   → permissionMatrix (renderer@0.32.0 #202)
 *   - <entity>.properties (json)     → propertyPopover  (Stage 7 #206)
 *   - User.roles / Group.roles      → chipList variant=role (Stage 7 #206)
 *   - Tag.appliedTo / Policy.*      → future tags/policies
 *
 * Каждый hint activates только после merge соответствующего SDK PR +
 * renderer bump. До активации — fallback (text-blob).
 */
function enrichFieldsWithPrimitives(entities) {
  const enriched = {};

  // Entities с json `properties` — получают propertyPopover (Stage 7).
  const PROPERTIES_BEARERS = [
    "Metalake", "Catalog", "Schema", "Table", "Fileset", "Topic", "Model",
    "Tag", "Policy", "Role",
  ];

  for (const [name, entity] of Object.entries(entities)) {
    enriched[name] = entity;
  }

  // Stage 3: Table.columns → schemaEditor
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

  // Stage 5: Role.securableObjects → permissionMatrix
  if (enriched.Role?.fields?.securableObjects) {
    enriched.Role = {
      ...enriched.Role,
      fields: {
        ...enriched.Role.fields,
        securableObjects: {
          ...enriched.Role.fields.securableObjects,
          primitive: "permissionMatrix",
          label: "Privileges",
        },
      },
    };
  }

  // Stage 7: entity.properties → propertyPopover
  for (const entityName of PROPERTIES_BEARERS) {
    const ent = enriched[entityName];
    if (ent?.fields?.properties) {
      enriched[entityName] = {
        ...ent,
        fields: {
          ...ent.fields,
          properties: {
            ...ent.fields.properties,
            primitive: "propertyPopover",
            label: "Properties",
          },
        },
      };
    }
  }

  // Stage 7: User.roles и Group.roles → chipList (variant "role")
  for (const entityName of ["User", "Group"]) {
    const ent = enriched[entityName];
    if (ent?.fields?.roles) {
      enriched[entityName] = {
        ...ent,
        fields: {
          ...ent.fields,
          roles: {
            ...ent.fields.roles,
            primitive: "chipList",
            label: "Roles",
          },
        },
      };
    }
  }

  return enriched;
}

export const ONTOLOGY = {
  entities: enrichFieldsWithPrimitives(imported.entities),
  roles: imported.roles || { owner: { base: "owner" } },
  invariants: imported.invariants || [],
  features: imported.features || {},
};
