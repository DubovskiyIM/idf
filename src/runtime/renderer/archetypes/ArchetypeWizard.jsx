import { useState, useMemo, useCallback } from "react";
import { getAdaptedComponent } from "../adapters/registry.js";
import { humanLabel, humanValue } from "../adapters/labels.js";

// ── Sub-components ──

function ItemCard({ item, step, isSelected, onSelect }) {
  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        cursor: "pointer", padding: 14, borderRadius: 8,
        border: isSelected
          ? "2px solid var(--mantine-color-primary, #6366f1)"
          : "1px solid var(--mantine-color-default-border)",
        background: "var(--mantine-color-default)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        transition: "border-color 0.15s",
      }}
    >
      <div>
        {(step.display || ["name", "id"]).map((field, fi) => (
          <div key={field} style={{
            fontSize: fi === 0 ? 15 : 13,
            fontWeight: fi === 0 ? 600 : 400,
            color: fi === 0 ? "var(--mantine-color-text)" : "var(--mantine-color-dimmed)",
          }}>
            {fi > 0 && <span>{humanLabel(field)}: </span>}
            {humanValue(field, item[field]) ?? "—"}
            {field === "price" && typeof item[field] === "number" ? " ₽" : ""}
            {field === "duration" && typeof item[field] === "number" ? " мин" : ""}
          </div>
        ))}
      </div>
      {isSelected && (
        <span style={{ color: "var(--mantine-color-primary, #6366f1)", fontSize: 20, fontWeight: 700 }}>✓</span>
      )}
    </div>
  );
}

function FlatList({ items, step, collected, onSelect }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map(item => (
        <ItemCard key={item.id} item={item} step={step} isSelected={collected[step.id]?.id === item.id} onSelect={onSelect} />
      ))}
    </div>
  );
}

