import { useState } from "react";
import SlotRenderer from "../SlotRenderer.jsx";

export default function Overflow({ spec, ctx }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          padding: "6px 10px", borderRadius: 6, border: "1px solid #d1d5db",
          background: "#fff", cursor: "pointer", fontSize: 14,
        }}
      >⋯</button>
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "absolute", top: "100%", right: 0, marginTop: 4,
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
            boxShadow: "0 4px 12px #0001", padding: 4, zIndex: 10, minWidth: 200,
          }}
        >
          {(spec.children || []).map((child, i) => (
            <SlotRenderer key={i} item={child} ctx={ctx} />
          ))}
        </div>
      )}
    </div>
  );
}
