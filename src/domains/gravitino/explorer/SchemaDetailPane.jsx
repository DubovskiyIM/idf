/**
 * SchemaDetailPane — tabbed detail view для schema (U4 + U6.3 + U-fix-toggle-tabs).
 *
 * Header: schema name + comment + owner avatar + ✎ Set Owner.
 * Tabs (зависят от catalog.type + всегда tags/policies/properties):
 *   - relational → Tables / Tags / Policies / Properties
 *   - fileset    → Filesets / Tags / Policies / Properties
 *   - model      → Models / Tags / Policies / Properties
 *   - default    → Tags / Policies / Properties
 *
 * Tags / Policies — chip-list + AssociatePopover (U6.3, B3/B14).
 * Functions tab — backlog (U-functions).
 *
 * U-fix-toggle-tabs: child-tables (Tables/Filesets/Models) расширены
 * до full parity с CatalogsTable — Tags chip-list + Policies chip-list +
 * Actions (Edit / Set Owner / Delete с ConfirmDialog). 4 callbacks к
 * parent: onChildEdit / onChildSetOwner / onChildDelete / onChildAssociate.
 */
import { useState } from "react";
import { AssociatePopover } from "@intent-driven/renderer";
import ConfirmDialog from "./ConfirmDialog.jsx";
import { ChipsAssoc, OwnerBlock } from "./DetailPaneCommon.jsx";
import Tabs from "./Tabs.jsx";

export default function SchemaDetailPane({
  schema,
  catalog,
  world = {},
  onSetOwner = () => {},
  onAssociate = () => {},
  onChildSelect = () => {},
  onChildEdit = () => {},
  onChildSetOwner = () => {},
  onChildDelete = () => {},
  onChildAssociate = () => {},
}) {
  const childKind = catalog?.type === "relational" ? "tables"
                  : catalog?.type === "fileset"    ? "filesets"
                  : catalog?.type === "model"      ? "models"
                  : null;
  const childLabel = { tables: "Tables", filesets: "Filesets", models: "Models" }[childKind];
  const tabs = [
    ...(childKind ? [{ key: childKind, label: childLabel }] : []),
    { key: "tags", label: "Tags" },
    { key: "policies", label: "Policies" },
    { key: "properties", label: "Properties" },
  ];
  const [active, setActive] = useState(tabs[0].key);
  const children = childKind ? (world[childKind] || []).filter(it => it.schemaId === schema.id) : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header schema={schema} onSetOwner={() => onSetOwner(schema.id)} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs tabs={tabs} active={active} onChange={setActive}>
          {active === childKind && (
            <SchemaChildTable
              items={children}
              kind={childKind}
              world={world}
              onSelect={onChildSelect}
              onEdit={onChildEdit}
              onSetOwner={onChildSetOwner}
              onDelete={onChildDelete}
              onAssociate={onChildAssociate}
            />
          )}
          {active === "tags" && (
            <ChipsAssoc
              entityId={schema.id}
              type="tags"
              selected={schema.tags || []}
              available={world.tags || []}
              onAssociate={onAssociate}
            />
          )}
          {active === "policies" && (
            <ChipsAssoc
              entityId={schema.id}
              type="policies"
              selected={schema.policies || []}
              available={world.policies || []}
              onAssociate={onAssociate}
            />
          )}
          {active === "properties" && <PropsTable obj={schema.properties || {}} />}
        </Tabs>
      </div>
    </div>
  );
}

function Header({ schema, onSetOwner }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fff)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{schema.name}</div>
        {schema.comment && <div style={{ fontSize: 12, color: "var(--idf-text-muted)", marginTop: 2 }}>{schema.comment}</div>}
      </div>
      <OwnerBlock owner={schema.owner} onSetOwner={onSetOwner} />
    </div>
  );
}

/**
 * SchemaChildTable — full-parity таблица для Tables/Filesets/Models (parity
 * с CatalogsTable). Колонки: Name / Tags / Policies / Actions.
 */
