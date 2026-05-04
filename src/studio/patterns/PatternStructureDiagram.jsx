import React from "react";

// Полный профиль паттерна (вкладка Structure в Curator workspace).
// Секции:
//   1. Trigger requires       — когда срабатывает (kind + details + rationale)
//   2. Slot transformation    — Before/After visual + structure.description + kind
//   3. Hypothesis             — rationale.hypothesis (зачем)
//   4. Evidence               — rationale.evidence: source / description / reliability
//   5. Counterexample         — где НЕ применять (rationale.counterexample)
//   6. Falsification preview  — shouldMatch / shouldNotMatch (превью без live-run;
//                                для live используется отдельная вкладка
//                                Falsification → FalsificationPanel)
//
// Раздел "Slot transformation" сохраняет старую Before/After visual, но
// не доминирует — обрамлён остальными секциями для контекста.

const SLOTS = ["header", "hero", "body", "aside", "composer", "footer"];

const SLOT_HINTS = {
  header: "title · breadcrumbs · actions",
  hero: "primary identity · stats",
  body: "list · table · sections",
  aside: "filters · companions",
  composer: "input · capture",
  footer: "meta · audit · pagination",
};

const RELIABILITY_COLOR = {
  high: "#10b981",
  medium: "#fbbf24",
  low: "#f87171",
  unknown: "#64748b",
};

function Section({ title, count, children, accent = "#94a3b8", muted }) {
  return (
    <section style={{ marginBottom: 18 }}>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 8,
          fontSize: 11,
          fontFamily: "ui-monospace, 'SF Mono', monospace",
          color: accent,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
        }}
      >
        <span>{title}</span>
        {count != null && (
          <span style={{ color: "#475569", fontWeight: 400 }}>· {count}</span>
        )}
      </header>
      <div style={{ color: muted ? "#64748b" : "#cbd5e1" }}>{children}</div>
    </section>
  );
}

function Tag({ children, color = "#1e293b", text = "#94a3b8", title }) {
  return (
    <span
      title={title}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: 20,
        padding: "0 8px",
        background: color,
        color: text,
        borderRadius: 10,
        fontSize: 10,
        fontFamily: "ui-monospace, monospace",
        fontWeight: 600,
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </span>
  );
}

// ── Trigger requires ─────────────────────────────────────────

