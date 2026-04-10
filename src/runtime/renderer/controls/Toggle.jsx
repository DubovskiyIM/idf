import { resolve } from "../eval.js";

export default function Toggle({ spec, ctx }) {
  const currentState = spec.state ? resolve(ctx.world, spec.state) : false;
  const activeIntent = currentState ? spec.intents[1] : spec.intents[0];
  const icon = spec.icon?.[currentState ? "true" : "false"] || "↔";

  return (
    <button
      onClick={() => ctx.exec(activeIntent, {})}
      style={{
        padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db",
        background: "#fff", cursor: "pointer", fontSize: 14,
      }}
      title={spec.label}
    >{icon}</button>
  );
}
