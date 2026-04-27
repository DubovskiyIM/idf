/**
 * BlockCanvas — host wrapper для notion-домена (§12.10).
 *
 * Связывает domain-shape блоков (text/position/parentBlockId/heading_1)
 * с editor-contract'ом (content/order/parentId/heading-1) и эмитит
 * intents через exec при правках. Делегирует на `<BlockEditor>` из
 * `@intent-driven/renderer`, который резолвит реализацию через
 * `adapter.capabilities.primitive.blockEditor`.
 *
 * Если в bootstrap'е приложения вызвали
 * `applyTiptapBlockEditor(antdAdapter)` — рендерится Tiptap-impl с
 * inline-formatting; иначе reference textarea-impl (capability flags
 * меняются, contract не меняется).
 */

import { useMemo, useCallback } from "react";
import { BlockEditor } from "@intent-driven/renderer";

// Маппинг domain.kind ↔ editor.kind (BlockEditor capability оперирует
// канонической формой с дефисами).
const DOMAIN_TO_EDITOR_KIND = {
  paragraph: "paragraph",
  heading_1: "heading-1",
  heading_2: "heading-2",
  heading_3: "heading-3",
  bulleted_list: "bulleted-list-item",
  numbered_list: "numbered-list-item",
  todo: "to-do",
  toggle: "toggle",
  quote: "quote",
  callout: "callout",
  code: "code",
  divider: "divider",
  image: "image",
  bookmark: "bookmark",
};

const EDITOR_TO_DOMAIN_KIND = Object.fromEntries(
  Object.entries(DOMAIN_TO_EDITOR_KIND).map(([d, e]) => [e, d])
);

export { DOMAIN_TO_EDITOR_KIND, EDITOR_TO_DOMAIN_KIND };

export function toEditorBlock(b) {
  return {
    id: b.id,
    parentId: b.parentBlockId || null,
    order: typeof b.position === "number" ? b.position : 0,
    kind: DOMAIN_TO_EDITOR_KIND[b.kind] || b.kind || "paragraph",
    content: b.text || "",
    props: {
      checked: b.checked,
      language: b.language,
      emoji: b.emoji,
      color: b.color,
    },
  };
}

export default function BlockCanvas({ world, exec, viewer, ctx }) {
  const pageId = ctx?.routeParams?.pageId;
  const allBlocks = world?.blocks || [];

  const editorBlocks = useMemo(
    () => allBlocks
      .filter(b => b.pageId === pageId)
      .map(toEditorBlock),
    [allBlocks, pageId]
  );

  // editor → domain handlers (см. notion/intents.js)
  const handleChange = useCallback((blockId, patch) => {
    if (typeof patch?.content === "string" && exec) {
      exec("update_block_content", { id: blockId, text: patch.content });
    }
  }, [exec]);

  const handleKindChange = useCallback((blockId, nextKind) => {
    const domainKind = EDITOR_TO_DOMAIN_KIND[nextKind] || nextKind;
    if (exec) exec("change_block_kind", { id: blockId, kind: domainKind });
  }, [exec]);

  // Add-block inline: вызываем notion intent add_block с auto-incremented
  // position. Tiptap-обёртка в дальнейшем сможет дернуть это через slash-меню.
  const handleAddBlock = useCallback((kind = "paragraph") => {
    if (!exec || !pageId) return;
    const nextPos = editorBlocks.length;
    exec("add_block", { pageId, kind, text: "", position: nextPos });
  }, [exec, pageId, editorBlocks.length]);

  if (!pageId) {
    return (
      <div style={{ padding: 24, color: "var(--idf-text-muted, #6b7280)" }}>
        Страница не выбрана — pageId отсутствует в routeParams.
      </div>
    );
  }

  const canEdit = !!viewer?.canEdit || true; // notion: viewer без canEdit для editor роли — fallback open
  const isEmpty = editorBlocks.length === 0;

  return (
    <div style={{ padding: "16px 24px", maxWidth: 920, margin: "0 auto" }}>
      <BlockEditor
        blocks={editorBlocks}
        onChange={handleChange}
        onKindChange={handleKindChange}
        readOnly={!canEdit}
        placeholder="Страница пуста — добавьте блок"
      />
      {canEdit && (
        <div style={{
          display: "flex",
          gap: 6,
          marginTop: isEmpty ? 0 : 12,
          paddingTop: isEmpty ? 0 : 8,
          borderTop: isEmpty ? "none" : "1px dashed var(--idf-border, #e5e7eb)",
        }}>
          <AddBlockBtn label="+ Параграф" onClick={() => handleAddBlock("paragraph")} />
          <AddBlockBtn label="+ H2" onClick={() => handleAddBlock("heading_2")} />
          <AddBlockBtn label="+ Список" onClick={() => handleAddBlock("bulleted_list")} />
          <AddBlockBtn label="+ Todo" onClick={() => handleAddBlock("todo")} />
          <AddBlockBtn label="+ Code" onClick={() => handleAddBlock("code")} />
          <AddBlockBtn label="+ Цитата" onClick={() => handleAddBlock("quote")} />
        </div>
      )}
    </div>
  );
}

function AddBlockBtn({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "var(--idf-surface, transparent)",
        border: "1px solid var(--idf-border, #d9d9d9)",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 12,
        color: "var(--idf-text-muted, #6b7280)",
        cursor: "pointer",
        fontFamily: "var(--idf-font, system-ui)",
      }}
    >{label}</button>
  );
}
