/**
 * iamTables — host-rendered tables для Tags/Policies/Users/Groups/Roles
 * (U-iam2.a). U-derive Phase 3.3: 5 hand-coded tables → 5 thin config-объектов
 * + один generic <HostEntityTable/> renderer. Net: 281 → 188 LOC, тот же UX.
 *
 * Каждая table описывается declarative:
 *   { title, subtitle, items, columns, actionLabel, onAction, searchKey,
 *     deleteKind, onDelete, rowActions }
 *
 * column: { key, label, render?: (row) => ReactNode, style?, monospace? }
 * rowAction: { icon, title, onClick, danger? }
 *
 * Phase 3.4 candidate: вынести HostEntityTable в SDK как primitive
 * (когда соберётся ≥3 use-case вне gravitino).
 */
import { useMemo, useState } from "react";
import { IllustratedEmptyState as EmptyState, ColoredChip } from "@intent-driven/renderer";
import ConfirmDialog from "./ConfirmDialog.jsx";

const cellStyle = { padding: "10px 14px", textAlign: "left" };
const primaryBtn = { padding: "7px 14px", fontSize: 12, fontWeight: 600, border: "1px solid var(--idf-primary, #6478f7)", background: "var(--idf-primary, #6478f7)", color: "white", borderRadius: 4, cursor: "pointer" };

function HeaderBar({ title, subtitle, actionLabel, onAction, search, onSearch, searchPlaceholder = "Search..." }) {
  return (
    <div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "var(--idf-text)" }}>{title}</h2>
      {subtitle && <p style={{ margin: "4px 0 18px", fontSize: 13, color: "var(--idf-text-muted)" }}>{subtitle}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 12 }}>
        <input type="search" value={search} onChange={e => onSearch(e.target.value)} placeholder={searchPlaceholder}
          style={{ flex: 1, maxWidth: 320, padding: "6px 10px", fontSize: 13, border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4, background: "var(--idf-surface, #fff)", color: "var(--idf-text)" }} />
        {actionLabel && <button type="button" onClick={onAction} style={primaryBtn}>{actionLabel}</button>}
      </div>
    </div>
  );
}

function IconBtn({ icon, title, onClick, danger }) {
  return (
    <button type="button" onClick={onClick} title={title}
      style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 14, padding: "0 6px", color: danger ? "#FF3E1D" : "var(--idf-text-muted)" }}>{icon}</button>
  );
}

function HostEntityTable({
  title, subtitle, items = [], columns = [], emptyIcon = "catalogs", emptyTitle,
  actionLabel, onAction, searchPlaceholder, deleteKind, onDelete, rowActions = () => [],
}) {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const filtered = useMemo(
    () => items.filter(it => !search || (it.name || "").toLowerCase().includes(search.toLowerCase())),
    [items, search],
  );

  const askDelete = onDelete ? (item) => setDeleteTarget(item) : null;

  return (
    <div>
      <HeaderBar title={title} subtitle={subtitle} actionLabel={actionLabel} onAction={onAction}
        search={search} onSearch={setSearch} searchPlaceholder={searchPlaceholder} />
      {filtered.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle || `Нет ${title.toLowerCase()}`}
          actionLabel={actionLabel} onAction={onAction} />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
          <thead><tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
            {columns.map(c => <th key={c.key} style={cellStyle}>{c.label}</th>)}
            <th style={{ ...cellStyle, textAlign: "right" }}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(it => (
              <tr key={it.id} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
                {columns.map(c => (
                  <td key={c.key} style={{ ...cellStyle, ...(c.style || {}) }}>
                    {c.render ? c.render(it) : (it[c.key] ?? "—")}
                  </td>
                ))}
                <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                  {rowActions(it).map((a, i) => (
                    <IconBtn key={i} icon={a.icon} title={a.title} danger={a.danger} onClick={() => a.onClick(it)} />
                  ))}
                  {askDelete && <IconBtn icon="🗑" title="Delete" danger onClick={() => askDelete(it)} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {askDelete && (
        <ConfirmDialog
          visible={!!deleteTarget}
          entityName={deleteTarget?.name}
          entityKind={deleteKind}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => { onDelete(deleteTarget); setDeleteTarget(null); }}
        />
      )}
    </div>
  );
}

const mutedSmall = { color: "var(--idf-text-muted)", fontSize: 12 };
const mutedMono = { color: "var(--idf-text-muted)", fontFamily: "monospace", fontSize: 12 };
const muted = { color: "var(--idf-text-muted)" };
const bold = { fontWeight: 500 };

function fmtTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

function RoleChips({ roles = [] }) {
  if (roles.length === 0) return <span style={muted}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {roles.map(r => (
        <span key={r} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500, background: "var(--idf-bg-subtle, #f3f4f6)", color: "var(--idf-text)" }}>{r}</span>
      ))}
    </div>
  );
}

