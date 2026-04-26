/**
 * BlockCanvas — host wrapper для notion-домена (§12.10).
 *
 * Связывает domain-shape блоков (text/position/parentBlockId/heading_1)
 * с editor-contract'ом (content/order/parentId/heading-1) и эмитит
 * intents через exec при правках.
 *
 * Резолвинг рендера двухступенчатый:
 *   (1) `@intent-driven/renderer` экспортирует `BlockEditor` (idf-sdk PR #359
 *       merged + renderer ≥0.55 опубликован) — используем его, он сам ходит
 *       за `adapter.capabilities.primitive.blockEditor`.
 *   (2) Иначе — inline read-only fallback (структурный список + kind-метки).
 *
 * Динамический import убирается по мере появления BlockEditor в bundled
 * renderer'е; до этого момента host PR можно мержить независимо от SDK.
 */

import { useMemo, useCallback } from "react";
import * as RendererPkg from "@intent-driven/renderer";

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

const KIND_LABELS = {
  paragraph: "P",
  "heading-1": "H1",
  "heading-2": "H2",
  "heading-3": "H3",
  "bulleted-list-item": "•",
  "numbered-list-item": "1.",
  "to-do": "☐",
  toggle: "▸",
  quote: "❝",
  callout: "ℹ",
  divider: "—",
  code: "</>",
  image: "🖼",
  bookmark: "🔖",
};

function InlineBlockFallback({ blocks, placeholder = "Блоков нет" }) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return (
      <div style={{ padding: "24px 16px", color: "#6b7280", fontStyle: "italic", textAlign: "center" }}>
        {placeholder}
      </div>
    );
  }
  const sorted = blocks.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return (
    <div style={{ fontFamily: "var(--idf-font, system-ui)", lineHeight: 1.5 }}>
      {sorted.map(b => {
        const isHeading = typeof b.kind === "string" && b.kind.startsWith("heading-");
        if (b.kind === "divider") {
          return <hr key={b.id} style={{ border: 0, borderTop: "1px solid #e5e7eb", margin: "12px 0" }} />;
        }
        return (
          <div key={b.id} style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "4px 0",
            fontSize: isHeading ? 18 : 14,
            fontWeight: isHeading ? 600 : 400,
          }}>
            <span style={{
              flexShrink: 0, width: 24, fontFamily: "ui-monospace, monospace",
              fontSize: 11, color: "#6b7280", textAlign: "center",
            }}>{KIND_LABELS[b.kind] || b.kind || "?"}</span>
            <span style={{ flex: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {b.content || <span style={{ color: "#9ca3af", fontStyle: "italic" }}>пусто</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
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

  // Resolve BlockEditor lazy: появляется в renderer ≥0.55 после релиза idf-sdk PR #359.
  // До тех пор — inline read-only fallback, чтобы host build не падал.
  const RendererBlockEditor = RendererPkg.BlockEditor;

  return (
    <div style={{ padding: "16px 24px", maxWidth: 920, margin: "0 auto" }}>
      {RendererBlockEditor ? (
        <RendererBlockEditor
          blocks={editorBlocks}
          onChange={handleChange}
          onKindChange={handleKindChange}
          readOnly={!viewer?.canEdit}
          placeholder="Страница пуста — добавьте блок"
        />
      ) : (
        <InlineBlockFallback blocks={editorBlocks} placeholder="Страница пуста — добавьте блок" />
      )}
    </div>
  );
}
