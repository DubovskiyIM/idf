import { registerCaptureWidget } from "./registry.js";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉", "👎", "💯"];

/**
 * EmojiPicker — grid эмодзи в оверлее. Клик передаёт emoji + id целевой
 * сущности (из overlayContext.item) в intent. Id проекции приходит в
 * ctx.routeParams — но для react_to_message нужен message.id, и он берётся
 * из item (контекстная сущность из feed'а).
 *
 * Match: intents с id начинающимся с "react_" или с witness "available_reactions".
 */
export default function EmojiPicker({ spec, ctx, onClose, overlayContext }) {
  const item = overlayContext?.item;

  const pick = (emoji) => {
    const payload = { emoji };
    if (item?.id) payload.id = item.id;
    ctx.exec(spec.intentId, payload);
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--mantine-color-dimmed)", marginBottom: 12 }}>
          Реакция
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxWidth: 320 }}>
          {EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => pick(emoji)}
              style={{
                fontSize: 28, padding: "6px 10px", background: "transparent",
                border: "none", cursor: "pointer", borderRadius: 8,
                lineHeight: 1,
              }}
              onMouseEnter={e => e.currentTarget.style.background = "var(--mantine-color-default-hover)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const overlayStyle = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};

const modalStyle = {
  background: "var(--mantine-color-body)", borderRadius: 12, padding: 16,
  fontFamily: "system-ui, sans-serif",
  boxShadow: "0 10px 40px rgba(0,0,0,0.15)",
};

registerCaptureWidget({
  id: "emojiPicker",
  match: (intent, intentId) =>
    intentId.startsWith("react_") ||
    (intent.particles?.witnesses || []).includes("available_reactions"),
  component: EmojiPicker,
});
