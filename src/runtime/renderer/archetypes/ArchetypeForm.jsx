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
  const ownerFields = ["clientId", "organizerId", "userId", "authorId", "sellerId", "openedBy", "id"];
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
      // Группируем dirty-поля по intentId: один intent (update_profile)
      // может покрывать несколько полей (name, bio, location) — отправляем
      // их одним вызовом, чтобы generic handler получил все значения в ctx.
      const byIntent = {};
      for (const f of dirtyFields) {
        if (!byIntent[f.intentId]) byIntent[f.intentId] = {};
        byIntent[f.intentId][f.name] = values[f.name];
      }
      const subs = Object.entries(byIntent).map(([intentId, fields]) => ({
        intentId,
        ctx: { id: target.id, ...fields },
      }));

      if (parentCtx.execBatch) {
        parentCtx.execBatch(projection.sourceProjection || "edit_form", subs);
      } else {
        for (const sub of subs) {
          await parentCtx.exec(sub.intentId, sub.ctx);
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
      background: "var(--mantine-color-body)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "12px 16px", background: "var(--mantine-color-default)", borderBottom: "1px solid var(--mantine-color-default-border)",
      }}>
        <button onClick={goBack} style={{
          padding: "6px 12px", borderRadius: 6, border: "1px solid var(--mantine-color-default-border)",
          background: "var(--mantine-color-default)", color: "var(--mantine-color-text)", cursor: "pointer", fontSize: 13,
        }}>← Отмена</button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, flex: 1 }}>
          {projection.name}
        </h1>
        <button
          onClick={onSave}
          disabled={submitting || dirtyFields.length === 0}
          style={{
            padding: "8px 18px", borderRadius: 6, border: "none",
            background: dirtyFields.length > 0 && !submitting ? "var(--mantine-color-primary, #6366f1)" : "var(--mantine-color-default)",
            color: dirtyFields.length > 0 ? "#fff" : "var(--mantine-color-dimmed)", fontWeight: 600,
            cursor: dirtyFields.length > 0 && !submitting ? "pointer" : "default",
            opacity: submitting ? 0.6 : 1,
          }}
        >
          {submitting ? "…" : `Сохранить${dirtyFields.length > 0 ? ` (${dirtyFields.length})` : ""}`}
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{
          maxWidth: 640, margin: "0 auto", background: "var(--mantine-color-default)",
          borderRadius: 12, padding: 24, border: "1px solid var(--mantine-color-default-border)",
        }}>
          {body.sections ? (
            body.sections.map(section => (
              <div key={section.id} style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 13, fontWeight: 700, textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  color: "var(--mantine-color-dimmed)",
                  marginBottom: 12, paddingBottom: 8,
                  borderBottom: "1px solid var(--mantine-color-default-border)",
                }}>{section.title}</div>
                {section.fields.filter(f => f.editable).map(field => (
                  <FormField key={field.name} field={field} values={values} setValues={setValues} errors={errors} world={parentCtx.world} />
                ))}
              </div>
            ))
          ) : (
            (body.fields || []).filter(f => f.editable).map(field => (
              <FormField key={field.name} field={field} values={values} setValues={setValues} errors={errors} world={parentCtx.world} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({ field, values, setValues, errors, world }) {
  let control = mapFieldTypeToControl(field.type);
  let options = field.options;

  // entityRef → select с options из world. Поле fooId → коллекция foos.
  if (field.type === "entityRef" && !options && world) {
    control = "select";
    const refName = field.name.replace(/Id$/, "").toLowerCase();
    const collName = refName.endsWith("y") ? refName.slice(0, -1) + "ies"
      : refName.endsWith("s") ? refName + "es" : refName + "s";
    const items = world[collName] || [];
    options = items.map(it => ({
      value: it.id,
      label: it.name || it.title || it.id,
    }));
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <ParameterControl
        spec={{
          name: field.name,
          label: field.label || field.name,
          control,
          required: field.required,
          options,
        }}
        value={values[field.name]}
        onChange={v => setValues(p => ({ ...p, [field.name]: v }))}
        error={errors[field.name]}
      />
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
    multiImage: "multiImage",
    file: "file",
    email: "email",
    tel: "tel",
    url: "url",
    number: "number",
    enum: "select",
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
