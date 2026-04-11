import { useMemo } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import SubCollectionAdd from "../controls/SubCollectionAdd.jsx";
import { evalIntentCondition } from "../eval.js";
import Icon from "../adapters/Icon.jsx";
import { getAdaptedComponent } from "../adapters/registry.js";

/**
 * SubCollectionSection — секция связанной коллекции в detail-проекции.
 *
 * Рендерит:
 *   - Заголовок + счётчик элементов
 *   - Inline-композер для добавления (если conditions addControl разрешают
 *     текущую фазу target)
 *   - Список элементов с bind-view и per-item кнопками
 *   - Пустое состояние с текстом
 *
 * Phase-фильтрация: addControl и item intents проверяют
 * evalIntentCondition(cond, target, viewer) — условия вида `poll.status = 'draft'`
 * автоматически отключают UI в чужой фазе.
 */
export default function SubCollectionSection({ section, target, ctx }) {
  const { title, source, foreignKey, itemView, itemIntents, addControl, emptyLabel } = section;

  // Фильтруем коллекцию по foreignKey === target.id
  const items = useMemo(() => {
    const all = ctx.world?.[source] || [];
    if (!foreignKey || !target?.id) return all;
    return all.filter(it => it[foreignKey] === target.id);
  }, [ctx.world, source, foreignKey, target]);

  // AddControl виден только когда его conditions истинны против target
  const canAdd = useMemo(() => {
    if (!addControl) return false;
    const conds = addControl.conditions || [];
    return conds.every(c => evalIntentCondition(c, target, ctx.viewer));
  }, [addControl, target, ctx.viewer]);

  const AdaptedPaper = getAdaptedComponent("primitive", "paper");
  const Wrapper = AdaptedPaper || FallbackPaper;

  return (
    <Wrapper padding="lg">
      {/* Заголовок */}
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: "var(--mantine-color-dimmed)",
        marginBottom: 12,
      }}>
        {title} ({items.length})
      </div>

      {/* Inline-композер для добавления */}
      {canAdd && (
        <SubCollectionAdd spec={addControl} ctx={ctx} target={target} />
      )}

      {/* Список элементов */}
      {items.length === 0 && !canAdd && (
        <div style={{ color: "var(--mantine-color-dimmed)", fontSize: 13, textAlign: "center", padding: 12 }}>
          {emptyLabel || "Пусто"}
        </div>
      )}

      {items.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: canAdd ? 12 : 0 }}>
          {items.map(item => (
            <SubCollectionItem
              key={item.id}
              item={item}
              itemView={itemView}
              itemIntents={itemIntents || []}
              ctx={ctx}
              target={target}
            />
          ))}
        </div>
      )}
    </Wrapper>
  );
}

// Fallback когда адаптер не задан
function FallbackPaper({ children }) {
  return (
    <div style={{
      background: "var(--mantine-color-default)",
      borderRadius: 12,
      padding: 20,
      border: "1px solid var(--mantine-color-default-border)",
    }}>
      {children}
    </div>
  );
}

function SubCollectionItem({ item, itemView, itemIntents, ctx, target }) {
  // Фильтруем per-item кнопки по conditions: поддержку двух доменов условий —
  // относительно item И относительно target (для phase-aware проверок).
  const passConds = (conds) =>
    (conds || []).every(c =>
      evalIntentCondition(c, item, ctx.viewer) ||
      evalIntentCondition(c, target, ctx.viewer)
    );

  const visibleIntents = itemIntents.filter(spec => passConds(spec.conditions));

  const fireIntent = (spec) => {
    ctx.exec(spec.intentId, { id: item.id });
  };

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 14px",
      background: "var(--mantine-color-default-hover)",
      border: "1px solid var(--mantine-color-default-border)",
      borderRadius: 8,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <SlotRenderer item={itemView} ctx={ctx} contextItem={item} />
      </div>
      {visibleIntents.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {visibleIntents.map((spec, i) => {
            if (spec.type === "voteGroup") {
              return (
                <VoteGroup
                  key={`grp_${spec.intentGroup}_${i}`}
                  group={spec}
                  item={item}
                  ctx={ctx}
                  passConds={passConds}
                />
              );
            }
            return (
              <button
                key={spec.intentId}
                onClick={() => fireIntent(spec)}
                title={spec.label}
                style={{
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #d1d5db",
                  background: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {spec.icon && <Icon emoji={spec.icon} size={14} />}
                <span>{spec.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * VoteGroup — рендер взаимоисключающих creator-intents как группы цветных
 * кнопок (зелёный/жёлтый/красный). Фильтрует каждую опцию по её conditions
 * (если они различались между intents группы — кристаллизатор записал их
 * per-option, иначе null).
 */
function VoteGroup({ group, item, ctx, passConds }) {
  const options = group.options.filter(opt =>
    opt.conditions == null || passConds(opt.conditions)
  );
  if (options.length === 0) return null;

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map(opt => (
        <button
          key={opt.intentId}
          onClick={() => ctx.exec(opt.intentId, { id: item.id })}
          title={opt.label}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: opt.style.bg,
            color: opt.style.color,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "inherit",
          }}
          onMouseEnter={e => e.currentTarget.style.background = opt.style.bgHover}
          onMouseLeave={e => e.currentTarget.style.background = opt.style.bg}
        >
          {opt.style.icon && <Icon emoji={opt.style.icon} size={14} />}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
