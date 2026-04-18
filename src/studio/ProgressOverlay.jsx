import React from "react";
import { AnimatePresence, motion } from "framer-motion";

// Маппинг имён инструментов на дружелюбные action-глаголы.
const TOOL_VERB = {
  Read: "Читаю",
  Write: "Пишу",
  Edit: "Правлю",
  Glob: "Ищу файлы",
  Grep: "Ищу в коде",
  Bash: "Запускаю",
};

function describeTool(tool) {
  if (!tool) return null;
  const verb = TOOL_VERB[tool.name] || tool.name;
  const input = tool.input || {};
  const target = input.file_path || input.path || input.pattern || input.command || "";
  const short = target
    ? target.replace(/^.*\/src\/domains\//, "src/domains/").slice(-48)
    : "";
  return short ? `${verb} ${short}` : verb;
}

/**
 * ProgressOverlay — видим только во время активной генерации Claude'ом.
 * Крепится top-right поверх Graph3D. Показывает:
 *   - счётчик tool-calls (n совершено)
 *   - последний tool_use («Пишу src/domains/X/intents.js»)
 *   - общую фразу («Claude создаёт намерения…»)
 */
export default function ProgressOverlay({ busy, toolCount, lastTool, phase }) {
  const verbLine = describeTool(lastTool);
  return (
    <AnimatePresence>
      {busy && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 15,
            background: "linear-gradient(135deg, rgba(30, 27, 75, 0.94) 0%, rgba(30, 41, 59, 0.94) 100%)",
            border: "1px solid #4338ca",
            backdropFilter: "blur(6px)",
            borderRadius: 10,
            padding: "12px 16px",
            minWidth: 280,
            maxWidth: 420,
            color: "#e0e7ff",
            fontSize: 12,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
              style={{
                width: 14, height: 14,
                border: "2px solid #6366f1",
                borderTopColor: "transparent",
                borderRadius: "50%",
              }}
            />
            <div style={{ fontWeight: 600, color: "#c7d2fe" }}>
              {phase || "Claude генерирует домен"}
            </div>
            {toolCount > 0 && (
              <div style={{ marginLeft: "auto", fontSize: 11, color: "#94a3b8" }}>
                {toolCount} {toolCount === 1 ? "действие" : toolCount < 5 ? "действия" : "действий"}
              </div>
            )}
          </div>
          {verbLine && (
            <div style={{
              fontSize: 12,
              color: "#a5b4fc",
              fontFamily: "ui-monospace, 'SF Mono', monospace",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {verbLine}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
