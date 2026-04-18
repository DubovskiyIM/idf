/**
 * StudioPrefsPanel — панель пользовательских настроек UI в Studio-стиле
 * (slate-палитра, Inter, dark). Та же семантика что и runtime PrefsPanel
 * из §17, но согласована со Studio shell. Обе панели пишут в те же
 * localStorage-ключи через usePersonalPrefs, синхронизация автоматическая.
 */

import React from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function StudioPrefsPanel({ open, prefs, setPref, resetPrefs, onClose, onLogout, viewer }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0, 0, 0, 0.65)",
            backdropFilter: "blur(2px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
            fontFamily: "Inter, -apple-system, system-ui, sans-serif",
          }}
        >
          <motion.div
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 12,
              padding: "24px 28px",
              width: 440,
              maxWidth: "92vw",
              color: "#e2e8f0",
              boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>Настройки UI</div>
              <button
                onClick={onClose}
                style={{ background: "transparent", border: "none", color: "#64748b", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1 }}
              >✕</button>
            </div>

            <PrefRow label="Плотность">
              <SegmentPicker
                options={[
                  { value: "compact", label: "Компакт" },
                  { value: "comfortable", label: "Обычная" },
                  { value: "spacious", label: "Просторная" },
                ]}
                value={prefs.density}
                onChange={(v) => setPref("density", v)}
              />
            </PrefRow>

            <PrefRow label="Размер шрифта">
              <SegmentPicker
                options={[
                  { value: "sm", label: "S" },
                  { value: "md", label: "M" },
                  { value: "lg", label: "L" },
                ]}
                value={prefs.fontSize}
                onChange={(v) => setPref("fontSize", v)}
              />
            </PrefRow>

            <PrefRow label="Иконки">
              <SegmentPicker
                options={[
                  { value: "lucide", label: "SVG" },
                  { value: "emoji", label: "Emoji" },
                  { value: "none", label: "Без" },
                ]}
                value={prefs.iconMode}
                onChange={(v) => setPref("iconMode", v)}
              />
            </PrefRow>

            <PrefRow label="UI-kit (адаптер)">
              <SegmentPicker
                options={[
                  { value: null, label: "Авто" },
                  { value: "mantine", label: "Mantine" },
                  { value: "shadcn", label: "Doodle" },
                  { value: "apple", label: "Apple" },
                  { value: "antd", label: "AntD" },
                ]}
                value={prefs.uiKit}
                onChange={(v) => setPref("uiKit", v)}
              />
            </PrefRow>

            <PrefRow label="Отладка">
              <label
                style={{
                  display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
                  fontSize: 13, color: "#cbd5e1",
                  padding: "8px 12px", background: "#1e293b",
                  borderRadius: 6, border: "1px solid #334155",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!prefs.patternInspector}
                  onChange={(e) => setPref("patternInspector", e.target.checked)}
                  style={{ cursor: "pointer", accentColor: "#6366f1" }}
                />
                <span>Pattern Inspector</span>
                <span style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginLeft: "auto" }}>dev</span>
              </label>
            </PrefRow>

            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginTop: 22,
              paddingTop: 16, borderTop: "1px solid #1e293b",
            }}>
              <button
                onClick={resetPrefs}
                style={{
                  padding: "7px 14px", borderRadius: 6,
                  border: "1px solid #334155",
                  background: "transparent", color: "#94a3b8",
                  fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                }}
              >Сбросить</button>
              <div style={{ flex: 1 }} />
              {viewer?.email && (
                <span style={{ fontSize: 11, color: "#64748b" }}>
                  {viewer.email}
                </span>
              )}
              {onLogout && (
                <button
                  onClick={onLogout}
                  style={{
                    padding: "7px 14px", borderRadius: 6,
                    border: "1px solid #334155",
                    background: "transparent", color: "#cbd5e1",
                    fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                  }}
                >Выйти</button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PrefRow({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em",
        color: "#64748b", marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  );
}

function SegmentPicker({ options, value, onChange }) {
  return (
    <div style={{
      display: "flex", gap: 2,
      background: "#1e293b", border: "1px solid #334155",
      borderRadius: 6, padding: 3,
    }}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, padding: "6px 10px", borderRadius: 4, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: active ? 600 : 400, fontFamily: "inherit",
              background: active ? "#4338ca" : "transparent",
              color: active ? "#ffffff" : "#94a3b8",
              transition: "background 0.12s, color 0.12s",
            }}
          >{opt.label}</button>
        );
      })}
    </div>
  );
}
