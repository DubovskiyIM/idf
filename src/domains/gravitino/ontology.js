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

  // U-derive Phase 3.2: surface tags/policies/owner virtual fields на
  // metadata-objects (Catalog/Schema/Table/Fileset/Topic/Model/Metalake).
  // World data уже содержит эти поля (см. seed.js), но imported ontology
  // их не декларирует — Gravitino REST API ассоциирует через separate
  // endpoints. Декларация здесь анлочит patterns auto-fire:
  //   - entity-tag-policy-columns → chipAssociation columns в catalog dataGrid
  //   - entity-owner-column → ownerAvatar column + setOwner editIntent
  // Author-override через bodyOverride.columns.{tags|policies|owner} остаётся.
  const ASSOCIATION_BEARERS = [
    "Metalake", "Catalog", "Schema", "Table", "Fileset", "Topic", "Model",
  ];
  for (const entityName of ASSOCIATION_BEARERS) {
    const ent = enriched[entityName];
    if (!ent) continue;
    enriched[entityName] = {
      ...ent,
      fields: {
        ...ent.fields,
        ...(ent.fields.tags ? {} : {
          tags: { type: "array", role: "tag-list", primitive: "chipList", label: "Tags" },
        }),
        ...(ent.fields.policies ? {} : {
          policies: { type: "array", role: "policy-list", primitive: "chipList", label: "Policies" },
        }),
        ...(ent.fields.owner ? {} : {
          owner: { type: "string", role: "owner", label: "Owner" },
        }),
      },
    };
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

  // Host-polish: entity.audit → propertyPopover.
  // Gravitino.Audit = { creator, createTime, lastModifier, lastModifiedTime }
  // nested object. Default text-atom пытается отрендерить как string →
  // React "Objects are not valid as a child" error на catalog-list рендере.
  // PropertyPopover показывает как dict (creator=alice, createTime=...).
  for (const [entityName, ent] of Object.entries(enriched)) {
    if (ent?.fields?.audit && ent.fields.audit.primitive !== "propertyPopover") {
      enriched[entityName] = {
        ...ent,
        fields: {
          ...ent.fields,
          audit: {
            ...ent.fields.audit,
            primitive: "propertyPopover",
            label: "Audit",
          },
        },
      };
    }
  }

  // Host-polish: Policy.content → propertyPopover (синтетический PolicyContent
  // object может быть сложным — показываем как dict через popover).
  if (enriched.Policy?.fields?.content) {
    enriched.Policy = {
      ...enriched.Policy,
      fields: {
        ...enriched.Policy.fields,
        content: {
          ...enriched.Policy.fields.content,
          primitive: "propertyPopover",
          label: "Content",
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
  features: {
    ...(imported.features || {}),
    // U-derive Phase 3.2: catalog-default-datagrid pattern по умолчанию
    // skip'ает projections с itemIntents (onItemClick → list rendering).
    // preferDataGrid:true заставляет всегда переходить на dataGrid → unlock'ает
    // Phase 2 patterns (entity-tag-policy-columns, entity-owner-column,
    // entity-row-actions) на gravitino catalog/schema/table/* listings.
    preferDataGrid: true,
  },
};
