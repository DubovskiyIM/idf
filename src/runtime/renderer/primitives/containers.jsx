import { useState, useRef, useEffect } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import { resolve, evalCondition, evalIntentCondition } from "../eval.js";
import { resolveNavigateAction } from "../navigation/navigate.js";

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

// Нормализует intent-спек: поддерживает старый формат (строка = intentId) и
// новый (объект {intentId, opens, overlayKey, label}).
function normalizeIntent(spec) {
  if (typeof spec === "string") return { intentId: spec, label: spec };
  return spec;
}

function fireItemIntent(spec, ctx, item) {
  if (spec.opens === "overlay") {
    ctx.openOverlay?.(spec.overlayKey, { item });
    return;
  }
  ctx.exec(spec.intentId, { id: item?.id, entity: item });
}

export function Card({ node, ctx, item }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const allIntents = (node.intents || [])
    .map(normalizeIntent)
    .filter(spec => {
      // Фильтруем по условиям намерения против item + viewer.
      const conditions = spec.conditions || [];
      return conditions.every(c => evalIntentCondition(c, item, ctx.viewer));
    });
  const visible = allIntents.slice(0, MAX_VISIBLE_ITEM_INTENTS);
  const hidden = allIntents.slice(MAX_VISIBLE_ITEM_INTENTS);

  // Chat-вариант: выравнивание «свои справа, чужие слева» по senderId === viewer.id.
  const isChat = node.variant === "chat";
  const isMine = isChat && item?.senderId && ctx.viewer?.id && item.senderId === ctx.viewer.id;

  const cardStyle = isChat
    ? {
        background: isMine ? "#dbeafe" : "#fff",
        borderRadius: 12,
        padding: 10,
        border: isMine ? "1px solid #bfdbfe" : "1px solid #e5e7eb",
        maxWidth: "70%",
        alignSelf: isMine ? "flex-end" : "flex-start",
        ...(node.sx || {}),
      }
    : {
        background: "#fff", borderRadius: 8, padding: 14,
        border: "1px solid #e5e7eb", boxShadow: "0 1px 3px #0001",
        ...(node.sx || {}),
      };

  return (
    <div style={cardStyle}>
      {(node.children || []).map((child, i) => (
        <SlotRenderer key={i} item={child} ctx={ctx} contextItem={item} />
      ))}
      {allIntents.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap", position: "relative" }}>
          {visible.map(spec => (
            <ItemIntentButton key={spec.intentId} spec={spec} ctx={ctx} item={item} />
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
                  {hidden.map(spec => (
                    <button
                      key={spec.intentId}
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); fireItemIntent(spec, ctx, item); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "6px 10px", background: "transparent", border: "none",
                        cursor: "pointer", fontSize: 12,
                      }}
                    >{spec.label || spec.intentId}</button>
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

function ItemIntentButton({ spec, ctx, item }) {
  const label = spec.label || spec.intentId;
  const icon = spec.icon;
  const LABEL_MAX = 14;
  const showLabel = label.length <= LABEL_MAX;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        fireItemIntent(spec, ctx, item);
      }}
      title={label}
      style={{
        padding: showLabel ? "4px 8px" : "6px 8px",
        borderRadius: 6,
        border: "1px solid #e5e7eb",
        background: "#fff",
        color: "#4b5563",
        fontSize: 11,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        lineHeight: 1,
      }}
    >
      {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
      {showLabel && <span>{label}</span>}
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
    // Для direction:"bottom-up" сортируем ПО ВОЗРАСТАНИЮ (старое сверху,
    // новое внизу — классический чат). Для обычного списка — по убыванию
    // если sort начинается с "-".
    const desc = node.sort.startsWith("-");
    const field = node.sort.replace(/^-/, "");
    items.sort((a, b) => {
      const va = resolve(a, field), vb = resolve(b, field);
      return desc ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
    });
  }

  if (items.length === 0 && node.empty) {
    return <SlotRenderer item={node.empty} ctx={ctx} />;
  }

  const bottomUp = node.direction === "bottom-up";
  const scrollRef = useRef(null);
  // Автопрокрутка к последнему элементу для bottom-up
  useEffect(() => {
    if (bottomUp && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items.length, bottomUp]);

  const onItemClick = node.onItemClick;

  return (
    <div
      ref={scrollRef}
      style={{
        display: "flex", flexDirection: "column",
        gap: node.gap || 6,
        ...(bottomUp ? { minHeight: "100%", justifyContent: "flex-end" } : {}),
        ...(node.sx || {}),
      }}
    >
      {items.map((item, i) => {
        const content = <SlotRenderer item={node.item} ctx={ctx} contextItem={item} />;
        if (!onItemClick) return <div key={item.id || i}>{content}</div>;
        return (
          <ClickableItem key={item.id || i} action={onItemClick} item={item} ctx={ctx}>
            {content}
          </ClickableItem>
        );
      })}
    </div>
  );
}

function ClickableItem({ action, item, ctx, children }) {
  const handleClick = () => {
    const resolved = resolveNavigateAction(action, item, ctx.viewer);
    if (resolved && ctx.navigate) {
      ctx.navigate(resolved.to, resolved.params);
    }
  };
  return (
    <div onClick={handleClick} style={{ cursor: "pointer" }}>
      {children}
    </div>
  );
}
