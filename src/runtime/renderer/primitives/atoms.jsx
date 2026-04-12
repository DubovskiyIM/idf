import { useState, useEffect } from "react";
import { resolve, template } from "../eval.js";
import { getAdaptedComponent } from "../adapters/registry.js";

const STYLE_PRESETS = {
  heading: { fontSize: 18, fontWeight: 700, color: "#1a1a2e" },
  secondary: { fontSize: 12, color: "#6b7280" },
  muted: { fontSize: 11, color: "#9ca3af" },
  accent: { color: "#6366f1", fontWeight: 600 },
  danger: { color: "#ef4444" },
  success: { color: "#22c55e" },
};

function getPresetStyle(name) {
  if (!name) return {};
  return (typeof name === "object" ? name : STYLE_PRESETS[name]) || {};
}

function formatValue(raw, format) {
  if (raw == null || raw === "") return raw;
  if (format === "datetime") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!isNaN(n) && n > 1e12) {
      return new Date(n).toLocaleString("ru", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }
    return raw;
  }
  if (format === "number") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!isNaN(n)) return n.toLocaleString("ru");
    return raw;
  }
  return raw;
}

export function Text({ node, ctx, item }) {
  const data = item || ctx.world;
  const rawVal = node.bind ? resolve(data, node.bind) : node.content;
  const val = node.format ? formatValue(rawVal, node.format) : rawVal;
  const text = node.template ? template(node.template, { ...data, item }) : val;

  // Адаптер: Mantine Text. Preset может быть строковым (ссылка на
  // TEXT_PRESETS) или объектом (inline стили — пробрасываются как есть).
  // Mantine Text сам наследует цвет из темы (адаптируется к dark/light).
  const AdaptedText = getAdaptedComponent("primitive", "text");
  if (AdaptedText) {
    const isStringPreset = typeof node.style === "string";
    return (
      <AdaptedText
        preset={isStringPreset ? node.style : undefined}
        style={{
          ...(isStringPreset ? {} : (node.style || {})),
          ...(node.sx || {}),
        }}
      >
        {text ?? ""}
      </AdaptedText>
    );
  }

  // Fallback: inline-span через CSS variable (адаптируется к dark).
  const style = {
    fontSize: 14,
    color: "var(--mantine-color-text, #1a1a2e)",
    ...getPresetStyle(node.style),
    ...(node.sx || {}),
  };
  return <span style={style}>{text ?? ""}</span>;
}

export function Heading({ node, ctx, item }) {
  const data = item || ctx.world;
  const val = node.bind ? resolve(data, node.bind) : node.content;
  const text = node.template ? template(node.template, { ...data, item }) : val;
  const level = node.level || 2;

  // Адаптер: Mantine Title с правильным order.
  const AdaptedHeading = getAdaptedComponent("primitive", "heading");
  if (AdaptedHeading) {
    return <AdaptedHeading level={level}>{text ?? ""}</AdaptedHeading>;
  }

  // Fallback: обычный h1/h2/h3 с Mantine CSS variable.
  const Tag = level === 1 ? "h1" : level === 3 ? "h3" : "h2";
  const style = {
    fontSize: level === 1 ? 22 : level === 3 ? 14 : 18,
    fontWeight: 700,
    color: "var(--mantine-color-text, #1a1a2e)",
    margin: "0 0 8px",
    fontFamily: "system-ui, sans-serif",
    ...(node.sx || {}),
  };
  return <Tag style={style}>{text ?? ""}</Tag>;
}

export function Badge({ node, ctx, item }) {
  const data = item || ctx.world;
  const val = node.bind ? resolve(data, node.bind) : node.content;
  if (!val && val !== 0) return null;

  // Адаптер: Mantine Badge.
  const AdaptedBadge = getAdaptedComponent("primitive", "badge");
  if (AdaptedBadge) {
    return <AdaptedBadge color={node.color}>{val}</AdaptedBadge>;
  }

  // Fallback: inline-span.
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, textTransform: "uppercase",
      padding: "2px 8px", borderRadius: 4, background: "#eef2ff",
      color: "#6366f1", ...(node.sx || {}),
    }}>{val}</span>
  );
}

