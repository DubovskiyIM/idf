import { describe, it, expect } from "vitest";
import { inferControlType } from "./inferControlType.js";

describe("inferControlType", () => {
  it("явный type в параметре побеждает", () => {
    const p = { name: "foo", type: "datetime" };
    expect(inferControlType(p, {})).toBe("datetime");
  });

  it("имя с суффиксом _text → textarea", () => {
    expect(inferControlType({ name: "draft_text" }, {})).toBe("text");
    expect(inferControlType({ name: "welcome_message" }, {})).toBe("textarea");
    expect(inferControlType({ name: "description" }, {})).toBe("textarea");
  });

  it("имя с _time/_date/_at → datetime", () => {
    expect(inferControlType({ name: "scheduled_time" }, {})).toBe("datetime");
    expect(inferControlType({ name: "start_date" }, {})).toBe("datetime");
    expect(inferControlType({ name: "published_at" }, {})).toBe("datetime");
  });

  it("имя с _file/_image/_video → file", () => {
    expect(inferControlType({ name: "avatar_image" }, {})).toBe("file");
    expect(inferControlType({ name: "document_file" }, {})).toBe("file");
    expect(inferControlType({ name: "video" }, {})).toBe("file");
  });

  it("имя с _count/_duration → number", () => {
    expect(inferControlType({ name: "message_count" }, {})).toBe("number");
    expect(inferControlType({ name: "recording_duration" }, {})).toBe("number");
  });

  it("имя name/title/query → text", () => {
    expect(inferControlType({ name: "user_name" }, {})).toBe("text");
    expect(inferControlType({ name: "album_title" }, {})).toBe("text");
    expect(inferControlType({ name: "query" }, {})).toBe("text");
  });

  it("имя email/phone/url", () => {
    expect(inferControlType({ name: "user_email" }, {})).toBe("email");
    expect(inferControlType({ name: "contact_phone" }, {})).toBe("tel");
    expect(inferControlType({ name: "invite_url" }, {})).toBe("url");
  });

  it("поле онтологии со statuses → select", () => {
    const ontology = { entities: { Message: { fields: ["status"], statuses: ["sent", "delivered", "read"] } } };
    const p = { name: "status", entity: "Message" };
    expect(inferControlType(p, ontology)).toBe("select");
  });

  it("fallback — text", () => {
    expect(inferControlType({ name: "некое_поле" }, {})).toBe("text");
  });

  it("массив сущностей → multiSelect", () => {
    const p = { name: "messages", isArray: true };
    expect(inferControlType(p, {})).toBe("multiSelect");
  });
});
