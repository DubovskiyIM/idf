/**
 * Рантайм-рендерер артефактов кристаллизации.
 *
 * Интерпретирует JSON-артефакт → React-компоненты.
 * Никакой компиляции. Артефакт хранится в БД, рендерится мгновенно.
 *
 * Формат артефакта:
 * {
 *   projection: "conversation_list",
 *   layout: { type: "list"|"grid"|"card"|"form"|"detail"|"tabs", ... },
 *   children: [...],
 *   intents: [{ id, icon, label, condition, params }]
 * }
 *
 * Примитивы: text, heading, badge, button, input, image, spacer, divider
 * Контейнеры: list, grid, card, row, column, tabs, conditional
 * Интерактив: intentButton, form, select
 */

import { useState, useMemo } from "react";

// Резолвить "path.to.field" в данных
function resolve(data, path) {
  if (!path || !data) return undefined;
  if (typeof path !== "string") return path;
  return path.split(".").reduce((obj, key) => obj?.[key], data);
}

// Проверить условие "field > 0", "field == 'value'", "!field"
function evalCondition(condition, ctx) {
  if (!condition) return true;
  if (typeof condition === "boolean") return condition;
  try {
    // Создаём функцию с контекстом
    const fn = new Function(...Object.keys(ctx), `return !!(${condition})`);
    return fn(...Object.values(ctx));
  } catch { return true; }
}

// Применить шаблон строки "Hello {name}"
function template(str, ctx) {
  if (typeof str !== "string") return str;
  return str.replace(/\{(\w+(?:\.\w+)*)\}/g, (_, path) => resolve(ctx, path) ?? "");
}

export default function ProjectionRenderer({ artifact, world, exec, viewer, theme, onNavigate }) {
  if (!artifact?.layout) return <div style={{ padding: 20, color: "#9ca3af", textAlign: "center" }}>Нет артефакта</div>;

  const ctx = { world, viewer, exec, theme, onNavigate };

  return <RenderNode node={artifact.layout} ctx={ctx} />;
}

