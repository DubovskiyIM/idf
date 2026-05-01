/**
 * Серверный builder эффектов для notion-домена (18-й полевой тест).
 *
 * Custom branches (не покрываются generic particle.effects handler'ом SDK):
 *   - create_subpage — derive workspaceId из родителя + position
 *   - move_page — переписывает parentPageId + position; descendant'ы
 *     остаются как есть (FK сохраняется через self-ref)
 *   - duplicate_page — клонирует Page + все child Block'и
 *   - convert_to_database — создаёт Page → Database на этой Page
 *   - change_property_kind — миграция PropertyValue.valueJson под новый kind
 *   - add_database_row — двойной effect Page + DatabaseRow
 *   - set_property_value — upsert (create если нет, replace если есть)
 *   - bulk_set_property — broadcast value на все DatabaseRow в БД
 *   - duplicate_database — клонирует Database + Properties + Views + Rows
 *   - reply_comment — derive pageId/blockId из parent
 *   - request_access — synthesizes Comment в notification-thread
 *   - add_filter — merge filter-условия в filtersJson
 *   - agent_create_page / agent_set_property — preapproval gate уже в SDK,
 *     handler возвращает то же что create_page/set_property_value
 */

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeEffect(props) {
  return {
    id: uid("eff"),
    parent_id: null,
    status: "proposed",
    ttl: null,
    created_at: Date.now(),
    confirmedAt: new Date().toISOString(),
    ...props,
  };
}

