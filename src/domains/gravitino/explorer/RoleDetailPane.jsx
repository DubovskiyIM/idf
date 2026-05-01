/**
 * RoleDetailPane — tabbed read-only view для Role (U-iam, B12).
 *
 * Tabs: Privileges / Properties.
 * Privileges — securableObjects сгруппированы по type (metalake/catalog/
 * schema/table/...): таблицы по resource, каждая privilege — chip ALLOW
 * (зелёный #71DD37) или DENY (красный #FF3E1D с × префиксом).
 *
 * Read-only — privilege editing (grant/revoke) — backend U-iam-b.
 *
 * Поддерживает обе формы privilege в seed:
 *   - Gravitino seed:    privileges: ["select", "modify"]   (string[])
 *   - Gravitino API:     privileges: [{ name, condition }]   (object[])
 * И обе формы resource label: `fullName` (если задан) либо `name` fallback.
 */
import { useMemo, useState } from "react";
import Tabs from "./Tabs.jsx";

const TABS = [
  { key: "privileges", label: "Privileges" },
  { key: "properties", label: "Properties" },
];

export default function RoleDetailPane({ role }) {
  const [active, setActive] = useState("privileges");
  const grouped = useMemo(() => {
    const objects = role.securableObjects || [];
    const map = new Map();
    for (const o of objects) {
      const type = o.type || "other";
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(o);
    }
    return Array.from(map.entries());
  }, [role.securableObjects]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header name={role.name} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs tabs={TABS} active={active} onChange={setActive}>
          {active === "privileges" && (
            grouped.length === 0 ? (
              <Empty>Нет привилегий — назначьте securable objects</Empty>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {grouped.map(([type, objects]) => (
                  <ResourceGroup key={type} type={type} objects={objects} />
                ))}
              </div>
            )
          )}
          {active === "properties" && <PropsTable obj={role.properties} />}
        </Tabs>
      </div>
    </div>
  );
}

function Header({ name }) {
  return (
    <div style={{
      padding: "14px 16px",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fff)",
      display: "flex", alignItems: "baseline", gap: 12,
    }}>
      <span style={{ fontSize: 16 }}>🎭</span>
      <div style={{ fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{name}</div>
    </div>
  );
}

function ResourceGroup({ type, objects }) {
  return (
    <div>
      <h4 style={{
        margin: "0 0 8px", fontSize: 11, textTransform: "uppercase",
        letterSpacing: "0.05em", color: "var(--idf-text-muted)",
      }}>{type}</h4>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
        <thead>
          <tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
            <th style={cellStyle}>Resource</th>
            <th style={cellStyle}>Privileges</th>
          </tr>
        </thead>
        <tbody>
          {objects.map((obj, i) => {
            const label = obj.fullName || obj.name || "(unnamed)";
            const privileges = normalizePrivileges(obj.privileges);
            return (
              <tr key={`${label}-${i}`} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
                <td style={{ ...cellStyle, fontFamily: "monospace", fontSize: 12 }}>{label}</td>
                <td style={cellStyle}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {privileges.map((p, j) => (
                      <PrivilegeChip key={`${p.name}-${j}`} name={p.name} condition={p.condition} />
                    ))}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Нормализуем privileges к [{ name, condition }]. Принимаем:
//   ["select", "modify"]                          → ALLOW по умолчанию
//   [{ name: "USE_METALAKE", condition: "ALLOW" }] → as is
function normalizePrivileges(privileges) {
  if (!Array.isArray(privileges)) return [];
  return privileges.map(p => {
    if (typeof p === "string") return { name: p, condition: "ALLOW" };
    return { name: p.name, condition: p.condition || "ALLOW" };
  });
}

function PrivilegeChip({ name, condition }) {
  const isDeny = condition === "DENY";
  const color = isDeny ? "#FF3E1D" : "#71DD37";
  const bg = isDeny ? "rgba(255,62,29,0.18)" : "rgba(113,221,55,0.18)";
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: bg, color,
    }}>
      {isDeny && "× "}{name}
    </span>
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