export function TagsTable({ tags = [], onCreate, onEdit, onDelete, onView }) {
  return (
    <HostEntityTable
      title="Tags" subtitle="This table lists the tags you have access to."
      items={tags}
      columns={[
        { key: "name", label: "Tag Name", render: t => <ColoredChip text={t.name} color={t.color} /> },
        { key: "createdAt", label: "Created At", style: mutedSmall, render: t => fmtTime(t.audit?.createTime) },
        { key: "comment", label: "Comment", style: muted, render: t => t.comment || "—" },
      ]}
      actionLabel="+ Create Tag" onAction={onCreate}
      deleteKind="tag" onDelete={onDelete}
      rowActions={t => [
        { icon: "✎", title: "Edit", onClick: () => onEdit?.(t) },
        { icon: "👁", title: "View", onClick: () => onView?.(t) },
      ]}
    />
  );
}

export function PoliciesTable({ policies = [], onCreate, onEdit, onDelete, onView }) {
  return (
    <HostEntityTable
      title="Policies" subtitle="This table lists the policies you have access to."
      items={policies}
      columns={[
        { key: "name", label: "Policy Name", render: p => <ColoredChip text={p.name} /> },
        { key: "policyType", label: "Policy Type", style: mutedMono, render: p => p.policyType || "—" },
        { key: "comment", label: "Comment", style: muted, render: p => p.comment || "—" },
      ]}
      actionLabel="+ Create Policy" onAction={onCreate}
      deleteKind="policy" onDelete={onDelete}
      rowActions={p => [
        { icon: "✎", title: "Edit", onClick: () => onEdit?.(p) },
        { icon: "👁", title: "View", onClick: () => onView?.(p) },
      ]}
    />
  );
}

export function UsersTable({ users = [], onAdd, onGrantRole, onDelete }) {
  return (
    <HostEntityTable
      title="Users" subtitle="Users are the entities that can be granted roles."
      items={users}
      columns={[
        { key: "name", label: "User Name", style: bold },
        { key: "roles", label: "Roles", render: u => <RoleChips roles={u.roles} /> },
      ]}
      actionLabel="+ Add User" onAction={onAdd}
      deleteKind="user" onDelete={onDelete}
      rowActions={u => [{ icon: "🔑", title: "Grant role", onClick: () => onGrantRole?.(u) }]}
    />
  );
}

export function GroupsTable({ groups = [], onAdd, onGrantRole, onDelete }) {
  return (
    <HostEntityTable
      title="User Groups" subtitle="User groups are the entities that can be granted roles."
      items={groups}
      columns={[
        { key: "name", label: "Group Name", style: bold },
        { key: "roles", label: "Roles", render: g => <RoleChips roles={g.roles} /> },
      ]}
      actionLabel="+ Add User Group" onAction={onAdd}
      deleteKind="group" onDelete={onDelete}
      rowActions={g => [{ icon: "🔑", title: "Grant role", onClick: () => onGrantRole?.(g) }]}
    />
  );
}

export function RolesTable({ roles = [], onCreate, onEdit, onDelete, onSetOwner }) {
  return (
    <HostEntityTable
      title="Roles" subtitle="Roles are the entities that can be granted to users or user groups."
      items={roles} emptyIcon="versions" searchPlaceholder="Search"
      columns={[
        { key: "name", label: "Role Name", style: bold },
        { key: "owner", label: "Owner", style: muted, render: r => r.owner || "—" },
      ]}
      actionLabel="+ Create Role" onAction={onCreate}
      deleteKind="role" onDelete={onDelete}
      rowActions={r => [
        { icon: "✎", title: "Edit", onClick: () => onEdit?.(r) },
        { icon: "⚙", title: "Set Owner", onClick: () => onSetOwner?.(r) },
      ]}
    />
  );
}
