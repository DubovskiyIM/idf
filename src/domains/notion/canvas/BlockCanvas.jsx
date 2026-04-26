/**
 * BlockCanvas — host wrapper над renderer.BlockEditor для notion-домена.
 *
 * Связывает domain-shape блоков (text/position/parentBlockId/heading_1)
 * с editor-contract'ом (content/order/parentId/heading-1) и эмитит
 * intents через exec при правках. Если адаптер декларирует
 * capabilities.primitive.blockEditor — рендерится adapter-component
 * (reference impl AntD: textarea + Select для kind). Иначе — read-only
 * структурный fallback из renderer.
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

  if (!pageId) {
    return (
      <div style={{ padding: 24, color: "var(--idf-text-muted, #6b7280)" }}>
        Страница не выбрана — pageId отсутствует в routeParams.
      </div>
    );
  }

  return (
    <div style={{ padding: "16px 24px", maxWidth: 920, margin: "0 auto" }}>
      <BlockEditor
        blocks={editorBlocks}
        onChange={handleChange}
        onKindChange={handleKindChange}
        readOnly={!viewer?.canEdit}
        placeholder="Страница пуста — добавьте блок"
      />
    </div>
  );
}
