import { useState } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import { resolve, evalCondition } from "../eval.js";

export function Row({ node, ctx, item }) {
  return (
    <div style={{
      display: "flex", alignItems: node.align || "center",
      gap: node.gap || 8, flexWrap: node.wrap ? "wrap" : "nowrap",
      ...(node.sx || {}),
    }}>
      {(node.children || []).map((child, i) => (
        <SlotRenderer key={i} item={child} ctx={ctx} contextItem={item} />
      ))}
    </div>
  );
}

export function Column({ node, ctx, item }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column",
      gap: node.gap || 8, ...(node.sx || {}),
    }}>
      {(node.children || []).map((child, i) => (
        <SlotRenderer key={i} item={child} ctx={ctx} contextItem={item} />
      ))}
    </div>
  );
}

const MAX_VISIBLE_ITEM_INTENTS = 3;

export function Card({ node, ctx, item }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const allIntents = node.intents || [];
  const visible = allIntents.slice(0, MAX_VISIBLE_ITEM_INTENTS);
  const hidden = allIntents.slice(MAX_VISIBLE_ITEM_INTENTS);

  return (
    <div style={{
      background: "#fff", borderRadius: 8, padding: 14,
      border: "1px solid #e5e7eb", boxShadow: "0 1px 3px #0001",
      ...(node.sx || {}),
    }}>
      {(node.children || []).map((child, i) => (
        <SlotRenderer key={i} item={child} ctx={ctx} contextItem={item} />
      ))}
      {allIntents.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap", position: "relative" }}>
          {visible.map(intentId => (
            <ItemIntentButton key={intentId} intentId={intentId} ctx={ctx} item={item} />
          ))}
          {hidden.length > 0 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
                style={{
                  padding: "3px 8px", borderRadius: 4, border: "1px solid #d1d5db",
                  background: "#fff", color: "#6b7280", fontSize: 10, cursor: "pointer",
                }}
              >⋯</button>
              {menuOpen && (
                <div
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                  style={{
                    position: "absolute", top: "100%", right: 0, marginTop: 4,
                    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
                    boxShadow: "0 4px 12px #0001", padding: 4, zIndex: 10, minWidth: 180,
                  }}
                >
                  {hidden.map(intentId => (
                    <button
                      key={intentId}
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); ctx.exec(intentId, { id: item?.id, entity: item }); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "6px 10px", background: "transparent", border: "none",
                        cursor: "pointer", fontSize: 12,
                      }}
                    >{intentId}</button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ItemIntentButton({ intentId, ctx, item }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); ctx.exec(intentId, { id: item?.id, entity: item }); }}
      style={{
        padding: "3px 8px", borderRadius: 4, border: "1px solid #d1d5db",
        background: "#fff", color: "#6b7280", fontSize: 10, cursor: "pointer",
      }}
    >
      {intentId}
    </button>
  );
}

export function List({ node, ctx }) {
  const source = node.source ? resolve(ctx.world, node.source) : [];
  let items = Array.isArray(source) ? [...source] : [];

  if (node.filter) {
    items = items.filter(it => evalCondition(node.filter, { ...it, item: it, viewer: ctx.viewer, world: ctx.world }));
  }
  if (node.sort) {
    const desc = node.sort.startsWith("-") || node.direction === "bottom-up";
    const field = node.sort.replace(/^-/, "");
    items.sort((a, b) => {
      const va = resolve(a, field), vb = resolve(b, field);
      return desc ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
    });
  }

  if (items.length === 0 && node.empty) {
    return <SlotRenderer item={node.empty} ctx={ctx} />;
  }

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      gap: node.gap || 6, ...(node.sx || {}),
    }}>
      {items.map((item, i) => (
        <SlotRenderer key={item.id || i} item={node.item} ctx={ctx} contextItem={item} />
      ))}
    </div>
  );
}
