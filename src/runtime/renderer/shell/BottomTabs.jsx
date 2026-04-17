/**
 * BottomTabs — iOS-style bottom tab bar с Lucide иконками.
 */
import React from "react";
import { Home, CheckSquare, Calendar, Compass, Trophy } from "lucide-react";

const SECTION_ICONS = {
  "Главная": Home,
  "Трекер": CheckSquare,
  "Календарь": Calendar,
  "Карта жизни": Compass,
  "Достижения": Trophy,
};

export default function BottomTabs({ sections, active, onSelect, projectionNames }) {
  const activeSection = sections.find(s => s.items.includes(active));

  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 50,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', system-ui, sans-serif",
    }}>
      {/* Sub-tabs */}
      {activeSection && activeSection.items.length > 1 && (
        <div style={{
          display: "flex",
          background: "rgba(249, 249, 249, 0.94)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: "0.5px solid rgba(60, 60, 67, 0.12)",
          overflowX: "auto",
          padding: "0 16px",
          gap: 4,
        }}>
          {activeSection.items.map(projId => {
            const isActive = projId === active;
            return (
              <button
                key={projId}
                onClick={() => onSelect(projId)}
                style={{
                  flex: "0 0 auto",
                  padding: "8px 14px",
                  border: "none",
                  background: isActive ? "rgba(0, 122, 255, 0.08)" : "transparent",
                  borderRadius: 8,
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  letterSpacing: "-0.08px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  color: isActive ? "#007aff" : "#8e8e93",
                  transition: "all 0.2s",
                  margin: "4px 0",
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {projectionNames?.[projId] || projId.replace(/_/g, " ")}
              </button>
            );
          })}
        </div>
      )}

      {/* Main tab bar */}
      <div style={{
        display: "flex",
        borderTop: "0.5px solid rgba(60, 60, 67, 0.29)",
        background: "rgba(249, 249, 249, 0.94)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}>
        {sections.map((sec) => {
          const isActive = sec === activeSection;
          const LucideIcon = SECTION_ICONS[sec.section];
          return (
            <button
              key={sec.section}
              onClick={() => onSelect(sec.items[0])}
              style={{
                flex: 1,
                padding: "8px 4px 4px",
                border: "none",
                background: "transparent",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
                cursor: "pointer",
                fontFamily: "inherit",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {LucideIcon ? (
                <LucideIcon
                  size={28}
                  strokeWidth={isActive ? 2 : 1.5}
                  color={isActive ? "#007aff" : "#8e8e93"}
                  style={{ transition: "color 0.2s" }}
                />
              ) : (
                <span style={{ fontSize: 24, opacity: isActive ? 1 : 0.5 }}>{sec.icon}</span>
              )}
              <span style={{
                fontSize: 10,
                fontWeight: isActive ? 600 : 400,
                letterSpacing: "0.07px",
                color: isActive ? "#007aff" : "#8e8e93",
                lineHeight: "13px",
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
