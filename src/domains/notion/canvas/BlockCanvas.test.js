import { describe, it, expect } from "vitest";
import {
  toEditorBlock,
  DOMAIN_TO_EDITOR_KIND,
  EDITOR_TO_DOMAIN_KIND,
} from "./BlockCanvas.jsx";

describe("notion BlockCanvas — domain↔editor mapping", () => {
  it("kind карта обратима для всех ключей", () => {
    Object.entries(DOMAIN_TO_EDITOR_KIND).forEach(([domain, editor]) => {
      expect(EDITOR_TO_DOMAIN_KIND[editor]).toBe(domain);
    });
  });

  it("toEditorBlock конвертирует поля shape", () => {
    const b = {
      id: "b1",
      pageId: "p-1",
      kind: "heading_1",
      text: "Hello",
      position: 3,
      parentBlockId: null,
    };
    const e = toEditorBlock(b);
    expect(e.id).toBe("b1");
    expect(e.kind).toBe("heading-1");
    expect(e.content).toBe("Hello");
    expect(e.order).toBe(3);
    expect(e.parentId).toBe(null);
  });

  it("toEditorBlock fallback на paragraph для unknown kind", () => {
    const e = toEditorBlock({ id: "x", kind: undefined });
    expect(e.kind).toBe("paragraph");
    expect(e.content).toBe("");
    expect(e.order).toBe(0);
  });

  it("todo block — checked прокидывается в props", () => {
    const e = toEditorBlock({ id: "t", kind: "todo", text: "Купить хлеб", checked: true, position: 0 });
    expect(e.kind).toBe("to-do");
    expect(e.props.checked).toBe(true);
  });

  it("code block — language в props", () => {
    const e = toEditorBlock({ id: "c", kind: "code", text: "ls -la", language: "bash", position: 0 });
    expect(e.kind).toBe("code");
    expect(e.props.language).toBe("bash");
  });

  it("divider — пустой content", () => {
    const e = toEditorBlock({ id: "d", kind: "divider", position: 5 });
    expect(e.kind).toBe("divider");
    expect(e.content).toBe("");
    expect(e.order).toBe(5);
  });

  it("nested block — parentBlockId → parentId", () => {
    const e = toEditorBlock({ id: "child", kind: "paragraph", text: "x", parentBlockId: "root", position: 1 });
    expect(e.parentId).toBe("root");
  });
});
