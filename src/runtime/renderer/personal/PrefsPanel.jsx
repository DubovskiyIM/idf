/**
 * PrefsPanel — панель пользовательских настроек UI (§17 Personal layer).
 * Показывается в V2Shell через кнопку ⚙.
 */

export default function PrefsPanel({ prefs, setPref, resetPrefs, onClose, onLogout, viewer }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: "var(--mantine-color-body, #fff)", borderRadius: 12, padding: 24,
        minWidth: 320, maxWidth: 400,
        boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: "var(--mantine-color-text)" }}>Настройки UI</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--mantine-color-dimmed)" }}>✕</button>
        </div>

        <PrefRow label="Плотность">
          <SegmentPicker
            options={[
              { value: "compact", label: "Компакт" },
              { value: "comfortable", label: "Обычная" },
              { value: "spacious", label: "Просторная" },
            ]}
            value={prefs.density}
            onChange={v => setPref("density", v)}
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
            onChange={v => setPref("fontSize", v)}
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
            onChange={v => setPref("iconMode", v)}
          />
        </PrefRow>

        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          <button
            onClick={resetPrefs}
            style={{
              padding: "6px 16px", borderRadius: 6,
              border: "1px solid var(--mantine-color-default-border, #d1d5db)",
              background: "transparent", color: "var(--mantine-color-dimmed)", fontSize: 12, cursor: "pointer",
            }}
          >Сбросить</button>
          {onLogout && (
            <>
              <div style={{ flex: 1 }} />
              {viewer?.email && (
                <span style={{ fontSize: 11, color: "var(--mantine-color-dimmed)", alignSelf: "center" }}>
                  {viewer.email}
                </span>
              )}
              <button
                onClick={onLogout}
                style={{
                  padding: "6px 16px", borderRadius: 6,
                  border: "1px solid var(--mantine-color-default-border, #d1d5db)",
                  background: "transparent", color: "var(--mantine-color-dimmed)", fontSize: 12, cursor: "pointer",
                }}
              >🚪 Выйти</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function PrefRow({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--mantine-color-dimmed)", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function SegmentPicker({ options, value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 2, background: "var(--mantine-color-default-hover, #f3f4f6)", borderRadius: 6, padding: 2 }}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, padding: "5px 10px", borderRadius: 4, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: value === opt.value ? 600 : 400,
            background: value === opt.value ? "var(--mantine-color-body, #fff)" : "transparent",
            color: value === opt.value ? "var(--mantine-color-text)" : "var(--mantine-color-dimmed)",
            boxShadow: value === opt.value ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
          }}
        >{opt.label}</button>
      ))}
    </div>
  );
}