function RenderNode({ node, ctx, item, index }) {
  const [localState, setLocalState] = useState({});

  if (!node) return null;
  if (typeof node === "string") return <span>{template(node, { ...ctx, item })}</span>;

  const { world, viewer, exec, theme, onNavigate } = ctx;
  const itemCtx = item ? { ...ctx, item, index } : ctx;
  const data = item || world;

  // Условный рендеринг
  if (node.condition && !evalCondition(node.condition, { ...data, viewer, item, world })) return null;

  // Стили
  const baseStyle = node.style ? (typeof node.style === "object" ? node.style : STYLE_PRESETS[node.style] || {}) : {};
  const style = { ...baseStyle, ...(node.sx || {}) };

  switch (node.type) {
    // === ПРИМИТИВЫ ===
    case "text": {
      const val = node.bind ? resolve(data, node.bind) : node.content;
      const text = node.template ? template(node.template, { ...data, item }) : val;
      const truncated = node.truncate && typeof text === "string" ? text.slice(0, node.truncate) + (text.length > node.truncate ? "…" : "") : text;
      return <span style={{ fontSize: 14, color: "#1a1a2e", ...style }}>{truncated ?? ""}</span>;
    }
    case "heading": {
      const val = node.bind ? resolve(data, node.bind) : node.content;
      const text = node.template ? template(node.template, { ...data, item }) : val;
      const Tag = node.level === 1 ? "h1" : node.level === 3 ? "h3" : "h2";
      return <Tag style={{ fontSize: node.level === 1 ? 22 : node.level === 3 ? 14 : 18, fontWeight: 700, color: "#1a1a2e", margin: "0 0 8px", fontFamily: "system-ui, sans-serif", ...style }}>{text ?? ""}</Tag>;
    }
    case "badge": {
      const val = node.bind ? resolve(data, node.bind) : node.content;
      if (!val && val !== 0) return null;
      return <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", padding: "2px 8px", borderRadius: 4, background: "#eef2ff", color: "#6366f1", ...style }}>{val}</span>;
    }
    case "image": {
      const src = node.bind ? resolve(data, node.bind) : node.src;
      return <img src={src} alt="" style={{ maxWidth: "100%", borderRadius: 8, ...style }} />;
    }
    case "spacer": return <div style={{ height: node.size || 16, ...style }} />;
    case "divider": return <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0", ...style }} />;
    case "avatar": {
      const name = node.bind ? resolve(data, node.bind) : node.content || "?";
      const letter = typeof name === "string" ? name[0]?.toUpperCase() : "?";
      return <div style={{ width: node.size || 32, height: node.size || 32, borderRadius: "50%", background: "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: (node.size || 32) * 0.4, fontWeight: 700, flexShrink: 0, ...style }}>{letter}</div>;
    }

    // === КОНТЕЙНЕРЫ ===
    case "row": return (
      <div style={{ display: "flex", alignItems: node.align || "center", gap: node.gap || 8, flexWrap: node.wrap ? "wrap" : "nowrap", ...style }}>
        {(node.children || []).map((child, i) => <RenderNode key={i} node={child} ctx={ctx} item={item} index={i} />)}
      </div>
    );
    case "column": return (
      <div style={{ display: "flex", flexDirection: "column", gap: node.gap || 8, ...style }}>
        {(node.children || []).map((child, i) => <RenderNode key={i} node={child} ctx={ctx} item={item} index={i} />)}
      </div>
    );
    case "card": return (
      <div onClick={node.onClick ? () => handleAction(node.onClick, { ...data, item }, ctx) : undefined}
        style={{ background: "#fff", borderRadius: 8, padding: 14, border: "1px solid #e5e7eb", boxShadow: "0 1px 3px #0001", cursor: node.onClick ? "pointer" : "default", ...style }}>
        {(node.children || []).map((child, i) => <RenderNode key={i} node={child} ctx={ctx} item={item} />)}
        {node.intents && (
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {node.intents.map(intent => (
              evalCondition(intent.condition, { ...data, item, viewer }) && (
                <button key={intent.id} onClick={(e) => { e.stopPropagation(); exec(intent.id, { ...intent.params, ...resolveParams(intent.params, { ...data, item }) }); }}
                  style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 10, cursor: "pointer" }}>
                  {intent.icon} {intent.label || intent.id}
                </button>
              )
            ))}
          </div>
        )}
      </div>
    );
    case "list": {
      const source = node.source ? resolve(world, node.source) : [];
      let items = Array.isArray(source) ? [...source] : [];
      // Filter
      if (node.filter) {
        items = items.filter(item => evalCondition(node.filter, { ...item, viewer, world }));
      }
      // Sort
      if (node.sort) {
        const desc = node.sort.startsWith("-");
        const field = desc ? node.sort.slice(1) : node.sort;
        items.sort((a, b) => {
          const va = resolve(a, field), vb = resolve(b, field);
          return desc ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
        });
      }
      // Limit
      if (node.limit) items = items.slice(0, node.limit);

      if (items.length === 0 && node.empty) return <RenderNode node={node.empty} ctx={ctx} />;

      return (
        <div style={{ display: "flex", flexDirection: "column", gap: node.gap || 6, ...style }}>
          {items.map((item, i) => <RenderNode key={item.id || i} node={node.item} ctx={ctx} item={item} index={i} />)}
        </div>
      );
    }
    case "grid": {
      const source = node.source ? resolve(world, node.source) : [];
      let items = Array.isArray(source) ? [...source] : [];
      if (node.filter) items = items.filter(item => evalCondition(node.filter, { ...item, viewer, world }));
      return (
        <div style={{ display: "grid", gridTemplateColumns: node.columns || "1fr 1fr", gap: node.gap || 8, ...style }}>
          {items.map((item, i) => <RenderNode key={item.id || i} node={node.item} ctx={ctx} item={item} index={i} />)}
        </div>
      );
    }
    case "tabs": {
      const [activeTab, setActiveTab] = [localState._tab || node.tabs?.[0]?.id, (v) => setLocalState(p => ({ ...p, _tab: v }))];
      const tab = (node.tabs || []).find(t => t.id === activeTab);
      return (
        <div style={style}>
          <div style={{ display: "flex", gap: 4, marginBottom: 12, borderBottom: "1px solid #e5e7eb" }}>
            {(node.tabs || []).map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                style={{ padding: "6px 14px", border: "none", cursor: "pointer", fontSize: 12, background: activeTab === t.id ? "#eef2ff" : "transparent", color: activeTab === t.id ? "#6366f1" : "#6b7280", borderBottom: activeTab === t.id ? "2px solid #6366f1" : "2px solid transparent", fontFamily: "system-ui, sans-serif" }}>
                {t.label}
              </button>
            ))}
          </div>
          {tab && <RenderNode node={tab.content} ctx={ctx} />}
        </div>
      );
    }
    case "conditional": {
      if (evalCondition(node.if, { ...data, viewer, world, item })) {
        return node.then ? <RenderNode node={node.then} ctx={ctx} item={item} /> : null;
      }
      return node.else ? <RenderNode node={node.else} ctx={ctx} item={item} /> : null;
    }

    // === ИНТЕРАКТИВ ===
    case "intentButton": return (
      <button onClick={() => exec(node.intentId, resolveParams(node.params || {}, { ...data, item, viewer }))}
        style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600, fontFamily: "system-ui, sans-serif", ...style }}>
        {node.icon && <span style={{ marginRight: 4 }}>{node.icon}</span>}{node.label || node.intentId}
      </button>
    );
    case "input": {
      const val = localState[node.name] || "";
      return (
        <input value={val} onChange={e => setLocalState(p => ({ ...p, [node.name]: e.target.value }))}
          placeholder={node.placeholder || ""}
          onKeyDown={node.onEnter ? (e) => { if (e.key === "Enter" && val.trim()) { exec(node.onEnter.intentId, { ...resolveParams(node.onEnter.params || {}, { ...data, viewer }), [node.name]: val }); setLocalState(p => ({ ...p, [node.name]: "" })); } } : undefined}
          style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "system-ui, sans-serif", ...style }} />
      );
    }

    default:
      return <div style={{ color: "#ef4444", fontSize: 10 }}>Unknown: {node.type}</div>;
  }
}

