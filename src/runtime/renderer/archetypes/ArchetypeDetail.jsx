import { useMemo, useState, useCallback } from "react";
import SlotRenderer from "../SlotRenderer.jsx";
import OverlayManager, { useOverlayManager } from "../controls/OverlayManager.jsx";
import SubCollectionSection from "./SubCollectionSection.jsx";
import ProgressWidget from "./ProgressWidget.jsx";
import InlineSetter from "./InlineSetter.jsx";
import VoterSelector from "./VoterSelector.jsx";
import { evalIntentCondition } from "../eval.js";
import { getAdaptedComponent } from "../adapters/registry.js";
import Icon from "../adapters/Icon.jsx";

/**
 * Detail-архетип: показывает одну сущность по mainEntity+idParam из routeParams.
 * Body рендерится с contextItem = target — все bind'ы резолвятся без префикса.
 */
export default function ArchetypeDetail({ slots, nav, ctx: parentCtx, projection }) {
  const { activeKey, activeContext, openOverlay, closeOverlay, overlayMap } = useOverlayManager(slots.overlay);

  // viewState — параметры запроса проекции (§5 манифеста v1.1+). Здесь
  // используется voterSelector'ом (stateKey → participantId) и потенциально
  // любым будущим view-filter в detail-архетипе.
  const [viewState, setViewStateRaw] = useState({});
  const setViewState = useCallback((key, val) => {
    setViewStateRaw(prev => {
      if (prev[key] === val) return prev;
      return { ...prev, [key]: val };
    });
  }, []);

  const ctx = useMemo(() => ({
    ...parentCtx,
    openOverlay,
    viewState,
    setViewState,
  }), [parentCtx, openOverlay, viewState, setViewState]);

  // Ownership check: editEdge показываем только если viewer владеет
  // сущностью. Кристаллизатор уже генерирует toolbar-conditions через
  // ownershipConditionFor (из ontology.ownerField). Эта проверка —
  // дублирующая защита для edit-button'а.
  const isViewerOwner = (target) => {
    if (!target || !parentCtx.viewer?.id) return false;
    // Если в target есть поле, совпадающее с viewer.id — owner
    // Порядок проверки: clientId, organizerId, userId, authorId, id
    const ownerFields = ["clientId", "organizerId", "userId", "authorId", "id"];
    for (const field of ownerFields) {
      if (target[field] === parentCtx.viewer.id) return true;
    }
    return false;
  };

  // Edit-action edge: если в nav есть исходящее ребро kind:"edit-action",
  // показываем кнопку «Редактировать» в header, которая навигирует в form-проекцию.
  const editEdge = (nav?.outgoing || []).find(e => e.kind === "edit-action");
  const onEditClick = () => {
    if (!editEdge || !parentCtx.navigate) return;
    // params могут содержать "routeParams.userId" — разрешить
    const resolvedParams = {};
    for (const [k, v] of Object.entries(editEdge.params || {})) {
      if (typeof v === "string" && v.startsWith("routeParams.")) {
        resolvedParams[k] = parentCtx.routeParams?.[v.slice("routeParams.".length)];
      } else {
        resolvedParams[k] = v;
      }
    }
    parentCtx.navigate(editEdge.to, resolvedParams);
  };

  const target = useMemo(() => {
    const mainEntity = projection?.mainEntity;
    const idParam = projection?.idParam;
    if (!mainEntity || !idParam) return null;
    const collection = pluralize(mainEntity.toLowerCase());
    const list = parentCtx.world?.[collection] || [];
    const id = parentCtx.routeParams?.[idParam];
    if (!id) return null;
    return list.find(e => e.id === id) || null;
  }, [projection, parentCtx.world, parentCtx.routeParams]);

  if (!target) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        Сущность не найдена: {projection?.mainEntity} id={parentCtx.routeParams?.[projection?.idParam]}
      </div>
    );
  }

  const canEdit = editEdge && isViewerOwner(target);

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "var(--mantine-color-body)",
    }}>
      {(slots.header?.length > 0 || canEdit) && (
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px",
          background: "var(--mantine-color-default)",
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}>
          <SlotRenderer items={slots.header} ctx={ctx} contextItem={target} />
          <div style={{ flex: 1 }} />
          {canEdit && (
            <button
              onClick={onEditClick}
              title="Редактировать"
              style={{
                padding: "6px 14px", borderRadius: 6, border: "1px solid #6366f1",
                background: "#eef2ff", color: "#6366f1", fontSize: 13,
                fontWeight: 600, cursor: "pointer",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}
            >
              <span>✎</span>
              <span>Редактировать</span>
            </button>
          )}
        </div>
      )}

      {slots.toolbar?.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "8px 16px",
          background: "var(--mantine-color-default)",
          borderBottom: "1px solid var(--mantine-color-default-border)",
          flexWrap: "wrap",
        }}>
          <SlotRenderer items={slots.toolbar} ctx={ctx} contextItem={target} />
        </div>
      )}

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{ maxWidth: 640, margin: "0 auto", display: "flex", flexDirection: "column", gap: 16 }}>
          <PaperSection>
            <SlotRenderer item={slots.body} ctx={ctx} contextItem={target} />
          </PaperSection>

          {/* Voter identity selector (закрытие §23 для planning-домена).
              View-state «Голосовать как: X» — выбор participant'а, от имени
              которого будут отправляться vote_*-интенты из voteGroup. */}
          {slots.voterSelector && (
            <VoterSelector spec={slots.voterSelector} target={target} ctx={ctx} />
          )}

          {/* Sub-collection секции (M4 step B). Каждая секция — блок с заголовком,
              inline-композером добавления (если разрешён в текущей фазе) и
              списком items с per-item кнопками. */}
          {(slots.sections || []).map(section => (
            <SubCollectionSection
              key={section.id}
              section={section}
              target={target}
              ctx={ctx}
            />
          ))}

          {/* Progress widget (M4 step E): декларативный прогресс из
              projection.progress, рантайм вычисляет значения из world. */}
          {slots.progress && (
            <ProgressWidget spec={slots.progress} target={target} ctx={ctx} />
          )}

          {/* Footer inline-setters (M4 step F): single-param intents как
              set_deadline в формате «label: [input] Установить». */}
          {(slots.footer || []).length > 0 && (
            <FooterList items={slots.footer} target={target} ctx={ctx} />
          )}

          {/* Primary CTA (M4 step C): phase-changing intents как большие
              primary-кнопки. Фильтруются через evalIntentCondition — в
              неподходящей фазе кнопка не показывается. */}
          <PrimaryCTAList items={slots.primaryCTA || []} target={target} ctx={ctx} />
        </div>
      </div>

      <OverlayManager
        activeKey={activeKey}
        activeContext={activeContext}
        overlayMap={overlayMap}
        onClose={closeOverlay}
        ctx={ctx}
      />
    </div>
  );
}