export function Avatar({ node, ctx, item }) {
  // Avatar — функциональная роль, не технический тип. Если bind указывает
  // на картинку (data URL / http URL) — используем её, иначе инициал имени.
  // Имя берётся из nameBind (если задан) или "name" по умолчанию.
  const data = item || ctx.world;
  const src = node.bind ? resolve(data, node.bind) : null;
  const size = node.size || 32;
  const isImage = typeof src === "string" && (src.startsWith("data:") || src.startsWith("http") || src.startsWith("/"));
  const nameField = node.nameBind || "name";
  const name = resolve(data, nameField) || node.content || "?";

  // Адаптер: Mantine Avatar — умеет показать и картинку, и initials через
  // color="initials" — получает контраст, автоматический цвет.
  const AdaptedAvatar = getAdaptedComponent("primitive", "avatar");
  if (AdaptedAvatar) {
    return (
      <AdaptedAvatar
        src={isImage ? src : null}
        name={typeof name === "string" ? name : "?"}
        size={size}
      />
    );
  }

  // Fallback: inline img/letter.
  if (isImage) {
    return (
      <img
        src={src}
        alt=""
        style={{
          width: size, height: size, borderRadius: "50%",
          objectFit: "cover", flexShrink: 0, ...(node.sx || {}),
        }}
      />
    );
  }
  const letter = typeof name === "string" ? name[0]?.toUpperCase() : "?";
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: "#6366f1",
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.4, fontWeight: 700, flexShrink: 0, ...(node.sx || {}),
    }}>{letter}</div>
  );
}

export function Image({ node, ctx, item }) {
  const data = item || ctx.world;
  const raw = node.bind ? resolve(data, node.bind) : node.src;
  if (!raw) return null;
  const srcs = Array.isArray(raw) ? raw : [raw];
  const validSrcs = srcs.filter(s => typeof s === "string" && (s.startsWith("data:") || s.startsWith("http") || s.startsWith("/")));
  if (validSrcs.length === 0) return null;
  if (validSrcs.length === 1) {
    return <img src={validSrcs[0]} alt="" style={{ maxWidth: "100%", borderRadius: 8, ...(node.sx || {}) }} />;
  }
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {validSrcs.map((src, i) => (
        <img key={i} src={src} alt="" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 8, ...(node.sx || {}) }} />
      ))}
    </div>
  );
}

export function Audio({ node, ctx, item }) {
  const data = item || ctx.world;
  const src = node.bind ? resolve(data, node.bind) : node.src;
  if (!src) return null;
  // colorScheme inherit позволяет браузеру применить dark-стиль
  // к native audio controls через CSS `color-scheme` наследование.
  return (
    <audio
      src={src}
      controls
      style={{
        maxWidth: "100%",
        marginTop: 4,
        colorScheme: "light dark",
        ...(node.sx || {}),
      }}
    />
  );
}

export function Spacer({ node }) {
  return <div style={{ height: node.size || 16, ...(node.sx || {}) }} />;
}

export function Divider({ node }) {
  return <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0", ...(node.sx || {}) }} />;
}

/**
 * StatBar — горизонтальная полоса компактных stat-бейджей.
 * Показывает числовые и boolean поля как «label: value» в сетке.
 * Пустые значения (null/undefined/"") скрываются.
 */