function SchemaChildTable({ items, kind, world, onSelect, onEdit, onSetOwner, onDelete, onAssociate }) {
  const [popover, setPopover] = useState(null); // { itemId, type: "tags"|"policies" }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const availableTags = world.tags || [];
  const availablePolicies = world.policies || [];
  const entityKind = { tables: "table", filesets: "fileset", models: "model" }[kind] || "entity";

  if (items.length === 0) return <Empty>Нет дочерних объектов</Empty>;
  return (
    <>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
        <thead>
          <tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
            <th style={cellStyle}>Name</th>
            <th style={cellStyle}>Tags</th>
            <th style={cellStyle}>Policies</th>
            <th style={{ ...cellStyle, textAlign: "right" }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)", verticalAlign: "top" }}>
              <td
                style={{ ...cellStyle, fontWeight: 500, cursor: onSelect ? "pointer" : "default", color: onSelect ? "var(--idf-primary, #6478f7)" : undefined }}
                onClick={() => onSelect && onSelect(it, kind)}
              >{it.name}</td>
              <td style={{ ...cellStyle, position: "relative" }}>
                <ChipList items={it.tags || []} variant="tag" />
                <AssocBtn label="+ Associate Tag" onClick={() => setPopover({ itemId: it.id, type: "tags" })} />
                {popover?.itemId === it.id && popover?.type === "tags" && (
                  <FloatingPopover>
                    <AssociatePopover
                      title="Associate Tag"
                      available={availableTags}
                      selected={it.tags || []}
                      onApply={(names) => { onAssociate(it.id, "tags", names, kind); setPopover(null); }}
                      onClose={() => setPopover(null)}
                    />
                  </FloatingPopover>
                )}
              </td>
              <td style={{ ...cellStyle, position: "relative" }}>
                <ChipList items={it.policies || []} variant="policy" />
                <AssocBtn label="+ Associate Policy" onClick={() => setPopover({ itemId: it.id, type: "policies" })} />
                {popover?.itemId === it.id && popover?.type === "policies" && (
                  <FloatingPopover>
                    <AssociatePopover
                      title="Associate Policy"
                      available={availablePolicies}
                      selected={it.policies || []}
                      onApply={(names) => { onAssociate(it.id, "policies", names, kind); setPopover(null); }}
                      onClose={() => setPopover(null)}
                    />
                  </FloatingPopover>
                )}
              </td>
              <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                <IconBtn icon="✎" title="Edit" onClick={() => onEdit(it, kind)} />
                <IconBtn icon="⚙" title="Set Owner" onClick={() => onSetOwner(it, kind)} />
                <IconBtn icon="🗑" title="Delete" danger onClick={() => setDeleteTarget(it)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog
        visible={!!deleteTarget}
        entityName={deleteTarget?.name}
        entityKind={entityKind}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget, kind); setDeleteTarget(null); }}
      />
    </>
  );
}

function ChipList({ items = [], variant = "tag" }) {
  if (items.length === 0) return null;
  const colors = variant === "tag"
    ? { bg: "rgba(100,120,247,0.15)", text: "var(--idf-primary, #6478f7)" }
    : { bg: "rgba(255,171,0,0.18)", text: "#FFAB00" };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 4 }}>
      {items.map(name => (
        <span key={name} style={{
          padding: "2px 8px", borderRadius: 4, fontSize: 11,
          background: colors.bg, color: colors.text, fontWeight: 500,
        }}>{name}</span>
      ))}
    </div>
  );
}

function AssocBtn({ label, onClick }) {
  return (
    <button type="button" onClick={onClick} style={{
      padding: "2px 8px", fontSize: 11,
      border: "1px dashed var(--idf-border, #e5e7eb)", borderRadius: 4,
      background: "transparent", color: "var(--idf-text-muted)", cursor: "pointer",
    }}>{label}</button>
  );
}

function FloatingPopover({ children }) {
  return <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 50 }}>{children}</div>;
}

function IconBtn({ icon, title, onClick, danger }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} style={{
      background: "transparent", border: "none", cursor: "pointer",
      fontSize: 14, padding: "0 6px",
      color: danger ? "#FF3E1D" : "var(--idf-text-muted)",
    }}>{icon}</button>
  );
}

function PropsTable({ obj }) {
  const entries = Object.entries(obj || {});
  if (entries.length === 0) return <Empty>Properties пусты</Empty>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
            <td style={{ ...cellStyle, fontWeight: 500, width: 200 }}>{k}</td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)", fontFamily: "monospace" }}>{String(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty({ children }) {
  return <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--idf-text-muted)" }}>{children}</div>;
}

const cellStyle = { padding: "8px 12px", textAlign: "left" };
