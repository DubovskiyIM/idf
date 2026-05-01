/**
 * HeaderBar — слим-хедер для V2Shell.
 *
 * Слева:  имя + email пользователя.
 * Справа: ⚙ (popover с density / fontSize / iconMode / uiKit / role / pattern inspector / reset)
 *         + Выйти.
 *
 * Заменяет inline `toolbarBar` (был большой полосой со «Слой:» segmented picker)
 * — переносим эти контролы в popover, освобождая место под основной UI.
 */
import { useState, useRef, useEffect } from "react";

const UI_KIT_OPTIONS = [
  { value: null, label: "Авто" },
  { value: "mantine", label: "Mantine" },
  { value: "shadcn", label: "Doodle" },
  { value: "apple", label: "Apple" },
  { value: "antd", label: "AntD" },
];

const DENSITY_OPTIONS = [
  { value: "compact", label: "Компакт" },
  { value: "comfortable", label: "Обычная" },
  { value: "spacious", label: "Просторная" },
];

const FONT_SIZE_OPTIONS = [
  { value: "sm", label: "S" },
  { value: "md", label: "M" },
  { value: "lg", label: "L" },
];

const ICON_OPTIONS = [
  { value: "lucide", label: "SVG" },
  { value: "emoji", label: "Emoji" },
  { value: "none", label: "Без" },
];

export default function HeaderBar({
  viewer,
  onLogout,
  activeRole,
  roleOptions = [],
  onSwitchRole = () => {},
  currentKit,
  onChangeKit = () => {},
  prefs = {},
  setPref = () => {},
  resetPrefs = () => {},
}) {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "8px 16px",
      background: "var(--idf-card, #fff)",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      fontSize: 13,
      position: "relative",
      flex: "0 0 auto",
    }}>
      {viewer?.name && (
        <span style={{ fontWeight: 600, color: "var(--idf-text)" }}>{viewer.name}</span>
      )}
      {viewer?.email && (
        <span style={{ color: "var(--idf-text-muted, #868e96)", fontSize: 12 }}>{viewer.email}</span>
      )}
      <div style={{ flex: 1 }} />
      <button
        ref={buttonRef}
        type="button"
        aria-label="Настройки"
        onClick={() => setOpen(v => !v)}
        style={{
          padding: "4px 10px", borderRadius: 4, fontSize: 12,
          border: "1px solid var(--idf-border, #e5e7eb)",
          background: open ? "var(--idf-surface, #f3f4f6)" : "transparent",
          cursor: "pointer", color: "var(--idf-text)",
        }}
      >⚙ Настройки</button>
      {onLogout && (
        <button
          type="button"
          onClick={onLogout}
          style={{
            padding: "4px 12px", borderRadius: 4, fontSize: 12,
            border: "1px solid var(--idf-border, #e5e7eb)",
            background: "transparent", cursor: "pointer", color: "var(--idf-text-muted)",
          }}
        >Выйти</button>
      )}
      {open && (
        <div
          ref={popoverRef}
          aria-label="Настройки"
          style={{
            position: "absolute", top: "calc(100% + 4px)", right: 16,
            minWidth: 320, maxWidth: 400,
            background: "var(--idf-card, #fff)",
            border: "1px solid var(--idf-border, #e5e7eb)",
            borderRadius: 8, padding: 16,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 100,
          }}
        >
          {roleOptions.length > 0 && (
            <PrefRow label="Роль:">
              <Segmented
                options={roleOptions.map(r => ({ value: r.role, label: r.label }))}
                value={activeRole}
                onChange={onSwitchRole}
              />
            </PrefRow>
          )}
          <PrefRow label="Слой">
            <Segmented options={UI_KIT_OPTIONS} value={currentKit} onChange={onChangeKit} />
          </PrefRow>
          <PrefRow label="Плотность">
            <Segmented options={DENSITY_OPTIONS} value={prefs.density} onChange={v => setPref("density", v)} />
          </PrefRow>
          <PrefRow label="Шрифт">
            <Segmented options={FONT_SIZE_OPTIONS} value={prefs.fontSize} onChange={v => setPref("fontSize", v)} />
          </PrefRow>
          <PrefRow label="Иконки">
            <Segmented options={ICON_OPTIONS} value={prefs.iconMode} onChange={v => setPref("iconMode", v)} />
          </PrefRow>
          <PrefRow label="Отладка">
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, cursor: "pointer", color: "var(--idf-text)" }}>
              <input
                type="checkbox"
                checked={!!prefs.patternInspector}
                onChange={e => setPref("patternInspector", e.target.checked)}
                style={{ cursor: "pointer" }}
              />
              <span>Pattern inspector</span>
            </label>
          </PrefRow>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <button
              type="button"
              onClick={resetPrefs}
              style={{
                padding: "4px 12px", borderRadius: 4, fontSize: 11,
                border: "1px solid var(--idf-border)",
                background: "transparent", cursor: "pointer", color: "var(--idf-text-muted)",
              }}
            >Сбросить</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PrefRow({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 600,
        textTransform: "uppercase", letterSpacing: "0.05em",
        color: "var(--idf-text-muted, #868e96)", marginBottom: 4,
      }}>{label}</div>
      {children}
    </div>
  );
}

function Segmented({ options, value, onChange }) {
  return (
    <div style={{
      display: "flex", gap: 2, padding: 2,
      borderRadius: 6, background: "var(--idf-surface, #f3f4f6)",
    }}>
      {options.map(opt => {
        const active = value === opt.value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, padding: "4px 10px", borderRadius: 4,
              border: "none", cursor: "pointer", fontSize: 12,
              fontWeight: active ? 600 : 400,
              background: active ? "var(--idf-primary, #6478f7)" : "transparent",
              color: active ? "white" : "var(--idf-text)",
            }}
          >{opt.label}</button>
        );
      })}
    </div>
  );
}
