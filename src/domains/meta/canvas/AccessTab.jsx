import React from "react";

/**
 * Доступ — матрица ролей × intent'ов. Какая роль может вызвать какой
 * intent (canExecute) + visibleFields per role.
 */
export default function AccessTab({ ontology, intents }) {
  const roles = Object.entries(ontology?.roles || {});
  const intentIds = Object.keys(intents || {});

  return (
    <div style={{ padding: "16px 24px", color: "#e8e8ec" }}>
      <div style={{ fontSize: 11, color: "#7a7a85", textTransform: "uppercase", marginBottom: 16 }}>
        canExecute matrix · {roles.length} ролей × {intentIds.length} intent'ов
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #2a2a32", color: "#7a7a85", fontWeight: 400, fontSize: 11, textTransform: "uppercase" }}>
                Intent
              </th>
              {roles.map(([rid]) => (
                <th key={rid} style={{ textAlign: "center", padding: "8px 12px", borderBottom: "1px solid #2a2a32", color: "#bababd", fontSize: 11, fontWeight: 500 }}>
                  {rid}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {intentIds.map((iid) => (
              <tr key={iid}>
                <td style={{ padding: "8px 12px", borderBottom: "1px dashed #2a2a32", color: "#f0f0f4", fontFamily: "monospace", fontSize: 11 }}>
                  {iid}
                </td>
                {roles.map(([rid, role]) => {
                  const allowed = (role.canExecute || []).includes(iid);
                  return (
                    <td key={rid} style={{
                      padding: "8px 12px", textAlign: "center",
                      borderBottom: "1px dashed #2a2a32",
                      color: allowed ? "#3fb950" : "#5a5a64",
                      fontSize: 14,
                    }}>
                      {allowed ? "✓" : "·"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 32, fontSize: 11, color: "#7a7a85", textTransform: "uppercase", marginBottom: 16 }}>
        base + visibleFields per role
      </div>
      {roles.map(([rid, role]) => (
        <div key={rid} style={{ padding: "10px 0", borderBottom: "1px dashed #2a2a32", fontSize: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 4 }}>
            <strong style={{ color: "#f0f0f4" }}>{rid}</strong>
            <span style={{ color: "#7a7a85", fontFamily: "monospace" }}>base · {role.base || "—"}</span>
          </div>
          <span style={{ color: "#9f9faa", fontFamily: "monospace", fontSize: 11 }}>
            {Object.entries(role.visibleFields || {}).map(([ent, fields]) => `${ent}: ${Array.isArray(fields) ? fields.join("/") : fields}`).join(" · ")}
          </span>
        </div>
      ))}
    </div>
  );
}