function TriggerRequires({ trigger }) {
  const requires = trigger?.requires || [];
  if (requires.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "#64748b" }}>
        Нет declared requires (pattern unconditional or trigger.match-функция).
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {requires.map((req, i) => {
        const kind = req.kind || "?";
        const detailKeys = Object.keys(req).filter(
          (k) => k !== "kind" && k !== "rationale",
        );
        return (
          <div
            key={i}
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 6,
              padding: "8px 10px",
            }}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
              <Tag color="#1e3a8a" text="#bfdbfe">{kind}</Tag>
              {detailKeys.map((k) => (
                <Tag key={k} color="#0b1220" text="#94a3b8" title={`${k}: ${formatVal(req[k])}`}>
                  {k}: {formatVal(req[k])}
                </Tag>
              ))}
            </div>
            {req.rationale && (
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                {req.rationale}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function formatVal(v) {
  if (v === true) return "true";
  if (v === false) return "false";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

// ── Slot transformation visual ───────────────────────────────

function SlotBox({ name, highlighted, label, hint }) {
  const c = highlighted
    ? { bg: "#1e40af", border: "#60a5fa", fg: "#f8fafc" }
    : { bg: "#0f172a", border: "#1e293b", fg: "#64748b" };
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: 6,
        padding: "7px 9px",
        marginBottom: 5,
        fontSize: 11,
      }}
    >
      <div
        style={{
          color: c.fg,
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

function SlotGrid({ pattern }) {
  const slot = pattern.structure?.slot || pattern.structure?.target || null;
  const kind = pattern.structure?.kind || "transform";
  const example = pattern.structure?.example || pattern.example || null;
  const hint = example
    ? typeof example === "string"
      ? example.slice(0, 80)
      : JSON.stringify(example).slice(0, 80)
    : `${kind}`;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
      <Column title="Before" slots={SLOTS} />
      <div style={{ display: "flex", alignItems: "center", color: "#475569", fontSize: 18, paddingTop: 50 }}>
        ▸
      </div>
      <Column
        title={`After · ${pattern.id || "pattern"}`}
        slots={SLOTS}
        patchSlot={slot}
        patchHint={hint}
        label={slot ? `${slot} · ${kind}` : null}
      />
    </div>
  );
}

function Column({ title, slots, patchSlot, patchHint, label }) {
  return (
    <div style={{ flex: 1, minWidth: 180 }}>
      <div
        style={{
          fontSize: 10,
          color: "#475569",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 5,
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {title}
      </div>
      {slots.map((s) => (
        <SlotBox
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

function StructureSlot({ pattern }) {
  const slot = pattern.structure?.slot || pattern.structure?.target;
  const kind = pattern.structure?.kind;
  const description = pattern.structure?.description;
  return (
    <div>
      {description && (
        <div
          style={{
            background: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: 6,
            padding: 10,
            marginBottom: 10,
            fontSize: 12,
            color: "#cbd5e1",
            lineHeight: 1.5,
          }}
        >
          {description}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <Tag color="#1e3a8a" text="#bfdbfe">slot: {slot || "—"}</Tag>
        {kind && <Tag color="#0b1220" text="#94a3b8">kind: {kind}</Tag>}
      </div>
      <SlotGrid pattern={pattern} />
      {!slot && (
        <div style={{ marginTop: 8, fontSize: 11, color: "#fbbf24" }}>
          ⚠ Pattern не декларирует structure.slot — apply-target не визуализируется.
        </div>
      )}
    </div>
  );
}

// ── Evidence / counterexample ────────────────────────────────

function EvidenceList({ items, kind }) {
  if (!items || items.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "#64748b" }}>
        {kind === "evidence" ? "Нет declared evidence" : "Нет counterexample'ов"}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((ev, i) => {
        const reliability = ev.reliability || "unknown";
        const color = RELIABILITY_COLOR[reliability] || RELIABILITY_COLOR.unknown;
        return (
          <div
            key={i}
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderLeft: `3px solid ${color}`,
              borderRadius: 4,
              padding: "8px 10px",
            }}
          >
            <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 3 }}>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#e2e8f0",
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {ev.source || "—"}
              </span>
              <span style={{ fontSize: 10, color, fontFamily: "ui-monospace, monospace" }}>
                {reliability}
              </span>
            </div>
            {ev.description && (
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.4 }}>
                {ev.description}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Falsification preview ────────────────────────────────────

function FalsificationFixtures({ falsification }) {
  const should = falsification?.shouldMatch || [];
  const shouldNot = falsification?.shouldNotMatch || [];
  if (should.length === 0 && shouldNot.length === 0) {
    return (
      <div style={{ fontSize: 12, color: "#64748b" }}>
        Нет falsification fixtures — паттерн не верифицируется на доменах.
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      <FixtureCol title="shouldMatch" items={should} accent="#10b981" />
      <FixtureCol title="shouldNotMatch" items={shouldNot} accent="#f87171" />
    </div>
  );
}

function FixtureCol({ title, items, accent }) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: accent,
          fontFamily: "ui-monospace, monospace",
          fontWeight: 600,
          marginBottom: 5,
        }}
      >
        {title} ({items.length})
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 11, color: "#475569" }}>—</div>
      ) : (
        items.map((f, i) => (
          <div
            key={i}
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 4,
              padding: "6px 8px",
              marginBottom: 4,
              fontSize: 11,
            }}
          >
            <div style={{ fontFamily: "ui-monospace, monospace", color: "#cbd5e1" }}>
              {f.domain || "—"}
              <span style={{ color: "#475569" }}> · </span>
              <span style={{ color: "#94a3b8" }}>{f.projection || "?"}</span>
            </div>
            {f.reason && (
              <div style={{ color: "#64748b", fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>
                {f.reason}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// ── Top-level ────────────────────────────────────────────────

export default function PatternStructureDiagram({ pattern }) {
  if (!pattern) {
    return (
      <div style={{ color: "#64748b", fontSize: 12, padding: 12 }}>
        Выберите паттерн — увидите полный профиль.
      </div>
    );
  }
  const evidenceCount = (pattern.rationale?.evidence || []).length;
  const counterCount = (pattern.rationale?.counterexample || []).length;
  const triggerCount = (pattern.trigger?.requires || []).length;
  const fixCount =
    (pattern.falsification?.shouldMatch || []).length +
    (pattern.falsification?.shouldNotMatch || []).length;

  return (
    <div style={{ maxWidth: 920 }}>
      <Section title="Trigger · когда срабатывает" count={triggerCount} accent="#60a5fa">
        <TriggerRequires trigger={pattern.trigger} />
      </Section>

      <Section title="Slot transformation · что делает" accent="#60a5fa">
        <StructureSlot pattern={pattern} />
      </Section>

      {pattern.rationale?.hypothesis && (
        <Section title="Hypothesis · зачем" accent="#60a5fa">
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: 6,
              padding: 10,
              fontSize: 12,
              color: "#cbd5e1",
              lineHeight: 1.5,
              fontStyle: "italic",
            }}
          >
            {pattern.rationale.hypothesis}
          </div>
        </Section>
      )}

      <Section
        title="Evidence · где встречается"
        count={evidenceCount}
        accent="#10b981"
      >
        <EvidenceList items={pattern.rationale?.evidence} kind="evidence" />
      </Section>

      <Section
        title="Counterexample · когда НЕ применять"
        count={counterCount}
        accent="#fbbf24"
      >
        <EvidenceList items={pattern.rationale?.counterexample} kind="counter" />
      </Section>

      <Section
        title="Falsification fixtures (preview)"
        count={fixCount}
        accent="#94a3b8"
      >
        <FalsificationFixtures falsification={pattern.falsification} />
        {fixCount > 0 && (
          <div
            style={{
              fontSize: 10,
              color: "#475569",
              marginTop: 6,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            Live-run этих fixtures — вкладка <em>Falsification</em>.
          </div>
        )}
      </Section>
    </div>
  );
}
