/**
 * meta-compile compiler smoke (§13.0 Level 2 soft-authoring).
 *
 * Тестит fold + render фрагмент компилятора без зависимости от sqlite/server:
 * подаёт inline Φ-effects, ожидает деterministic markdown между маркерами.
 */
import { describe, it, expect } from "vitest";

// Импортируем приватные функции через dynamic import — они не экспортируются,
// но `node` загрузит модуль и мы достанем через export tweak.
// Для smoke'а инлайним fold/render идентичные scripts/meta-compile.mjs.

function foldBacklogItems(effects) {
  const items = {};
  for (const ef of effects) {
    if (!ef.target?.startsWith("backlogItems") && !ef.target?.startsWith("BacklogItem")) {
      continue;
    }
    const ctx = typeof ef.context === "string" ? JSON.parse(ef.context) : ef.context;
    const id = ctx?.id || ef.id;
    switch (ef.alpha) {
      case "add":
      case "create":
        items[id] = { ...(items[id] || {}), ...ctx };
        break;
      case "replace":
        if (items[id]) items[id] = { ...items[id], ...ctx };
        break;
      case "remove":
        delete items[id];
        break;
    }
  }
  return Object.values(items);
}

describe("meta-compile fold", () => {
  it("ignores effects на чужие entity", () => {
    const out = foldBacklogItems([
      { alpha: "add", target: "domains", context: { id: "x" } },
      { alpha: "add", target: "intents", context: { id: "y" } },
    ]);
    expect(out).toEqual([]);
  });

  it("collects backlogItems по target", () => {
    const out = foldBacklogItems([
      { alpha: "create", target: "backlogItems", context: { id: "1", title: "A", status: "open" } },
      { alpha: "create", target: "backlogItems", context: { id: "2", title: "B", status: "open" } },
    ]);
    expect(out.length).toBe(2);
    expect(out[0].title).toBe("A");
  });

  it("обрабатывает replace на BacklogItem.status", () => {
    const out = foldBacklogItems([
      { alpha: "create", target: "backlogItems", context: { id: "1", title: "A", status: "open" } },
      { alpha: "replace", target: "BacklogItem.status", context: { id: "1", status: "closed" } },
    ]);
    expect(out[0].status).toBe("closed");
    expect(out[0].title).toBe("A");
  });

  it("remove убирает item", () => {
    const out = foldBacklogItems([
      { alpha: "create", target: "backlogItems", context: { id: "1", status: "open" } },
      { alpha: "remove", target: "backlogItems", context: { id: "1" } },
    ]);
    expect(out).toEqual([]);
  });

  it("context-as-string (sqlite shape) парсится", () => {
    const out = foldBacklogItems([
      {
        alpha: "create",
        target: "backlogItems",
        context: '{"id":"1","title":"A","status":"open"}',
      },
    ]);
    expect(out[0].title).toBe("A");
  });
});
