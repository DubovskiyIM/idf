import { resolve, template } from "../eval.js";

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

export function Text({ node, ctx, item }) {
  const data = item || ctx.world;
  const val = node.bind ? resolve(data, node.bind) : node.content;
  const text = node.template ? template(node.template, { ...data, item }) : val;
  const style = { fontSize: 14, color: "#1a1a2e", ...getPresetStyle(node.style), ...(node.sx || {}) };
  return <span style={style}>{text ?? ""}</span>;
}

export function Heading({ node, ctx, item }) {
  const data = item || ctx.world;
  const val = node.bind ? resolve(data, node.bind) : node.content;
  const text = node.template ? template(node.template, { ...data, item }) : val;
  const Tag = node.level === 1 ? "h1" : node.level === 3 ? "h3" : "h2";
  const style = {
    fontSize: node.level === 1 ? 22 : node.level === 3 ? 14 : 18,
    fontWeight: 700, color: "#1a1a2e", margin: "0 0 8px",
    fontFamily: "system-ui, sans-serif", ...(node.sx || {}),
  };
  return <Tag style={style}>{text ?? ""}</Tag>;
}

export function Badge({ node, ctx, item }) {
  const data = item || ctx.world;
  const val = node.bind ? resolve(data, node.bind) : node.content;
  if (!val && val !== 0) return null;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, textTransform: "uppercase",
      padding: "2px 8px", borderRadius: 4, background: "#eef2ff",
      color: "#6366f1", ...(node.sx || {}),
    }}>{val}</span>
  );
}

export function Avatar({ node, ctx, item }) {
  const data = item || ctx.world;
  const name = node.bind ? resolve(data, node.bind) : node.content || "?";
  const letter = typeof name === "string" ? name[0]?.toUpperCase() : "?";
  const size = node.size || 32;
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
  const src = node.bind ? resolve(data, node.bind) : node.src;
  return <img src={src} alt="" style={{ maxWidth: "100%", borderRadius: 8, ...(node.sx || {}) }} />;
}

export function Spacer({ node }) {
  return <div style={{ height: node.size || 16, ...(node.sx || {}) }} />;
}

export function Divider({ node }) {
  return <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0", ...(node.sx || {}) }} />;
}
