import React from "react";

// Визуализация slot-трансформации паттерна.
//
// Архетипы кристаллизатора v2 имеют 6 канонических слотов:
//   header / hero / body / aside / composer / footer
// Pattern.structure.slot — какой слот pattern затрагивает.
// pattern.structure.kind — категория трансформации (insert/replace/decorate).
// pattern.structure.example (опц.) — текстовый пример того, что туда кладётся.
//
// Diagram рисует две колонки: BEFORE (стандартный архетип) и AFTER
// (с patched-слотом). Затронутый слот в AFTER подсвечивается.

const SLOTS = ["header", "hero", "body", "aside", "composer", "footer"];

const SLOT_HINTS = {
  header: "title · breadcrumbs · actions",
  hero: "primary identity · stats",
  body: "list · table · sections",
  aside: "filters · companions",
  composer: "input · capture",
  footer: "meta · audit · pagination",
};

function Slot({ name, highlighted, label, hint }) {
  const color = highlighted
    ? { bg: "#1e40af", border: "#60a5fa", fg: "#f8fafc" }
    : { bg: "#0f172a", border: "#1e293b", fg: "#64748b" };
  return (
    <div
      style={{
        background: color.bg,
        border: `1px solid ${color.border}`,
        borderRadius: 6,
        padding: "8px 10px",
        marginBottom: 6,
        fontSize: 12,
      }}
    >
      <div
        style={{
          color: color.fg,
          fontWeight: highlighted ? 600 : 500,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {label || name}
      </div>
      <div style={{ color: highlighted ? "#cbd5e1" : "#475569", fontSize: 10, marginTop: 2 }}>
        {hint || SLOT_HINTS[name] || ""}
      </div>
    </div>
  );
}

function Column({ title, slots, patchSlot, patchHint, label }) {
  return (
    <div style={{ flex: 1, minWidth: 200 }}>
      <div
        style={{
          fontSize: 11,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {title}
      </div>
      {slots.map((s) => (
        <Slot
          key={s}
          name={s}
          highlighted={patchSlot === s}
          label={patchSlot === s && label ? label : undefined}
          hint={patchSlot === s && patchHint ? patchHint : undefined}
        />
      ))}
    </div>
  );
}

export default function PatternStructureDiagram({ pattern }) {
  if (!pattern) {
    return (
      <div style={{ color: "#64748b", fontSize: 12, padding: 12 }}>
        Выберите паттерн — увидите slot-трансформацию.
      </div>
    );
  }
  const slot = pattern.structure?.slot || pattern.structure?.target || null;
  const kind = pattern.structure?.kind || "transform";
  const example =
    pattern.structure?.example ||
    pattern.example ||
    null;
  const patchHint = example
    ? typeof example === "string"
      ? example.slice(0, 80)
      : JSON.stringify(example).slice(0, 80)
    : `${kind} от ${pattern.id || "pattern"}`;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "stretch",
        }}
      >
        <Column
          title="Before — baseline archetype"
          slots={SLOTS}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: "#475569",
            fontSize: 18,
            paddingTop: 60,
          }}
        >
          ▸
        </div>
        <Column
          title={`After — with ${pattern.id || "pattern"}`}
          slots={SLOTS}
          patchSlot={slot}
          patchHint={patchHint}
          label={slot ? `${slot} · ${kind}` : null}
        />
      </div>
      {!slot && (
        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "#fbbf24",
            fontFamily: "ui-monospace, monospace",
          }}
        >
          ⚠ Pattern не декларирует structure.slot — apply-target не визуализируется.
          {" "}Добавь slot/kind/example в pattern source для лучшего preview.
        </div>
      )}
    </div>
  );
}
