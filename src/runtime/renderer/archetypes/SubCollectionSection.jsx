import { useMemo, useState } from "react";
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
  const { title, source, foreignKey, itemView, itemIntents, addControl, emptyLabel, editableFields } = section;

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

  // Пустая секция без возможности добавления — не показываем
  if (items.length === 0 && !canAdd) return null;

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
              editableFields={editableFields}
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

function SubCollectionItem({ item, itemView, itemIntents, ctx, target, editableFields }) {
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState({});

  // Фильтруем per-item кнопки по conditions
  const passConds = (conds) =>
    (conds || []).every(c =>
      evalIntentCondition(c, item, ctx.viewer) ||
      evalIntentCondition(c, target, ctx.viewer)
    );

  const visibleIntents = itemIntents.filter(spec => passConds(spec.conditions));

  const fireIntent = (spec) => {
    ctx.exec(spec.intentId, { id: item.id });
  };

  const startEdit = () => {
    const vals = {};
    for (const f of (editableFields || [])) vals[f] = item[f] || "";
    setEditValues(vals);
    setEditing(true);
  };

  const saveEdit = () => {
    for (const [field, value] of Object.entries(editValues)) {
      if (value !== item[field]) {
        // Ищем replace-intent для этого поля среди itemIntents
        const replaceSpec = itemIntents.find(s => s.intentId?.includes("edit") || s.intentId?.includes("rename") || s.intentId?.includes("update"));
        if (replaceSpec) {
          ctx.exec(replaceSpec.intentId, { id: item.id, [field]: value });
        }
      }
    }
    setEditing(false);
  };

  const canEdit = editableFields && editableFields.length > 0 && visibleIntents.length > 0;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 14px",
      background: "var(--mantine-color-default-hover)",
      border: `1px solid ${editing ? "var(--mantine-color-primary, #6366f1)" : "var(--mantine-color-default-border)"}`,
      borderRadius: 8,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {editableFields.map(field => (
              <input
                key={field}
                value={editValues[field] || ""}
                onChange={e => setEditValues(prev => ({ ...prev, [field]: e.target.value }))}
                placeholder={field}
                style={{
                  padding: "4px 8px", borderRadius: 4, fontSize: 13,
                  border: "1px solid var(--mantine-color-default-border)",
                  background: "var(--mantine-color-body)",
                  color: "var(--mantine-color-text)",
                  outline: "none",
                }}
                onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditing(false); }}
                autoFocus
              />
            ))}
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={saveEdit} style={miniBtn}>Сохранить</button>
              <button onClick={() => setEditing(false)} style={{ ...miniBtn, color: "var(--mantine-color-dimmed)" }}>Отмена</button>
            </div>
          </div>
        ) : (
          <SlotRenderer item={itemView} ctx={ctx} contextItem={item} />
        )}
      </div>
      {!editing && (
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {canEdit && (
            <button
              onClick={startEdit}
              title="Редактировать"
              style={actionBtn}
            >
              <Icon emoji="✎" size={14} />
            </button>
          )}
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
                style={actionBtn}
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

const actionBtn = {
  padding: "6px 10px", borderRadius: 6,
  border: "1px solid var(--mantine-color-default-border)",
  background: "var(--mantine-color-default)",
  cursor: "pointer", fontSize: 12,
  display: "inline-flex", alignItems: "center", gap: 4,
};

const miniBtn = {
  padding: "3px 10px", borderRadius: 4, border: "none",
  background: "var(--mantine-color-primary, #6366f1)", color: "#fff",
  cursor: "pointer", fontSize: 11,
};

/**
 * VoteGroup — рендер взаимоисключающих creator-intents как группы цветных
 * кнопок (зелёный/жёлтый/красный). Фильтрует каждую опцию по её conditions
 * (если они различались между intents группы — кристаллизатор записал их
 * per-option, иначе null).
 *
 * Voter identity: vote-интенты ожидают `participantId` (см. §23 манифеста).
 * VoteGroup читает его из ctx.viewState.voterParticipantId, заполняемого
 * VoterSelector'ом поверх detail-проекции. Если participantId не выбран —
 * кнопки дизэйблятся с tooltip'ом. `optionId` берётся из item.id (каждая
 * VoteGroup рендерится внутри строки TimeOption).
 */
function VoteGroup({ group, item, ctx, passConds }) {
  const options = group.options.filter(opt =>
    opt.conditions == null || passConds(opt.conditions)
  );
  if (options.length === 0) return null;

  const participantId = ctx.viewState?.voterParticipantId || "";
  const disabled = !participantId;
  const disabledTitle = "Выберите участника в селекторе «Голосовать как»";

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map(opt => (
        <button
          key={opt.intentId}
          disabled={disabled}
          onClick={() => ctx.exec(opt.intentId, { optionId: item.id, participantId })}
          title={disabled ? disabledTitle : opt.label}
          style={{
            padding: "8px 14px",
            borderRadius: 6,
            border: "none",
            background: opt.style.bg,
            color: opt.style.color,
            cursor: disabled ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "inherit",
            opacity: disabled ? 0.4 : 1,
          }}
          onMouseEnter={e => {
            if (!disabled) e.currentTarget.style.background = opt.style.bgHover;
          }}
          onMouseLeave={e => {
            if (!disabled) e.currentTarget.style.background = opt.style.bg;
          }}
        >
          {opt.style.icon && <Icon emoji={opt.style.icon} size={14} />}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}
