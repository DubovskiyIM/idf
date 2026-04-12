import { useMemo, useState } from "react";
import ParameterControl from "../parameters/index.jsx";

/**
 * Form-архетип: редактирование одной сущности через композитную форму.
 *
 * Проекция автогенерируется кристаллизатором из detail-проекции + replace-intents
 * (см. formGrouping.js). Body содержит formSpec: { fields, mainEntity, editIntents }.
 *
 * Save → execBatch собирает все изменённые поля в atomic batch-эффект
 * (α:"batch", §11 манифеста).
 */
export default function ArchetypeForm({ slots, ctx: parentCtx, projection }) {
  const body = slots.body; // { type: "formBody", mainEntity, fields, editIntents }

  // Резолв target entity из route params (как в detail-архетипе)
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

  // Initial values — берём из target
  const [values, setValues] = useState(() => {
    const initial = {};
    if (target) {
      for (const field of body.fields || []) {
        initial[field.name] = target[field.name] ?? "";
      }
    }
    return initial;
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (!target) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
        Сущность не найдена: {projection?.mainEntity} id={parentCtx.routeParams?.[projection?.idParam]}
      </div>
    );
  }

  // Ownership check: если target не принадлежит viewer'у — показываем отказ.
  // Проверяем несколько стандартных ownership-полей.
  const viewerId = parentCtx.viewer?.id;
  const ownerFields = ["clientId", "organizerId", "userId", "authorId", "id"];
  const isOwner = viewerId && ownerFields.some(f => target[f] === viewerId);
  if (!isOwner) {
    return (
      <div style={{
        padding: 40, textAlign: "center", color: "var(--mantine-color-dimmed)",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
      }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--mantine-color-text)" }}>
          Нет доступа к редактированию
        </div>
        <div style={{ fontSize: 12 }}>
          Вы можете редактировать только собственный профиль.
        </div>
        <button
          onClick={() => parentCtx.back ? parentCtx.back() : parentCtx.navigate?.(projection.sourceProjection, parentCtx.routeParams || {})}
          style={{
            marginTop: 8, padding: "8px 16px", borderRadius: 6,
            border: "1px solid #d1d5db", background: "#fff",
            color: "#374151", cursor: "pointer", fontSize: 13,
          }}
        >← Назад</button>
      </div>
    );
  }

  // Какие поля изменены (editable + value !== target[field])
  const dirtyFields = (body.fields || []).filter(
    f => f.editable && values[f.name] !== target[f.name]
  );

  const goBack = () => {
    if (parentCtx.navigate) {
      // Try navigate back через стек — но navigate только push'ит.
      // back() живёт в V2UI через useProjectionRoute. Для form-архетипа
      // пока используем ctx.back если доступен, иначе навигируем в source.
      if (parentCtx.back) {
        parentCtx.back();
      } else if (projection?.sourceProjection) {
        parentCtx.navigate(projection.sourceProjection, parentCtx.routeParams || {});
      }
    }
  };

  const onSave = async () => {
    // Валидация required полей
    const newErrors = {};
    for (const f of body.fields || []) {
      if (f.editable && f.required && !values[f.name]) {
        newErrors[f.name] = "Обязательное поле";
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    setErrors({});

    if (dirtyFields.length === 0) {
      goBack();
      return;
    }

    setSubmitting(true);
    try {
      // Batch-сохранение: собираем массив под-эффектов, по одному на изменённое поле.
      // Каждый под-эффект — вызов соответствующего intent с полем в ctx.
      if (parentCtx.execBatch) {
        const subs = dirtyFields.map(f => ({
          intentId: f.intentId,
          ctx: {
            id: target.id,
            [f.name]: values[f.name],
          },
        }));
        parentCtx.execBatch(projection.sourceProjection || "edit_form", subs);
      } else {
        // Fallback: последовательные exec (если execBatch не прокинут)
        for (const f of dirtyFields) {
          await parentCtx.exec(f.intentId, {
            id: target.id,
            [f.name]: values[f.name],
          });
        }
      }
      goBack();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%",
      background: "#f9fafb",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", background: "#fff", borderBottom: "1px solid #e5e7eb",
      }}>
        <button onClick={goBack} style={{
          padding: "6px 12px", borderRadius: 6, border: "1px solid #d1d5db",
          background: "#fff", cursor: "pointer", fontSize: 13,
        }}>← Отмена</button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, flex: 1 }}>
          {projection.name}
        </h1>
        <button
          onClick={onSave}
          disabled={submitting || dirtyFields.length === 0}
          style={{
            padding: "8px 18px", borderRadius: 6, border: "none",
            background: dirtyFields.length > 0 && !submitting ? "#6366f1" : "#e5e7eb",
            color: "#fff", fontWeight: 600,
            cursor: dirtyFields.length > 0 && !submitting ? "pointer" : "default",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "…" : `Сохранить${dirtyFields.length > 0 ? ` (${dirtyFields.length})` : ""}`}
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{
          maxWidth: 640, margin: "0 auto", background: "#fff",
          borderRadius: 12, padding: 24, border: "1px solid #e5e7eb",
        }}>
          {(body.fields || []).map(field => (
            <div key={field.name} style={{ marginBottom: 18 }}>
              <label style={{
                display: "block", fontSize: 12, fontWeight: 600,
                color: "#374151", marginBottom: 4,
              }}>
                {field.label || field.name}
                {!field.editable && <span style={{ color: "#9ca3af", marginLeft: 6 }}>(read-only)</span>}
                {field.required && <span style={{ color: "#ef4444" }}> *</span>}
              </label>
              {field.editable ? (
                <ParameterControl
                  spec={{
                    name: field.name,
                    control: mapFieldTypeToControl(field.type),
                    required: field.required,
                  }}
                  value={values[field.name]}
                  onChange={v => setValues(p => ({ ...p, [field.name]: v }))}
                  error={errors[field.name]}
                />
              ) : (
                <div style={{
                  padding: "8px 12px", borderRadius: 6,
                  background: "#f3f4f6", color: "#6b7280", fontSize: 14,
                }}>
                  {target[field.name] != null && target[field.name] !== "" ? String(target[field.name]) : "—"}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function mapFieldTypeToControl(type) {
  const map = {
    text: "text",
    textarea: "textarea",
    datetime: "datetime",
    date: "datetime",
    image: "image",
    file: "file",
    email: "email",
    tel: "tel",
    url: "url",
    number: "number",
    enum: "text", // → select позже, пока text
    id: "text",
  };
  return map[type] || "text";
}

function pluralize(word) {
  if (!word) return word;
  if (word.endsWith("y")) return word.slice(0, -1) + "ies";
  if (word.endsWith("s")) return word + "es";
  return word + "s";
}
