/**
 * BottomTabs — mobile bottom navigation для секционированных доменов.
 * Каждая секция = один tab. Активная секция с >1 item показывает sub-tabs.
 */
import React from "react";

export default function BottomTabs({ sections, active, onSelect, projectionNames }) {
  const activeSection = sections.find(s => s.items.includes(active));

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      fontFamily: "var(--font-doodle, system-ui)",
    }}>
      {/* Sub-tabs для активной секции с >1 item */}
      {activeSection && activeSection.items.length > 1 && (
        <div style={{
          display: "flex",
          borderTop: "1px dashed var(--color-doodle-border, #c4a77d)",
          background: "var(--color-doodle-bg, #fdf6e3)",
          overflowX: "auto",
          padding: "0 var(--spacing-doodle, 16px)",
        }}>
          {activeSection.items.map(projId => (
            <button
              key={projId}
              onClick={() => onSelect(projId)}
              style={{
                flex: "0 0 auto",
                padding: "6px 12px",
                border: "none",
                background: "transparent",
                fontFamily: "inherit",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
                color: projId === active
                  ? "var(--color-doodle-accent, #4a7c59)"
                  : "var(--color-doodle-ink-light, #8b7355)",
                fontWeight: projId === active ? "bold" : "normal",
                borderBottom: projId === active
                  ? "2px solid var(--color-doodle-accent, #4a7c59)"
                  : "2px solid transparent",
              }}
            >
              {projectionNames?.[projId] || projId.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      )}
      {/* Main tabs */}
      <div style={{
        display: "flex",
        borderTop: "2px solid var(--color-doodle-border, #8b7355)",
        background: "var(--color-doodle-highlight, #f5e6d0)",
      }}>
        {sections.map((sec, i) => {
          const isActive = sec === activeSection;
          return (
            <button
              key={sec.section}
              onClick={() => onSelect(sec.items[0])}
              style={{
                flex: 1,
                padding: "8px 4px",
                border: "none",
                background: isActive ? "rgba(92,64,51,0.1)" : "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                cursor: "pointer",
                fontFamily: "inherit",
                borderRight: i < sections.length - 1
                  ? "1px solid var(--color-doodle-border, #c4a77d)"
                  : "none",
              }}
            >
              <span style={{ fontSize: 18 }}>{sec.icon}</span>
              <span style={{
                fontSize: 9,
                color: isActive
                  ? "var(--color-doodle-ink, #5c4033)"
                  : "var(--color-doodle-ink-light, #8b7355)",
                fontWeight: isActive ? "bold" : "normal",
              }}>
                {sec.section}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
