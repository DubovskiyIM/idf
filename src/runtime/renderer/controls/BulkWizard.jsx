import { useState, useMemo } from "react";
import { evalCondition } from "../eval.js";
import { ModalShell } from "./FormModal.jsx";

/**
 * BulkWizard — overlay для extended интентов (массовые операции).
 *
 * Шаги: select → summary → progress → done. Применение действий
 * последовательное (по одному exec на каждый id). Для по-настоящему
 * атомарного батча мы могли бы использовать execBatch, но здесь нужна
 * обратная связь по прогрессу — это важнее.
 *
 * Источник элементов резолвится через ctx.world[spec.source], фильтр —
 * spec.filter (JS-выражение, резолвится evalCondition'ом).
 */
export default function BulkWizard({ spec, ctx, onClose }) {
  const [step, setStep] = useState("select"); // select | summary | progress | done
  const [selected, setSelected] = useState(() => new Set());
  const [progress, setProgress] = useState(0);
  const [errorIds, setErrorIds] = useState([]);

  const items = ctx.world?.[spec.source] || [];
  const filtered = useMemo(() => {
    if (!spec.filter) return items;
    return items.filter(it => evalCondition(spec.filter, {
      ...it, item: it, viewer: ctx.viewer, world: ctx.world,
    }));
  }, [items, spec.filter, ctx.viewer, ctx.world]);

  const toggleItem = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map(i => i.id));
    });
  };

  const runBulk = async () => {
    setStep("progress");
    let done = 0;
    const errors = [];
    for (const id of selected) {
      try {
        await Promise.resolve(ctx.exec(spec.triggerIntentId, { id }));
      } catch {
        errors.push(id);
      }
      done++;
      setProgress(done);
    }
    setErrorIds(errors);
    setStep("done");
  };

  const itemLabel = (item) =>
    item.title || item.name || item.content || item.id;

  return (
    <ModalShell onClose={onClose} title={spec.label || "Массовая операция"}>
      {step === "select" && (
        <>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 13, color: "var(--mantine-color-dimmed)" }}>
              Доступно: {filtered.length} · выбрано: {selected.size}
            </span>
            <button
              onClick={toggleAll}
              style={{
                padding: "4px 10px", borderRadius: 6, border: "1px solid var(--mantine-color-default-border)",
                background: "var(--mantine-color-default)", cursor: "pointer", fontSize: 12,
              }}
            >
              {selected.size === filtered.length && filtered.length > 0 ? "Снять всё" : "Выбрать всё"}
            </button>
          </div>
          <div style={{
            maxHeight: 320, overflow: "auto",
            border: "1px solid var(--mantine-color-default-border)", borderRadius: 6, marginBottom: 16,
          }}>
            {filtered.length === 0 && (
              <div style={{ padding: 20, color: "var(--mantine-color-dimmed)", fontSize: 13, textAlign: "center" }}>
                Нет элементов
              </div>
            )}
            {filtered.map(item => (
              <label key={item.id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "8px 12px", borderBottom: "1px solid var(--mantine-color-default-border)",
                cursor: "pointer",
              }}>
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleItem(item.id)}
                />
                <span style={{ fontSize: 13, color: "var(--mantine-color-text)", flex: 1 }}>
                  {itemLabel(item)}
                </span>
              </label>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={onClose} style={btnSecondary}>Отмена</button>
            <button
              onClick={() => setStep("summary")}
              disabled={selected.size === 0}
              style={{
                ...btnPrimary,
                background: selected.size > 0 ? "var(--mantine-color-primary, #6366f1)" : "var(--mantine-color-default)",
                cursor: selected.size > 0 ? "pointer" : "default",
              }}
            >Далее ({selected.size})</button>
          </div>
        </>
      )}

      {step === "summary" && (
        <>
          <p style={{ fontSize: 14, color: "var(--mantine-color-text)" }}>
            Применить действие «{spec.label}» к <strong>{selected.size}</strong>{" "}
            {selected.size === 1 ? "элементу" : "элементам"}?
          </p>
          <div style={{
            maxHeight: 180, overflow: "auto",
            background: "var(--mantine-color-default-hover)", border: "1px solid var(--mantine-color-default-border)",
            borderRadius: 6, padding: 8, margin: "12px 0",
            fontSize: 12, color: "var(--mantine-color-dimmed)",
          }}>
            {Array.from(selected).map(id => {
              const it = filtered.find(i => i.id === id);
              return <div key={id}>• {it ? itemLabel(it) : id}</div>;
            })}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setStep("select")} style={btnSecondary}>← Назад</button>
            <button onClick={runBulk} style={{ ...btnPrimary, background: "#dc2626" }}>
              Выполнить
            </button>
          </div>
        </>
      )}

      {step === "progress" && (
        <div style={{ padding: "20px 0" }}>
          <p style={{ fontSize: 14, color: "var(--mantine-color-text)", marginBottom: 12 }}>
            Выполнение… {progress} / {selected.size}
          </p>
          <div style={{
            width: "100%", height: 8, borderRadius: 4, background: "var(--mantine-color-default-border)",
            overflow: "hidden",
          }}>
            <div style={{
              width: `${Math.round((progress / Math.max(1, selected.size)) * 100)}%`,
              height: "100%", background: "#6366f1",
              transition: "width 0.15s ease",
            }} />
          </div>
        </div>
      )}

      {step === "done" && (
        <>
          <p style={{ fontSize: 14, color: "var(--mantine-color-text)" }}>
            ✓ Готово. Обработано {selected.size - errorIds.length} из {selected.size}.
          </p>
          {errorIds.length > 0 && (
            <p style={{ fontSize: 12, color: "#dc2626" }}>
              Ошибок: {errorIds.length}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button onClick={onClose} style={{ ...btnPrimary, background: "#10b981" }}>
              Закрыть
            </button>
          </div>
        </>
      )}
    </ModalShell>
  );
}

const btnSecondary = {
  padding: "8px 16px", borderRadius: 6, border: "1px solid var(--mantine-color-default-border)",
  background: "var(--mantine-color-default)", color: "var(--mantine-color-text)", cursor: "pointer", fontSize: 13,
};

const btnPrimary = {
  padding: "8px 16px", borderRadius: 6, border: "none",
  background: "#6366f1", color: "#fff", fontWeight: 600, fontSize: 13,
  cursor: "pointer",
};
