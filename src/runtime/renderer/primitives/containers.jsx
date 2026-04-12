import { useState, useRef, useEffect } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import { resolve, evalCondition, evalIntentCondition } from "../eval.js";
import { resolveNavigateAction } from "../navigation/navigate.js";
import Icon from "../adapters/Icon.jsx";
import { getAdaptedComponent } from "../adapters/registry.js";

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

function groupReactions(reactions) {
  const map = new Map();
  for (const r of reactions) {
    map.set(r.emoji, (map.get(r.emoji) || 0) + 1);
  }
  return [...map.entries()].map(([emoji, count]) => ({ emoji, count }));
}

// Нормализует intent-спек: поддерживает старый формат (строка = intentId) и
// новый (объект {intentId, opens, overlayKey, label}).
function normalizeIntent(spec) {
  if (typeof spec === "string") return { intentId: spec, label: spec };
  return spec;
}

function fireItemIntent(spec, ctx, item) {
  if (spec.opens === "overlay") {
    if (ctx.openOverlay) {
      ctx.openOverlay(spec.overlayKey, { item });
    } else {
      console.warn(`[renderer] openOverlay не доступен для overlay key "${spec.overlayKey}"`);
    }
    return;
  }
  ctx.exec(spec.intentId, { id: item?.id, entity: item });

  // Post-exec navigation: create_direct_chat → navigate to chat_view.
  // Exec создаёт conversation синхронно в local effects (proposed → confirmed),
  // через ~50ms conversation появится в world. Ждём следующий tick и ищем
  // новую conversation по targetUserId.
  if (spec.intentId === "create_direct_chat" && ctx.navigate) {
    setTimeout(() => {
      const convs = ctx.world?.conversations || [];
      const existing = convs.find(c =>
        c.type === "direct" && Array.isArray(c.participantIds) &&
        c.participantIds.includes(item?.id)
      );
      if (existing) {
        ctx.navigate("chat_view", { conversationId: existing.id });
      }
    }, 100);
  }
}

/**
 * Группировка intents по иконке: если несколько intents имеют одну иконку,
 * они схлопываются в «группу», которая рендерится как одна кнопка-попап
 * с текстовыми подписями (пользователь не может различить одинаковые
 * иконки без label'ов).
 *
 * Возвращает массив { type: "intent" | "group", spec | specs }.
 */