export function StatBar({ node, ctx, item }) {
  const data = item || ctx.world;
  const stats = (node.fields || [])
    .map(f => {
      const raw = resolve(data, f.name);
      if (raw == null || raw === "") return null;
      const formatted = f.type === "boolean"
        ? (raw ? "✓ Да" : "✕ Нет")
        : (typeof raw === "number" ? raw.toLocaleString("ru") : String(raw));
      return { label: f.label, value: formatted };
    })
    .filter(Boolean);
  if (stats.length === 0) return null;
  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 8,
    }}>
      {stats.map((s, i) => (
        <div key={i} style={{
          padding: "8px 14px", borderRadius: 8,
          background: "var(--mantine-color-default-hover)",
          border: "1px solid var(--mantine-color-default-border)",
          display: "flex", flexDirection: "column", alignItems: "center",
          minWidth: 80, flex: "1 1 0",
        }}>
          <span style={{
            fontSize: 18, fontWeight: 700,
            color: "var(--mantine-color-text)",
          }}>{s.value}</span>
          <span style={{
            fontSize: 11, color: "var(--mantine-color-dimmed)",
            marginTop: 2,
          }}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * PriceBlock — группа ценовых полей с выделением primary.
 */
export function PriceBlock({ node, ctx, item }) {
  const data = item || ctx.world;
  const rendered = (node.fields || [])
    .map(f => {
      const raw = resolve(data, f.bind);
      if (raw == null || raw === "") return null;
      const val = typeof raw === "number" ? raw.toLocaleString("ru") + " ₽" : String(raw);
      return { ...f, val };
    })
    .filter(Boolean);
  if (rendered.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {rendered.map((f, i) => (
        <div key={i} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          {f.label && (
            <span style={{ fontSize: 12, color: "var(--mantine-color-dimmed)" }}>{f.label}:</span>
          )}
          <span style={{
            fontSize: f.primary ? 24 : 14,
            fontWeight: f.primary ? 700 : 400,
            color: "var(--mantine-color-text)",
          }}>{f.val}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * InfoSection — именованная группа label:value пар. Скрывается если все пусты.
 */
export function InfoSection({ node, ctx, item }) {
  const data = item || ctx.world;
  const rows = (node.fields || [])
    .map(f => {
      const raw = resolve(data, f.bind);
      if (raw == null || raw === "") return null;
      let val = raw;
      if (f.format === "currency" && typeof raw === "number") val = raw.toLocaleString("ru") + " ₽";
      else if (f.format === "datetime" && typeof raw === "number" && raw > 1e12) {
        val = new Date(raw).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      }
      else if (typeof raw === "boolean") val = raw ? "Да" : "Нет";
      else val = String(raw);
      return { label: f.label, val };
    })
    .filter(Boolean);
  if (rows.length === 0) return null;

  return (
    <div>
      {node.title && (
        <div style={{
          fontSize: 11, fontWeight: 600, textTransform: "uppercase",
          letterSpacing: "0.06em", color: "var(--mantine-color-dimmed)",
          marginBottom: 8, paddingBottom: 6,
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}>{node.title}</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--mantine-color-dimmed)", minWidth: 100 }}>{r.label}:</span>
            <span style={{ fontSize: 13, color: "var(--mantine-color-text)" }}>{r.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Timer — обратный отсчёт по datetime-полю.
 */
export function Timer({ node, ctx, item }) {
  const data = item || ctx.world;
  const raw = node.bind ? resolve(data, node.bind) : null;
  if (!raw) return null;

  const target = typeof raw === "number" ? raw : new Date(raw).getTime();
  if (isNaN(target)) return null;

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const diff = target - Date.now();
  let text;
  if (diff <= 0) {
    text = "завершён";
  } else {
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    text = days > 0 ? `${days}д ${hours}ч` : `${hours}ч ${mins}м`;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      {node.label && <span style={{ fontSize: 12, color: "var(--mantine-color-dimmed)" }}>{node.label}:</span>}
      <span style={{
        fontSize: 13, fontWeight: 600,
        color: diff <= 0 ? "var(--mantine-color-red-6, #ef4444)" : diff < 86400000 ? "var(--mantine-color-yellow-6, #f59e0b)" : "var(--mantine-color-text)",
      }}>⏰ {text}</span>
    </div>
  );
}
