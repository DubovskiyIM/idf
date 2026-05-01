/**
 * GroupDetailPane — tabbed view для UserGroup (U-iam, B13).
 *
 * Tabs: Members / Roles. Members — список user-names с avatar +
 * Remove-кнопкой; «+ Add Member» открывает inline selector с users
 * НЕ в group (filter `!members.includes(name)`).
 *
 * Roles tab — read-only chips. Назначение/отзыв ролей — через role_list
 * actions (grantRoleToGroup / revokeRoleFromGroup) — отдельный flow.
 *
 * Membership state — оптимистично через onAddMember/onRemoveMember;
 * backend exec (addGroupMember/removeGroupMember) — U-iam-b.
 */
import { useMemo, useState } from "react";
import Tabs from "./Tabs.jsx";

const TABS = [
  { key: "members", label: "Members" },
  { key: "roles", label: "Roles" },
];

export default function GroupDetailPane({
  group, users = [],
  onAddMember = () => {}, onRemoveMember = () => {},
}) {
  const [active, setActive] = useState("members");
  const [addOpen, setAddOpen] = useState(false);
  const members = group.members || [];
  const roles = group.roles || [];

  const candidates = useMemo(
    () => users.filter(u => !members.includes(u.name)),
    [users, members]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header name={group.name} memberCount={members.length} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs tabs={TABS} active={active} onChange={setActive}>
          {active === "members" && (
            <div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button
                  type="button"
                  onClick={() => setAddOpen(o => !o)}
                  style={{
                    padding: "5px 12px", fontSize: 11, fontWeight: 600,
                    border: "1px solid var(--idf-primary, #6478f7)",
                    background: addOpen ? "var(--idf-bg-subtle, #f9fafb)" : "var(--idf-primary, #6478f7)",
                    color: addOpen ? "var(--idf-primary, #6478f7)" : "white",
                    borderRadius: 4, cursor: "pointer",
                  }}
                >+ Add Member</button>
              </div>
              {addOpen && (
                <div style={{
                  background: "var(--idf-bg-subtle, #f9fafb)",
                  border: "1px solid var(--idf-border, #e5e7eb)",
                  borderRadius: 6, padding: 12, marginBottom: 12, maxHeight: 240, overflow: "auto",
                }}>
                  <div style={{
                    fontSize: 11, color: "var(--idf-text-muted)", marginBottom: 6,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}>Доступные users</div>
                  {candidates.length === 0 ? (
                    <div style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>Все users уже в group</div>
                  ) : candidates.map(u => (
                    <div
                      key={u.id}
                      onClick={() => { onAddMember(u.name); setAddOpen(false); }}
                      style={{
                        padding: "5px 8px", fontSize: 12, cursor: "pointer", borderRadius: 4,
                        color: "var(--idf-text)",
                      }}
                    >{u.name}</div>
                  ))}
                </div>
              )}
              {members.length === 0 ? (
                <Empty>Нет членов в этой group</Empty>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
                  <thead>
                    <tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
                      <th style={cellStyle}>User</th>
                      <th style={{ ...cellStyle, textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(name => (
                      <tr key={name} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
                        <td style={cellStyle}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                            <Avatar name={name} />
                            <span>{name}</span>
                          </span>
                        </td>
                        <td style={{ ...cellStyle, textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => onRemoveMember(name)}
                            style={{
                              padding: "3px 10px", fontSize: 11,
                              border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4,
                              background: "transparent", color: "var(--idf-text-muted)",
                              cursor: "pointer",
                            }}
                          >Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
          {active === "roles" && (
            roles.length === 0 ? (
              <Empty>Нет назначенных ролей</Empty>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {roles.map(r => (
                  <span key={r} style={{
                    padding: "5px 12px", borderRadius: 4, fontSize: 12, fontWeight: 500,
                    background: "rgba(100,120,247,0.18)", color: "var(--idf-primary, #6478f7)",
                  }}>🎭 {r}</span>
                ))}
              </div>
            )
          )}
        </Tabs>
      </div>
    </div>
  );
}

function Header({ name, memberCount }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fff)",
      display: "flex", alignItems: "baseline", gap: 12,
    }}>
      <span style={{ fontSize: 16 }}>👥</span>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{name}</div>
      <span style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>{memberCount} member{memberCount === 1 ? "" : "s"}</span>
    </div>
  );
}

function Avatar({ name }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 18, height: 18, borderRadius: "50%",
      background: "var(--idf-primary, #6478f7)", color: "white",
      fontSize: 10, fontWeight: 600,
    }}>{(name || "?").slice(0, 1).toUpperCase()}</span>
  );
}

function Empty({ children }) {
  return <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--idf-text-muted)" }}>{children}</div>;
}

const cellStyle = { padding: "8px 12px", textAlign: "left" };