function GroupedList({ items, step, collected, onSelect, world }) {
  const gb = step.groupBy;
  const categories = world[gb.collection] || [];
  const catMap = {};
  for (const cat of categories) catMap[cat.id] = cat;

  // Группируем items по categoryId
  const groups = {};
  const ungrouped = [];
  for (const item of items) {
    const catId = item[gb.field];
    if (catId && catMap[catId]) {
      if (!groups[catId]) groups[catId] = { cat: catMap[catId], items: [] };
      groups[catId].items.push(item);
    } else {
      ungrouped.push(item);
    }
  }

  // Сортируем группы по sortOrder категории
  const sorted = Object.values(groups).sort((a, b) => (a.cat.sortOrder || 0) - (b.cat.sortOrder || 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {sorted.map(({ cat, items: groupItems }) => (
        <div key={cat.id}>
          <div style={{
            fontSize: 14, fontWeight: 600, marginBottom: 8,
            color: "var(--mantine-color-text)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {cat[gb.iconField] && <span>{cat[gb.iconField]}</span>}
            {cat[gb.labelField] || cat.id}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {groupItems.map(item => (
              <ItemCard key={item.id} item={item} step={step} isSelected={collected[step.id]?.id === item.id} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
      {ungrouped.length > 0 && (
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "var(--mantine-color-dimmed)" }}>Другое</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {ungrouped.map(item => (
              <ItemCard key={item.id} item={item} step={step} isSelected={collected[step.id]?.id === item.id} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarView({ items, step, collected, onSelect }) {
  // Группируем слоты по дате
  const byDate = {};
  for (const item of items) {
    const d = item.date || "unknown";
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(item);
  }
  const dates = Object.keys(byDate).sort();
  const [selectedDate, setSelectedDate] = useState(dates[0] || "");

  const daySlots = byDate[selectedDate] || [];
  daySlots.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

  const formatDate = (d) => {
    try {
      const dt = new Date(d + "T00:00:00");
      return dt.toLocaleDateString("ru", { weekday: "short", day: "numeric", month: "short" });
    } catch { return d; }
  };

  return (
    <div>
      {/* Date tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
        {dates.map(d => (
          <button
            key={d}
            onClick={() => setSelectedDate(d)}
            style={{
              padding: "8px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              border: d === selectedDate ? "2px solid var(--mantine-color-primary, #6366f1)" : "1px solid var(--mantine-color-default-border)",
              background: d === selectedDate ? "var(--mantine-color-primary-light, #eef2ff)" : "var(--mantine-color-default)",
              color: d === selectedDate ? "var(--mantine-color-primary, #6366f1)" : "var(--mantine-color-text)",
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {formatDate(d)}
          </button>
        ))}
      </div>

      {/* Time slots grid */}
      {daySlots.length === 0 ? (
        <div style={{ padding: 16, textAlign: "center", color: "var(--mantine-color-dimmed)" }}>
          Нет свободных слотов на эту дату
        </div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {daySlots.map(slot => {
            const isSelected = collected[step.id]?.id === slot.id;
            return (
              <button
                key={slot.id}
                onClick={() => onSelect(slot)}
                style={{
                  padding: "10px 18px", borderRadius: 8, fontSize: 14, fontWeight: 500,
                  border: isSelected ? "2px solid var(--mantine-color-primary, #6366f1)" : "1px solid var(--mantine-color-default-border)",
                  background: isSelected ? "var(--mantine-color-primary, #6366f1)" : "var(--mantine-color-default)",
                  color: isSelected ? "#fff" : "var(--mantine-color-text)",
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {slot.startTime}–{slot.endTime}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main component ──

/**
 * ArchetypeWizard — 7-й архетип: multi-step flow.
 *
 * steps: [{ id, label, intent, pick, source, sideEffect, filterBy, display, summary }]
 * Гибридный state: collected (локальный) + sideEffect exec'ы (Φ).
 */
export default function ArchetypeWizard({ slots, projection, ctx }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [collected, setCollected] = useState({});

  const steps = slots.steps || [];
  const step = steps[currentStep];
  const world = ctx.world || {};

  const handleSelect = useCallback((stepDef, item) => {
    const pickField = stepDef.pick?.[0];
    const newCollected = {
      ...collected,
      [stepDef.id]: { ...(pickField ? { [pickField]: item.id } : {}), ...item },
    };
    setCollected(newCollected);

    if (stepDef.sideEffect && stepDef.intent) {
      const params = { ...newCollected[stepDef.id] };
      if (pickField) params[pickField] = item.id;
      ctx.exec(stepDef.intent, params);
    }

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  }, [collected, currentStep, steps, ctx]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  }, [currentStep]);

  const handleConfirm = useCallback(() => {
    if (!step?.intent) return;
    // Собираем pick-поля + все данные из collected для финального exec
    const allParams = {};
    for (const s of steps) {
      const data = collected[s.id];
      if (!data) continue;
      if (s.pick) {
        for (const field of s.pick) {
          if (data[field] !== undefined) allParams[field] = data[field];
        }
      }
      // Передаём все поля entity (specialistId, price и т.д.)
      for (const [k, v] of Object.entries(data)) {
        if (allParams[k] === undefined && v !== undefined) allParams[k] = v;
      }
    }
    ctx.exec(step.intent, allParams);
    setCurrentStep(0);
    setCollected({});
    if (ctx.navigate) ctx.navigate("my_bookings", {});
  }, [step, steps, collected, ctx]);

  // Фильтрация source. source.inline (статический массив) имеет приоритет
  // над world[collection] — используется для fixed-choice шагов (risk
  // questionnaire, profile picker и т.п.) без необходимости сидить опции.
  const items = useMemo(() => {
    if (!step?.source) return [];
    const collection = Array.isArray(step.source.inline) && step.source.inline.length > 0
      ? step.source.inline
      : world[step.source.collection] || [];
    let filtered = collection;

    if (step.source.filter) {
      try {
        filtered = filtered.filter(item => {
          const fn = new Function(...Object.keys(item), `return !!(${step.source.filter})`);
          return fn(...Object.values(item));
        });
      } catch {}
    }

    if (step.source.filterBy) {
      for (const [field, ref] of Object.entries(step.source.filterBy)) {
        const m = ref.match(/^step\.(\w+)\.(\w+)$/);
        if (m) {
          const val = collected[m[1]]?.[m[2]];
          if (val !== undefined) {
            filtered = filtered.filter(item => item[field] === val);
          }
        }
      }
    }

    return filtered;
  }, [step, world, collected]);

  if (!step) return null;

  const AdaptedPaper = getAdaptedComponent("primitive", "paper");
  const Paper = AdaptedPaper || (({ children, ...props }) => (
    <div style={{ padding: 16, border: "1px solid var(--mantine-color-default-border)", borderRadius: 8, ...props.style }}>{children}</div>
  ));

  return (
    <div style={{ padding: 16, maxWidth: 600, margin: "0 auto", fontFamily: "system-ui, sans-serif", overflowY: "auto", height: "100%" }}>
      {/* Step indicators */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, justifyContent: "center", flexWrap: "wrap" }}>
        {steps.map((s, i) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 600,
              background: i === currentStep ? "var(--mantine-color-primary, #6366f1)"
                : i < currentStep ? "var(--mantine-color-teal-6, #0d9488)"
                : "var(--mantine-color-default, #e5e7eb)",
              color: i <= currentStep ? "#fff" : "var(--mantine-color-dimmed, #6b7280)",
            }}>
              {i < currentStep ? "✓" : i + 1}
            </div>
            <span style={{
              fontSize: 13,
              fontWeight: i === currentStep ? 600 : 400,
              color: i === currentStep ? "var(--mantine-color-text)" : "var(--mantine-color-dimmed)",
            }}>{s.label}</span>
            {i < steps.length - 1 && (
              <div style={{ width: 24, height: 1, background: "var(--mantine-color-default-border)" }} />
            )}
          </div>
        ))}
      </div>

      {/* Step body */}
      {step.summary ? (
        <Paper>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "var(--mantine-color-text)" }}>
            Подтверждение
          </h3>
          {steps.filter(s => collected[s.id]).map(s => {
            const data = collected[s.id];
            const displayVal = data.name || data.title
              || (data.date ? `${data.date} ${data.startTime || ""}` : null)
              || data.id;
            return (
              <div key={s.id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "var(--mantine-color-dimmed)", marginBottom: 4 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 14, color: "var(--mantine-color-text)", fontWeight: 500 }}>
                  {displayVal}
                  {data.price != null && (
                    <span style={{ marginLeft: 8, color: "var(--mantine-color-dimmed)" }}>
                      {Number(data.price).toLocaleString("ru")} ₽
                    </span>
                  )}
                  {data.duration != null && (
                    <span style={{ marginLeft: 8, color: "var(--mantine-color-dimmed)" }}>
                      {data.duration} мин
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button
              onClick={handleBack}
              style={{
                padding: "10px 20px", background: "transparent",
                border: "1px solid var(--mantine-color-default-border)",
                borderRadius: 8, cursor: "pointer", fontSize: 14,
                color: "var(--mantine-color-text)",
              }}
            >← Назад</button>
            <button
              onClick={handleConfirm}
              style={{
                flex: 1, padding: "12px 0",
                background: "var(--mantine-color-primary, #6366f1)", color: "#fff",
                border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600,
                cursor: "pointer",
              }}
            >Записаться</button>
          </div>
        </Paper>
      ) : (
        <>
          <h3 style={{ margin: "0 0 12px", fontSize: 16, color: "var(--mantine-color-text)" }}>
            {step.label}
          </h3>
          {items.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--mantine-color-dimmed)" }}>
              Нет доступных вариантов
            </div>
          ) : step.displayAs === "calendar" ? (
            <CalendarView items={items} step={step} collected={collected} onSelect={(item) => handleSelect(step, item)} />
          ) : step.groupBy ? (
            <GroupedList items={items} step={step} collected={collected} onSelect={(item) => handleSelect(step, item)} world={world} />
          ) : (
            <FlatList items={items} step={step} collected={collected} onSelect={(item) => handleSelect(step, item)} />
          )}
          {currentStep > 0 && (
            <button
              onClick={handleBack}
              style={{
                marginTop: 16, padding: "8px 20px",
                background: "transparent", border: "1px solid var(--mantine-color-default-border)",
                borderRadius: 6, cursor: "pointer", fontSize: 13,
                color: "var(--mantine-color-text)",
              }}
            >← Назад</button>
          )}
        </>
      )}
    </div>
  );
}