function groupByIcon(intents) {
  const byIcon = new Map();
  const order = [];
  for (const spec of intents) {
    const key = spec.icon || `__${spec.intentId}__`;
    if (!byIcon.has(key)) {
      byIcon.set(key, []);
      order.push(key);
    }
    byIcon.get(key).push(spec);
  }
  return order.map(key => {
    const specs = byIcon.get(key);
    if (specs.length === 1) return { type: "intent", spec: specs[0] };
    return { type: "group", icon: specs[0].icon, specs };
  });
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
  // Группировка по иконке до применения MAX_VISIBLE — одинаковые иконки
  // превращаются в одну кнопку-группу.
  const grouped = groupByIcon(allIntents);
  const visible = grouped.slice(0, MAX_VISIBLE_ITEM_INTENTS);
  const hidden = grouped.slice(MAX_VISIBLE_ITEM_INTENTS)
    // Overflow всегда содержит плоский список — разворачиваем группы
    .flatMap(g => g.type === "group" ? g.specs : [g.spec]);

  // Chat-вариант: выравнивание «свои справа, чужие слева» по senderId === viewer.id.
  const isChat = node.variant === "chat";
  const isMine = isChat && item?.senderId && ctx.viewer?.id && item.senderId === ctx.viewer.id;

  // Regular-вариант (не чат) — Mantine Paper с hover.
  // Chat-вариант — оставляем inline чтобы сохранить bubble-выравнивание и
  // специфичные цвета "мои"/"чужие" — это семантика, а не стиль.
  const AdaptedPaper = !isChat ? getAdaptedComponent("primitive", "paper") : null;

  const chatStyle = {
    background: isMine
      ? "var(--mantine-color-default-hover)"
      : "var(--mantine-color-default)",
    borderRadius: 12,
    padding: 10,
    border: isMine
      ? "2px solid var(--mantine-color-primary-light-border, var(--mantine-color-indigo-4))"
      : "1px solid var(--mantine-color-default-border)",
    color: "var(--mantine-color-text)",
    maxWidth: "70%",
    alignSelf: isMine ? "flex-end" : "flex-start",
    ...(node.sx || {}),
  };

  const regularFallbackStyle = {
    background: "var(--mantine-color-default)",
    borderRadius: 8, padding: 14,
    border: "1px solid var(--mantine-color-default-border)",
    color: "var(--mantine-color-text)",
    boxShadow: "0 1px 3px #0001",
    ...(node.sx || {}),
  };

  const reactions = item?.id ? (ctx.world?.reactions || []).filter(r => r.messageId === item.id) : [];
  const reactionGroups = reactions.length > 0 ? groupReactions(reactions) : [];

  const content = (
    <>
      {item?.forwarded && (
        <div style={{
          fontSize: 11, color: "var(--mantine-color-dimmed)",
          borderLeft: "2px solid var(--mantine-color-primary-light-border, #6366f1)",
          paddingLeft: 6, marginBottom: 4,
        }}>
          ↗ Переслано от {item.originalSenderName || "неизвестного"}
        </div>
      )}
      {(node.children || []).map((child, i) => (
        <SlotRenderer key={i} item={child} ctx={ctx} contextItem={item} />
      ))}
      {reactionGroups.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
          {reactionGroups.map(g => (
            <span key={g.emoji} style={{
              fontSize: 12, padding: "2px 6px", borderRadius: 10,
              background: "var(--mantine-color-default-hover)",
              border: "1px solid var(--mantine-color-default-border)",
              cursor: "default",
            }}>
              {g.emoji} {g.count > 1 ? g.count : ""}
            </span>
          ))}
        </div>
      )}
      {allIntents.length > 0 && (
        <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          {visible.map((g, gi) => (
            g.type === "group"
              ? <ItemIntentGroup key={`grp_${gi}`} group={g} ctx={ctx} item={item} />
              : <ItemIntentButton key={g.spec.intentId} spec={g.spec} ctx={ctx} item={item} />
          ))}
          {hidden.length > 0 && (
            // Отдельный relative-контейнер, чтобы popover позиционировался
            // относительно самой кнопки «⋯», а не всего flex-row карточки.
            <div style={{ position: "relative" }}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
                style={{
                  padding: "4px 8px", borderRadius: 6,
                  border: "1px solid var(--mantine-color-default-border)",
                  background: "var(--mantine-color-default)",
                  color: "var(--mantine-color-dimmed)",
                  fontSize: 11, cursor: "pointer", lineHeight: 1,
                }}
              >⋯</button>
              {menuOpen && (
                <div
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); }}
                  style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0,
                    background: "var(--mantine-color-body)",
                    border: "1px solid var(--mantine-color-default-border)",
                    borderRadius: 8,
                    boxShadow: "0 4px 12px #0002", padding: 4, zIndex: 10, minWidth: 180,
                    maxHeight: "50vh", overflowY: "auto",
                    color: "var(--mantine-color-text)",
                  }}
                >
                  {hidden.map(spec => (
                    <button
                      key={spec.intentId}
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); fireItemIntent(spec, ctx, item); }}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        width: "100%", textAlign: "left",
                        padding: "6px 10px", background: "transparent", border: "none",
                        cursor: "pointer", fontSize: 12,
                      }}
                    >
                      {spec.icon && <Icon emoji={spec.icon} size={14} />}
                      <span>{spec.label || spec.intentId}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );

  // Финальная обёртка: Mantine Paper (regular) или inline div (chat).
  if (isChat) {
    return <div style={chatStyle}>{content}</div>;
  }
  if (AdaptedPaper) {
    return (
      <AdaptedPaper padding="md">
        {content}
      </AdaptedPaper>
    );
  }
  return <div style={regularFallbackStyle}>{content}</div>;
}