function handleAction(action, data, ctx) {
  if (!action) return;
  if (action.action === "navigate" && ctx.onNavigate) {
    const params = resolveParams(action.params || {}, data);
    ctx.onNavigate(action.to, params);
  }
  if (action.action === "exec" && ctx.exec) {
    ctx.exec(action.intentId, resolveParams(action.params || {}, data));
  }
}

function resolveParams(params, data) {
  if (!params) return {};
  const resolved = {};
  for (const [key, val] of Object.entries(params)) {
    if (typeof val === "string" && val.startsWith("item.")) {
      resolved[key] = resolve(data.item || data, val.replace("item.", ""));
    } else if (typeof val === "string" && val.startsWith("viewer.")) {
      resolved[key] = resolve(data.viewer || data, val.replace("viewer.", ""));
    } else {
      resolved[key] = val;
    }
  }
  return resolved;
}

const STYLE_PRESETS = {
  heading: { fontSize: 18, fontWeight: 700, color: "#1a1a2e" },
  secondary: { fontSize: 12, color: "#6b7280" },
  muted: { fontSize: 11, color: "#9ca3af" },
  accent: { color: "#6366f1", fontWeight: 600 },
  danger: { color: "#ef4444" },
  success: { color: "#22c55e" },
  flex1: { flex: 1 },
};
