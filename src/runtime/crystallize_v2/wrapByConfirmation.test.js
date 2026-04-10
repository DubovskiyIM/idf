import { describe, it, expect } from "vitest";
import { wrapByConfirmation } from "./wrapByConfirmation.js";

describe("wrapByConfirmation", () => {
  const baseIntent = (confirmation, extra = {}) => ({
    name: "Test",
    particles: { confirmation, witnesses: [], conditions: [] },
    ...extra,
  });

  it("confirmation:click без параметров → intentButton", () => {
    const wrap = wrapByConfirmation(baseIntent("click"), "delete_message", []);
    expect(wrap.type).toBe("intentButton");
    expect(wrap.intentId).toBe("delete_message");
  });

  it("confirmation:click + параметры → intentButton + formModal overlay", () => {
    const wrap = wrapByConfirmation(baseIntent("click"), "pin_message",
      [{ name: "reason", control: "text" }]);
    expect(wrap.trigger.type).toBe("intentButton");
    expect(wrap.trigger.opens).toBe("overlay");
    expect(wrap.overlay.type).toBe("formModal");
    expect(wrap.overlay.parameters).toHaveLength(1);
  });

  it("confirmation:enter → composerEntry (будет собрано в composer Слоем 2)", () => {
    const wrap = wrapByConfirmation(baseIntent("enter"), "send_message",
      [{ name: "text", control: "text" }]);
    expect(wrap.type).toBe("composerEntry");
    expect(wrap.intentId).toBe("send_message");
    expect(wrap.primaryParameter).toBe("text");
  });

  it("confirmation:form → intentButton + formModal в overlay", () => {
    const wrap = wrapByConfirmation(baseIntent("form"), "search_messages",
      [{ name: "query", control: "text" }]);
    expect(wrap.trigger.type).toBe("intentButton");
    expect(wrap.trigger.opens).toBe("overlay");
    expect(wrap.overlay.type).toBe("formModal");
    expect(wrap.overlay.intentId).toBe("search_messages");
    expect(wrap.overlay.parameters).toHaveLength(1);
  });

  it("confirmation:file → intentButton с file-picker как inline", () => {
    const wrap = wrapByConfirmation(baseIntent("file"), "set_avatar", []);
    expect(wrap.type).toBe("intentButton");
    expect(wrap.filePicker).toBe(true);
  });

  it("confirmation:auto → null (никакого UI)", () => {
    const wrap = wrapByConfirmation(baseIntent("auto"), "mark_as_read", []);
    expect(wrap).toBeNull();
  });

  it("irreversibility:high → оборачивает в confirmDialog overlay", () => {
    const wrap = wrapByConfirmation(
      baseIntent("click", { irreversibility: "high" }),
      "delete_account",
      []
    );
    expect(wrap.trigger.type).toBe("intentButton");
    expect(wrap.overlay.type).toBe("confirmDialog");
    expect(wrap.overlay.irreversibility).toBe("high");
    expect(wrap.overlay.confirmBy.type).toBe("typeText");
  });

  it("irreversibility:medium → простой confirm", () => {
    const wrap = wrapByConfirmation(
      baseIntent("click", { irreversibility: "medium" }),
      "delete_contact",
      []
    );
    expect(wrap.overlay.type).toBe("confirmDialog");
    expect(wrap.overlay.irreversibility).toBe("medium");
  });

  it("antagonist:X → не оборачивает здесь (делается на шаге слотов)", () => {
    const wrap = wrapByConfirmation(
      baseIntent("click", { antagonist: "unmute_conversation" }),
      "mute_conversation",
      []
    );
    expect(wrap.type).toBe("intentButton");
    expect(wrap.antagonist).toBe("unmute_conversation");
  });
});