function ItemIntentGroup({ group, ctx, item }) {
  const [open, setOpen] = useState(false);
  const icon = group.icon;
  const count = group.specs.length;

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        title={group.specs.map(s => s.label || s.intentId).join(", ")}
        style={{
          padding: "6px 8px", borderRadius: 6,
          border: "1px solid var(--mantine-color-default-border)",
          background: "var(--mantine-color-default)",
          color: "var(--mantine-color-text)",
          fontSize: 11, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 4,
          lineHeight: 1,
        }}
      >
        <Icon emoji={icon} size={14} />
        <span style={{ fontSize: 9, color: "var(--mantine-color-dimmed)" }}>×{count}</span>
      </button>
      {open && (
        <div
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0,
            background: "var(--mantine-color-body)",
            border: "1px solid var(--mantine-color-default-border)",
            borderRadius: 8,
            boxShadow: "0 4px 12px #0002", padding: 4, zIndex: 10, minWidth: 180,
          }}
        >
          {group.specs.map(spec => (
            <button
              key={spec.intentId}
              onClick={(e) => { e.stopPropagation(); setOpen(false); fireItemIntent(spec, ctx, item); }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                width: "100%", textAlign: "left",
                padding: "6px 10px", background: "transparent", border: "none",
                cursor: "pointer", fontSize: 12,
                color: "var(--mantine-color-text)",
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--mantine-color-default-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {spec.icon && <Icon emoji={spec.icon} size={14} />}
              <span>{spec.label || spec.intentId}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ItemIntentButton({ spec, ctx, item }) {
  // Делегируем адаптеру — тот же MantineIntentButton, что в toolbar.
  // Этот путь используется для per-item кнопок в Card (list items).
  const AdaptedIntent = getAdaptedComponent("button", "intent");
  const onClick = (e) => {
    e.stopPropagation();
    fireItemIntent(spec, ctx, item);
  };

  if (AdaptedIntent) {
    return <AdaptedIntent spec={spec} onClick={onClick} />;
  }

  // Fallback — inline button с CSS variables.
  const label = spec.label || spec.intentId;
  const icon = spec.icon;
  const LABEL_MAX = 8;
  const showLabel = label.length <= LABEL_MAX;

  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        padding: showLabel ? "4px 8px" : "6px 8px",
        borderRadius: 6,
        border: "1px solid var(--mantine-color-default-border)",
        background: "var(--mantine-color-default)",
        color: "var(--mantine-color-text)",
        fontSize: 11,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        lineHeight: 1,
      }}
    >
      {icon && <Icon emoji={icon} size={13} />}
      {showLabel && <span>{label}</span>}
    </button>
  );
}

export function List({ node, ctx }) {
  const source = node.source ? resolve(ctx.world, node.source) : [];
  let items = Array.isArray(source) ? [...source] : [];

  if (node.filter) {
    items = items.filter(it => evalCondition(node.filter, {
      ...it, item: it, viewer: ctx.viewer, world: ctx.world,
      viewState: ctx.viewState || {},
    }));
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

  const isGrid = node.layout === "grid";

  const containerStyle = isGrid
    ? {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: node.gap || 12,
        ...(node.sx || {}),
      }
    : {
        display: "flex", flexDirection: "column",
        gap: node.gap || 6,
        ...(bottomUp ? { minHeight: "100%", justifyContent: "flex-end" } : {}),
        ...(node.sx || {}),
      };

  return (
    <div ref={scrollRef} style={containerStyle}>
      {items.map((item, i) => {
        const content = isGrid
          ? <GridCard item={item} node={node} ctx={ctx} />
          : <SlotRenderer item={node.item} ctx={ctx} contextItem={item} />;
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

function GridCard({ item, node, ctx }) {
  const title = item.title || item.name || item.id;
  const rawImage = item.images || item.image || item.avatar;
  const image = Array.isArray(rawImage) ? rawImage[0] : rawImage;
  const price = item.currentPrice ?? item.price ?? item.startPrice;
  const subtitle = item.condition || item.status || "";
  const location = item.shippingFrom || item.location || "";

  return (
    <div style={{
      borderRadius: 10,
      border: "1px solid var(--mantine-color-default-border)",
      background: "var(--mantine-color-default)",
      overflow: "hidden",
      display: "flex", flexDirection: "column",
      cursor: node.onItemClick ? "pointer" : "default",
    }}>
      <div style={{
        height: 160, background: "var(--mantine-color-default-hover)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", position: "relative",
      }}>
        {image && typeof image === "string" && image.startsWith("data:") ? (
          <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontSize: 48, opacity: 0.15 }}>📦</span>
        )}
        {price != null && (
          <span style={{
            position: "absolute", bottom: 8, right: 8,
            background: "var(--mantine-color-body)", color: "var(--mantine-color-text)",
            padding: "3px 8px", borderRadius: 6, fontSize: 13, fontWeight: 700,
            boxShadow: "0 1px 4px #0002",
          }}>
            {typeof price === "number" ? price.toLocaleString("ru") + " ₽" : price}
          </span>
        )}
      </div>
      <div style={{ padding: "8px 10px", flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{
          fontSize: 13, fontWeight: 600, color: "var(--mantine-color-text)",
          overflow: "hidden", textOverflow: "ellipsis",
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>{title}</div>
        {(subtitle || location) && (
          <div style={{ fontSize: 11, color: "var(--mantine-color-dimmed)" }}>
            {subtitle}{subtitle && location ? " · " : ""}{location}
          </div>
        )}
      </div>
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