function pluralize(word) {
  if (!word) return word;
  if (word.endsWith("y")) return word.slice(0, -1) + "ies";
  if (word.endsWith("s")) return word + "es";
  return word + "s";
}

/**
 * PaperSection — унифицированная карточка-обёртка для detail-секций.
 * Использует Mantine Paper через адаптер; fallback — inline white-card.
 */
function PaperSection({ children, padding }) {
  const AdaptedPaper = getAdaptedComponent("primitive", "paper");
  if (AdaptedPaper) {
    return <AdaptedPaper padding={padding ?? "lg"}>{children}</AdaptedPaper>;
  }
  return (
    <div style={{
      background: "#fff",
      borderRadius: 12, padding: 24, border: "1px solid #e5e7eb",
    }}>
      {children}
    </div>
  );
}

function FooterList({ items, target, ctx }) {
  const visible = items.filter(spec => {
    const conds = spec.conditions || [];
    return conds.every(c => evalIntentCondition(c, target, ctx.viewer));
  });
  if (visible.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {visible.map(spec => (
        <InlineSetter key={spec.intentId} spec={spec} target={target} ctx={ctx} />
      ))}
    </div>
  );
}

function PrimaryCTAList({ items, target, ctx }) {
  const visible = items.filter(spec => {
    const conds = spec.conditions || [];
    return conds.every(c => evalIntentCondition(c, target, ctx.viewer));
  });
  if (visible.length === 0) return null;

  const AdaptedPrimary = getAdaptedComponent("button", "primary");

  return (
    <PaperSection padding="md">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {visible.map(spec => {
        const onClick = () => ctx.exec(spec.intentId, { id: target.id });
        if (AdaptedPrimary) {
          return (
            <AdaptedPrimary
              key={spec.intentId}
              label={spec.label}
              icon={spec.icon}
              onClick={onClick}
              size="md"
            />
          );
        }
        return (
          <button
            key={spec.intentId}
            onClick={onClick}
            style={{
              padding: "14px 18px",
              borderRadius: 10,
              border: "none",
              background: "#6366f1",
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontFamily: "inherit",
            }}
          >
            {spec.icon && <Icon emoji={spec.icon} size={18} />}
            <span>{spec.label}</span>
          </button>
        );
      })}
      </div>
    </PaperSection>
  );
}
