import { describe, it, expect } from "vitest";
import {
  normalizeField,
  getEntityFields,
  canWrite,
  canRead,
  mapOntologyTypeToControl,
} from "./ontologyHelpers.js";

describe("normalizeField", () => {
  it("строка → объект с эвристикой типа", () => {
    expect(normalizeField("name")).toEqual({ name: "name", type: "text" });
    expect(normalizeField("email")).toEqual({ name: "email", type: "email" });
    expect(normalizeField("createdAt")).toEqual({ name: "createdAt", type: "datetime" });
    expect(normalizeField("avatar")).toEqual({ name: "avatar", type: "image" });
    expect(normalizeField("phone")).toEqual({ name: "phone", type: "tel" });
  });

  it("строка id → type: id", () => {
    expect(normalizeField("id")).toEqual({ name: "id", type: "id" });
    expect(normalizeField("userId")).toEqual({ name: "userId", type: "id" });
  });

  it("content/description → textarea", () => {
    expect(normalizeField("content").type).toBe("textarea");
    expect(normalizeField("description").type).toBe("textarea");
    expect(normalizeField("statusMessage").type).toBe("textarea");
  });

  it("объект + fieldName → объект с name", () => {
    const r = normalizeField({ type: "text", required: true }, "title");
    expect(r).toEqual({ name: "title", type: "text", required: true });
  });

  it("объект с read/write", () => {
    const r = normalizeField({ type: "email", read: ["*"], write: ["self"] }, "email");
    expect(r.read).toEqual(["*"]);
    expect(r.write).toEqual(["self"]);
  });
});

describe("getEntityFields", () => {
  it("массив строк → нормализованные объекты", () => {
    const entity = { fields: ["id", "name", "avatar"] };
    const fields = getEntityFields(entity);
    expect(fields).toHaveLength(3);
    expect(fields[0]).toEqual({ name: "id", type: "id" });
    expect(fields[1]).toEqual({ name: "name", type: "text" });
    expect(fields[2]).toEqual({ name: "avatar", type: "image" });
  });

  it("объектный формат → массив с полной метадатой", () => {
    const entity = {
      fields: {
        id: { type: "id" },
        name: { type: "text", required: true, write: ["self"] },
        bio: { type: "textarea", read: ["*"] },
      },
    };
    const fields = getEntityFields(entity);
    expect(fields).toHaveLength(3);
    const byName = Object.fromEntries(fields.map(f => [f.name, f]));
    expect(byName.name.required).toBe(true);
    expect(byName.name.write).toEqual(["self"]);
    expect(byName.bio.read).toEqual(["*"]);
  });

  it("нет fields → пустой массив", () => {
    expect(getEntityFields({})).toEqual([]);
    expect(getEntityFields(null)).toEqual([]);
  });
});

describe("canWrite / canRead", () => {
  it("write: [self] разрешает self, запрещает другим", () => {
    expect(canWrite({ write: ["self"] }, "self")).toBe(true);
    expect(canWrite({ write: ["self"] }, "contact")).toBe(false);
    expect(canWrite({ write: ["self"] }, "admin")).toBe(false);
  });

  it("write: [*] разрешает всем", () => {
    expect(canWrite({ write: ["*"] }, "anyone")).toBe(true);
    expect(canWrite({ write: ["*"] }, "self")).toBe(true);
  });

  it("нет write → nobody can write (default immutable)", () => {
    expect(canWrite({ type: "text" }, "self")).toBe(false);
    expect(canWrite({}, "anyone")).toBe(false);
  });

  it("write: [self, admin] — оба разрешены", () => {
    expect(canWrite({ write: ["self", "admin"] }, "self")).toBe(true);
    expect(canWrite({ write: ["self", "admin"] }, "admin")).toBe(true);
    expect(canWrite({ write: ["self", "admin"] }, "guest")).toBe(false);
  });

  it("нет read → readable by default (public)", () => {
    expect(canRead({ type: "text" }, "self")).toBe(true);
    expect(canRead({}, "anyone")).toBe(true);
  });

  it("read: [self] — только self", () => {
    expect(canRead({ read: ["self"] }, "self")).toBe(true);
    expect(canRead({ read: ["self"] }, "contact")).toBe(false);
  });

  it("read: [*] — все", () => {
    expect(canRead({ read: ["*"] }, "anyone")).toBe(true);
  });
});

describe("mapOntologyTypeToControl", () => {
  it("text → text", () => {
    expect(mapOntologyTypeToControl("text")).toBe("text");
  });
  it("image → file", () => {
    expect(mapOntologyTypeToControl("image")).toBe("file");
  });
  it("enum → select", () => {
    expect(mapOntologyTypeToControl("enum")).toBe("select");
  });
  it("datetime/date → datetime", () => {
    expect(mapOntologyTypeToControl("datetime")).toBe("datetime");
    expect(mapOntologyTypeToControl("date")).toBe("datetime");
  });
  it("unknown → text", () => {
    expect(mapOntologyTypeToControl("hologram")).toBe("text");
  });
});
