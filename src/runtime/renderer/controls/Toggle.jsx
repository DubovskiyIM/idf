import { resolve } from "../eval.js";

export default function Toggle({ spec, ctx }) {
  const currentState = spec.state ? resolve(ctx.world, spec.state) : false;
  const activeIntent = currentState ? spec.intents[1] : spec.intents[0];
  const icon = spec.icon?.[currentState ? "true" : "false"] || "↔";
  const label = spec.label || activeIntent;

  return (
    <button
      onClick={() => ctx.exec(activeIntent, {})}
      style={{
        padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db",
        background: "#fff", cursor: "pointer", fontSize: 12,
        display: "inline-flex", alignItems: "center", gap: 4,
      }}
      title={label}
    >
      <span>{icon}</span>
      <span style={{ fontSize: 11, color: "#6b7280" }}>{label}</span>
    </button>
  );
}
