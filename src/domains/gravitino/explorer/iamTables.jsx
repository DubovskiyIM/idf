/**
 * iamTables — host-rendered tables для Tags/Policies/Users/Groups/Roles
 * (U-iam2.a). Все следуют единому pattern: header + Search + + Action button +
 * table + EmptyState; row-actions iconified (✎ / 🗑 / 🔑 grant-role).
 */
import { useState } from "react";
import { IllustratedEmptyState as EmptyState, ColoredChip } from "@intent-driven/renderer";
import ConfirmDialog from "./ConfirmDialog.jsx";

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

const cellStyle = { padding: "10px 14px", textAlign: "left" };
const primaryBtn = { padding: "7px 14px", fontSize: 12, fontWeight: 600, border: "1px solid var(--idf-primary, #6478f7)", background: "var(--idf-primary, #6478f7)", color: "white", borderRadius: 4, cursor: "pointer" };

// ═══ TagsTable ═════════════════════════════════════════════════════════
export function TagsTable({ tags = [], onCreate = () => {}, onEdit = () => {}, onDelete = () => {}, onView = () => {} }) {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const filtered = tags.filter(t => !search || (t.name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <HeaderBar title="Tags" subtitle="This table lists the tags you have access to."
        actionLabel="+ Create Tag" onAction={onCreate} search={search} onSearch={setSearch} />
      {filtered.length === 0 ? (
        <EmptyState icon="catalogs" title="Нет tags" actionLabel="+ Create Tag" onAction={onCreate} />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
          <thead><tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
            <th style={cellStyle}>Tag Name</th>
            <th style={cellStyle}>Created At</th>
            <th style={cellStyle}>Comment</th>
            <th style={{ ...cellStyle, textAlign: "right" }}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(t => (
              <tr key={t.id} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
                <td style={cellStyle}><ColoredChip text={t.name} color={t.color} /></td>
                <td style={{ ...cellStyle, color: "var(--idf-text-muted)", fontSize: 12 }}>{fmtTime(t.audit?.createTime)}</td>
                <td style={{ ...cellStyle, color: "var(--idf-text-muted)" }}>{t.comment || "—"}</td>
                <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                  <IconBtn icon="✎" title="Edit" onClick={() => onEdit(t)} />
                  <IconBtn icon="👁" title="View" onClick={() => onView(t)} />
                  <IconBtn icon="🗑" title="Delete" danger onClick={() => setDeleteTarget(t)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ConfirmDialog
        visible={!!deleteTarget}
        entityName={deleteTarget?.name}
        entityKind="tag"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget); setDeleteTarget(null); }}
      />
    </div>
  );
}

// ═══ PoliciesTable ═════════════════════════════════════════════════════
export function PoliciesTable({ policies = [], onCreate = () => {}, onEdit = () => {}, onDelete = () => {}, onView = () => {} }) {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const filtered = policies.filter(p => !search || (p.name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <HeaderBar title="Policies" subtitle="This table lists the policies you have access to."
        actionLabel="+ Create Policy" onAction={onCreate} search={search} onSearch={setSearch} />
      {filtered.length === 0 ? (
        <EmptyState icon="catalogs" title="Нет policies" actionLabel="+ Create Policy" onAction={onCreate} />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
          <thead><tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
            <th style={cellStyle}>Policy Name</th>
            <th style={cellStyle}>Policy Type</th>
            <th style={cellStyle}>Comment</th>
            <th style={{ ...cellStyle, textAlign: "right" }}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
                <td style={cellStyle}><ColoredChip text={p.name} /></td>
                <td style={{ ...cellStyle, color: "var(--idf-text-muted)", fontFamily: "monospace", fontSize: 12 }}>{p.policyType || "—"}</td>
                <td style={{ ...cellStyle, color: "var(--idf-text-muted)" }}>{p.comment || "—"}</td>
                <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                  <IconBtn icon="✎" title="Edit" onClick={() => onEdit(p)} />
                  <IconBtn icon="👁" title="View" onClick={() => onView(p)} />
                  <IconBtn icon="🗑" title="Delete" danger onClick={() => setDeleteTarget(p)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ConfirmDialog
        visible={!!deleteTarget}
        entityName={deleteTarget?.name}
        entityKind="policy"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget); setDeleteTarget(null); }}
      />
    </div>
  );
}

// ═══ UsersTable ═══════════════════════════════════════════════════════
export function UsersTable({ users = [], onAdd = () => {}, onGrantRole = () => {}, onDelete = () => {} }) {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const filtered = users.filter(u => !search || (u.name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <HeaderBar title="Users" subtitle="Users are the entities that can be granted roles."
        actionLabel="+ Add User" onAction={onAdd} search={search} onSearch={setSearch} />
      {filtered.length === 0 ? (
        <EmptyState icon="catalogs" title="Нет users" actionLabel="+ Add User" onAction={onAdd} />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
          <thead><tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
            <th style={cellStyle}>User Name</th>
            <th style={cellStyle}>Roles</th>
            <th style={{ ...cellStyle, textAlign: "right" }}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
                <td style={{ ...cellStyle, fontWeight: 500 }}>{u.name}</td>
                <td style={cellStyle}>
                  {(u.roles || []).length === 0 ? <span style={{ color: "var(--idf-text-muted)" }}>—</span> : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {u.roles.map(r => (
                        <span key={r} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500, background: "var(--idf-bg-subtle, #f3f4f6)", color: "var(--idf-text)" }}>{r}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                  <IconBtn icon="🔑" title="Grant role" onClick={() => onGrantRole(u)} />
                  <IconBtn icon="🗑" title="Delete" danger onClick={() => setDeleteTarget(u)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ConfirmDialog
        visible={!!deleteTarget}
        entityName={deleteTarget?.name}
        entityKind="user"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget); setDeleteTarget(null); }}
      />
    </div>
  );
}

// ═══ GroupsTable ═══════════════════════════════════════════════════════
export function GroupsTable({ groups = [], onAdd = () => {}, onGrantRole = () => {}, onDelete = () => {} }) {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const filtered = groups.filter(g => !search || (g.name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <HeaderBar title="User Groups" subtitle="User groups are the entities that can be granted roles."
        actionLabel="+ Add User Group" onAction={onAdd} search={search} onSearch={setSearch} />
      {filtered.length === 0 ? (
        <EmptyState icon="catalogs" title="Нет groups" actionLabel="+ Add User Group" onAction={onAdd} />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
          <thead><tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
            <th style={cellStyle}>Group Name</th>
            <th style={cellStyle}>Roles</th>
            <th style={{ ...cellStyle, textAlign: "right" }}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(g => (
              <tr key={g.id} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
                <td style={{ ...cellStyle, fontWeight: 500 }}>{g.name}</td>
                <td style={cellStyle}>
                  {(g.roles || []).length === 0 ? <span style={{ color: "var(--idf-text-muted)" }}>—</span> : (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {g.roles.map(r => (
                        <span key={r} style={{ padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 500, background: "var(--idf-bg-subtle, #f3f4f6)", color: "var(--idf-text)" }}>{r}</span>
                      ))}
                    </div>
                  )}
                </td>
                <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                  <IconBtn icon="🔑" title="Grant role" onClick={() => onGrantRole(g)} />
                  <IconBtn icon="🗑" title="Delete" danger onClick={() => setDeleteTarget(g)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ConfirmDialog
        visible={!!deleteTarget}
        entityName={deleteTarget?.name}
        entityKind="group"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget); setDeleteTarget(null); }}
      />
    </div>
  );
}

// ═══ RolesTable ═══════════════════════════════════════════════════════
export function RolesTable({ roles = [], onCreate = () => {}, onEdit = () => {}, onDelete = () => {}, onSetOwner = () => {} }) {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const filtered = roles.filter(r => !search || (r.name || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <HeaderBar title="Roles" subtitle="Roles are the entities that can be granted to users or user groups."
        actionLabel="+ Create Role" onAction={onCreate} search={search} onSearch={setSearch} searchPlaceholder="Search" />
      {filtered.length === 0 ? (
        <EmptyState icon="versions" title="Нет roles" actionLabel="+ Create Role" onAction={onCreate} />
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
          <thead><tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
            <th style={cellStyle}>Role Name</th>
            <th style={cellStyle}>Owner</th>
            <th style={{ ...cellStyle, textAlign: "right" }}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
                <td style={{ ...cellStyle, fontWeight: 500 }}>{r.name}</td>
                <td style={{ ...cellStyle, color: "var(--idf-text-muted)" }}>{r.owner || "—"}</td>
                <td style={{ ...cellStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                  <IconBtn icon="✎" title="Edit" onClick={() => onEdit(r)} />
                  <IconBtn icon="⚙" title="Set Owner" onClick={() => onSetOwner(r)} />
                  <IconBtn icon="🗑" title="Delete" danger onClick={() => setDeleteTarget(r)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ConfirmDialog
        visible={!!deleteTarget}
        entityName={deleteTarget?.name}
        entityKind="role"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget); setDeleteTarget(null); }}
      />
    </div>
  );
}

function fmtTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}