function buildNotionEffects(intentId, params, viewer, world) {
  switch (intentId) {
    case "create_subpage": {
      const parent = world?.pages?.[params.parentPageId];
      if (!parent) return null;

      const siblings = Object.values(world?.pages || {}).filter(p => p.parentPageId === params.parentPageId);
      const position = siblings.length;
      const now = new Date().toISOString();

      return [
        makeEffect({
          alpha: "create",
          entity: "Page",
          fields: {
            id: uid("p"),
            workspaceId: parent.workspaceId,
            parentPageId: params.parentPageId,
            title: params.title,
            icon: params.icon || null,
            position,
            createdById: viewer?.id || null,
            lastEditedById: viewer?.id || null,
            createdAt: now,
            updatedAt: now,
          },
          context: { actor: "user" },
        }),
      ];
    }

    case "move_page": {
      const page = world?.pages?.[params.id];
      if (!page) return null;
      const now = new Date().toISOString();

      return [
        makeEffect({
          alpha: "replace",
          entity: "Page.parentPageId",
          fields: {
            id: params.id,
            parentPageId: params.newParentPageId || null,
            position: params.newPosition,
            updatedAt: now,
            lastEditedById: viewer?.id || null,
          },
          context: { actor: "user" },
        }),
      ];
    }

    case "duplicate_page": {
      const source = world?.pages?.[params.id];
      if (!source) return null;
      const now = new Date().toISOString();
      const newPageId = uid("p");

      const effects = [
        makeEffect({
          alpha: "create",
          entity: "Page",
          fields: {
            id: newPageId,
            workspaceId: source.workspaceId,
            parentPageId: source.parentPageId,
            title: params.newTitle,
            icon: source.icon,
            coverImageUrl: source.coverImageUrl,
            position: (source.position ?? 0) + 0.5,
            createdById: viewer?.id || null,
            lastEditedById: viewer?.id || null,
            createdAt: now,
            updatedAt: now,
          },
          context: { actor: "user", duplicateOf: params.id },
        }),
      ];

      // Клонируем все blocks
      const blocks = Object.values(world?.blocks || {}).filter(b => b.pageId === params.id);
      for (const b of blocks) {
        effects.push(makeEffect({
          alpha: "create",
          entity: "Block",
          fields: { ...b, id: uid("b"), pageId: newPageId, createdAt: now },
          context: { actor: "user", duplicateOf: b.id },
        }));
      }

      return effects;
    }

    case "convert_to_database": {
      const parent = world?.pages?.[params.parentPageId];
      if (!parent) return null;
      const dbId = uid("db");
      const viewId = uid("dv");

      return [
        makeEffect({
          alpha: "create",
          entity: "Database",
          fields: {
            id: dbId,
            workspaceId: parent.workspaceId,
            parentPageId: params.parentPageId,
            title: params.title,
            defaultViewId: viewId,
            createdAt: new Date().toISOString(),
          },
          context: { actor: "user" },
        }),
        makeEffect({
          alpha: "create",
          entity: "DatabaseView",
          fields: {
            id: viewId,
            databaseId: dbId,
            name: "All",
            kind: "table",
            position: 0,
            filtersJson: {},
          },
          context: { actor: "user" },
        }),
      ];
    }

    case "change_property_kind": {
      const property = world?.properties?.[params.id];
      if (!property) return null;
      const oldKind = property.kind;
      const newKind = params.kind;

      const effects = [
        makeEffect({
          alpha: "replace",
          entity: "Property.kind",
          fields: { id: params.id, kind: newKind },
          context: { actor: "user", oldKind },
        }),
      ];

      // Миграция valueJson — простая (для первичных типов оставляем; для select без options сбрасываем)
      const values = Object.values(world?.propertyValues || {}).filter(v => v.propertyId === params.id);
      for (const v of values) {
        const migrated = migrateValue(v.valueJson, oldKind, newKind);
        if (migrated !== v.valueJson) {
          effects.push(makeEffect({
            alpha: "replace",
            entity: "PropertyValue.valueJson",
            fields: { id: v.id, valueJson: migrated },
            context: { actor: "system", reason: "kind_migration" },
          }));
        }
      }

      return effects;
    }

    case "add_database_row": {
      const db = world?.databases?.[params.databaseId];
      if (!db) return null;
      const now = new Date().toISOString();
      const pageId = uid("p");
      const rowId = uid("row");
      const existingRows = Object.values(world?.databaseRows || {}).filter(r => r.databaseId === params.databaseId);

      return [
        makeEffect({
          alpha: "create",
          entity: "Page",
          fields: {
            id: pageId,
            workspaceId: db.workspaceId,
            parentPageId: db.parentPageId || null,
            title: params.title,
            position: 1000 + existingRows.length,
            createdById: viewer?.id || null,
            lastEditedById: viewer?.id || null,
            createdAt: now,
            updatedAt: now,
          },
          context: { actor: "user", databaseRow: true },
        }),
        makeEffect({
          alpha: "create",
          entity: "DatabaseRow",
          fields: { id: rowId, databaseId: params.databaseId, pageId, position: existingRows.length, createdAt: now },
          context: { actor: "user" },
        }),
      ];
    }

    case "set_property_value":
    case "agent_set_property": {
      const existing = Object.values(world?.propertyValues || {}).find(
        v => v.rowId === params.rowId && v.propertyId === params.propertyId
      );
      if (existing) {
        return [makeEffect({
          alpha: "replace",
          entity: "PropertyValue.valueJson",
          fields: { id: existing.id, valueJson: params.valueJson },
          context: { actor: viewer?.id ? "user" : "agent" },
        })];
      }
      return [makeEffect({
        alpha: "create",
        entity: "PropertyValue",
        fields: { id: uid("pv"), rowId: params.rowId, propertyId: params.propertyId, valueJson: params.valueJson },
        context: { actor: viewer?.id ? "user" : "agent" },
      })];
    }

    case "bulk_set_property": {
      const rows = Object.values(world?.databaseRows || {}).filter(r => r.databaseId === params.databaseId);
      const effects = [];
      for (const r of rows) {
        const existing = Object.values(world?.propertyValues || {}).find(
          v => v.rowId === r.id && v.propertyId === params.propertyId
        );
        if (existing) {
          effects.push(makeEffect({
            alpha: "replace",
            entity: "PropertyValue.valueJson",
            fields: { id: existing.id, valueJson: params.valueJson },
            context: { actor: "user", bulk: true },
          }));
        } else {
          effects.push(makeEffect({
            alpha: "create",
            entity: "PropertyValue",
            fields: { id: uid("pv"), rowId: r.id, propertyId: params.propertyId, valueJson: params.valueJson },
            context: { actor: "user", bulk: true },
          }));
        }
      }
      return effects;
    }

    case "duplicate_database": {
      const source = world?.databases?.[params.id];
      if (!source) return null;
      const now = new Date().toISOString();
      const newDbId = uid("db");

      const effects = [
        makeEffect({
          alpha: "create",
          entity: "Database",
          fields: {
            id: newDbId,
            workspaceId: source.workspaceId,
            parentPageId: source.parentPageId,
            title: params.newTitle,
            createdAt: now,
          },
          context: { actor: "user", duplicateOf: params.id },
        }),
      ];

      // Properties
      const props = Object.values(world?.properties || {}).filter(p => p.databaseId === params.id);
      const propIdMap = {};
      for (const p of props) {
        const newId = uid("prop");
        propIdMap[p.id] = newId;
        effects.push(makeEffect({
          alpha: "create",
          entity: "Property",
          fields: { ...p, id: newId, databaseId: newDbId },
          context: { actor: "user" },
        }));
      }
      // Views
      const views = Object.values(world?.databaseViews || {}).filter(v => v.databaseId === params.id);
      for (const v of views) {
        effects.push(makeEffect({
          alpha: "create",
          entity: "DatabaseView",
          fields: {
            ...v, id: uid("dv"), databaseId: newDbId,
            groupByPropertyId: v.groupByPropertyId ? propIdMap[v.groupByPropertyId] : null,
            sortByPropertyId: v.sortByPropertyId ? propIdMap[v.sortByPropertyId] : null,
          },
          context: { actor: "user" },
        }));
      }
      return effects;
    }

    case "reply_comment": {
      const parent = world?.comments?.[params.parentCommentId];
      if (!parent) return null;
      return [makeEffect({
        alpha: "create",
        entity: "Comment",
        fields: {
          id: uid("c"),
          pageId: parent.pageId || null,
          blockId: parent.blockId || null,
          parentCommentId: params.parentCommentId,
          body: params.body,
          authorId: viewer?.id || null,
          createdAt: new Date().toISOString(),
        },
        context: { actor: "user" },
      })];
    }

    case "request_access": {
      const page = world?.pages?.[params.pageId];
      if (!page) return null;
      return [makeEffect({
        alpha: "create",
        entity: "Comment",
        fields: {
          id: uid("c"),
          pageId: params.pageId,
          blockId: null,
          body: `📨 Запрос доступа: ${params.message || "(без обоснования)"}`,
          authorId: viewer?.id || null,
          createdAt: new Date().toISOString(),
        },
        context: { actor: "user", kind: "access_request" },
      })];
    }

    case "add_filter": {
      const view = world?.databaseViews?.[params.id];
      if (!view) return null;
      const filters = view.filtersJson && typeof view.filtersJson === "object" ? view.filtersJson : {};
      const newFilters = { ...filters, rules: [
        ...(filters.rules || []),
        { propertyId: params.propertyId, operator: params.operator, value: params.value },
      ]};
      return [makeEffect({
        alpha: "replace",
        entity: "DatabaseView.filtersJson",
        fields: { id: params.id, filtersJson: newFilters },
        context: { actor: "user" },
      })];
    }

    case "agent_create_page": {
      const now = new Date().toISOString();
      return [makeEffect({
        alpha: "create",
        entity: "Page",
        fields: {
          id: uid("p"),
          workspaceId: params.workspaceId,
          parentPageId: params.parentPageId || null,
          title: params.title,
          position: 0,
          createdById: viewer?.id || null,
          lastEditedById: viewer?.id || null,
          createdAt: now,
          updatedAt: now,
        },
        context: { actor: "agent" },
      })];
    }

    case "agent_summarize_page": {
      // No effect — read-only. SDK derive должен не звать этот handler в exec
      return null;
    }
  }

  return null; // generic handler
}

function migrateValue(valueJson, oldKind, newKind) {
  if (!valueJson) return valueJson;
  // Простая логика: stringify text → number parse, остальное — сброс
  if (oldKind === "text" && newKind === "number" && typeof valueJson?.value === "string") {
    const n = Number(valueJson.value);
    return Number.isFinite(n) ? { value: n } : null;
  }
  if (oldKind === "number" && newKind === "text") {
    return { value: String(valueJson?.value ?? "") };
  }
  // select / multi_select без options — сброс
  if (newKind === "select" || newKind === "multi_select") {
    return null;
  }
  return valueJson;
}

module.exports = { buildNotionEffects };
