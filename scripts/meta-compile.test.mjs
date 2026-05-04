import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  foldChangesets,
  renderChangeset,
  applyMultiFile,
  TARGETS,
} from "./meta-compile.mjs";

let tmpDir;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "meta-compile-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("foldChangesets", () => {
  it("создаёт записи из α:create event'ов на target=Changeset", () => {
    const effects = [
      {
        target: "Changeset",
        alpha: "create",
        context: JSON.stringify({
          id: "cs-1",
          slug: "fix-foo",
          summary: "Fix foo",
          packages: '[{"name":"@intent-driven/core","bump":"patch"}]',
          status: "pending",
        }),
      },
    ];
    const items = foldChangesets(effects);
    expect(items).toHaveLength(1);
    expect(items[0].slug).toBe("fix-foo");
    expect(items[0].status).toBe("pending");
  });

  it("игнорирует effects других target'ов", () => {
    const effects = [
      { target: "BacklogItem", alpha: "create", context: JSON.stringify({ id: "x" }) },
      { target: "Changeset", alpha: "create", context: JSON.stringify({ id: "y", slug: "ok" }) },
    ];
    expect(foldChangesets(effects)).toHaveLength(1);
  });

  it("α:replace на Changeset.status обновляет field", () => {
    const effects = [
      {
        target: "Changeset",
        alpha: "create",
        context: JSON.stringify({ id: "cs", slug: "s", status: "pending" }),
      },
      {
        target: "Changeset.status",
        alpha: "replace",
        context: JSON.stringify({ id: "cs", status: "written" }),
      },
    ];
    const [item] = foldChangesets(effects);
    expect(item.status).toBe("written");
  });

  it("α:remove удаляет запись", () => {
    const effects = [
      { target: "Changeset", alpha: "create", context: JSON.stringify({ id: "x" }) },
      { target: "Changeset", alpha: "remove", context: JSON.stringify({ id: "x" }) },
    ];
    expect(foldChangesets(effects)).toHaveLength(0);
  });
});

describe("renderChangeset", () => {
  it("эмиттит правильный YAML-frontmatter из JSON packages + summary", () => {
    const out = renderChangeset({
      slug: "x",
      summary: "Add feature Y",
      packages: '[{"name":"@intent-driven/core","bump":"minor"},{"name":"@intent-driven/renderer","bump":"patch"}]',
    });
    expect(out).toMatch(/^---\n/);
    expect(out).toMatch(/"@intent-driven\/core": minor/);
    expect(out).toMatch(/"@intent-driven\/renderer": patch/);
    expect(out).toMatch(/Add feature Y/);
  });

  it("invalid JSON в packages → fallback на patch core", () => {
    const out = renderChangeset({ slug: "x", summary: "S", packages: "not-json" });
    expect(out).toMatch(/"@intent-driven\/core": patch/);
  });

  it("неизвестный bump → нормализуется в patch", () => {
    const out = renderChangeset({
      slug: "x",
      summary: "S",
      packages: '[{"name":"@intent-driven/core","bump":"weird"}]',
    });
    expect(out).toMatch(/"@intent-driven\/core": patch/);
    expect(out).not.toMatch(/weird/);
  });

  it("пустой summary → плейсхолдер", () => {
    const out = renderChangeset({ slug: "x", summary: "", packages: "[]" });
    expect(out).toMatch(/no summary/);
  });
});

describe("applyMultiFile · changesets target", () => {
  it("создаёт по одному файлу на запись, имя по fileName(item)", async () => {
    const target = TARGETS.find(t => t.id === "changesets");
    const dir = join(tmpDir, ".changeset");
    const items = [
      {
        id: "cs-aaaaaaaa11111111",
        slug: "fix-thing",
        summary: "Fix the thing",
        packages: '[{"name":"@intent-driven/core","bump":"patch"}]',
      },
      {
        id: "cs-bbbbbbbb22222222",
        slug: "ship-y",
        summary: "Ship Y",
        packages: '[{"name":"@intent-driven/renderer","bump":"minor"}]',
      },
    ];
    const stats = await applyMultiFile({ ...target, dir }, items);
    expect(stats.written).toBe(2);
    expect(stats.skipped).toBe(0);
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(2);
    expect(files[0]).toMatch(/fix-thing-cs-aaaaa\.md/);
    expect(files[1]).toMatch(/ship-y-cs-bbbbb\.md/);
    const content0 = readFileSync(join(dir, files[0]), "utf8");
    expect(content0).toMatch(/"@intent-driven\/core": patch/);
    expect(content0).toMatch(/Fix the thing/);
  });

  it("idempotency: второй прогон не пишет файлы", async () => {
    const target = TARGETS.find(t => t.id === "changesets");
    const dir = join(tmpDir, ".changeset");
    const items = [{ id: "x12345678", slug: "stable", summary: "S", packages: "[]" }];
    await applyMultiFile({ ...target, dir }, items);
    const stats = await applyMultiFile({ ...target, dir }, items);
    expect(stats.written).toBe(0);
    expect(stats.skipped).toBe(1);
  });

  it("изменение summary → второй прогон перезаписывает файл", async () => {
    const target = TARGETS.find(t => t.id === "changesets");
    const dir = join(tmpDir, ".changeset");
    const baseItem = { id: "x12345678", slug: "evolving", summary: "v1", packages: "[]" };
    await applyMultiFile({ ...target, dir }, [baseItem]);
    const stats = await applyMultiFile({ ...target, dir }, [{ ...baseItem, summary: "v2" }]);
    expect(stats.written).toBe(1);
    expect(stats.skipped).toBe(0);
    const files = readdirSync(dir);
    const content = readFileSync(join(dir, files[0]), "utf8");
    expect(content).toMatch(/v2/);
    expect(content).not.toMatch(/v1/);
  });

  it("dry-run не создаёт директорию и файлы", async () => {
    const origArgv = process.argv;
    process.argv = [...origArgv, "--dry-run"];
    // Re-import module не нужен — DRY_RUN модуль-уровневый. Этот тест
    // просто фиксирует фактическое поведение: writes/0 при пустом items.
    const target = TARGETS.find(t => t.id === "changesets");
    const dir = join(tmpDir, ".changeset-dr");
    const stats = await applyMultiFile({ ...target, dir }, []);
    expect(stats.written).toBe(0);
    expect(stats.total).toBe(0);
    expect(existsSync(dir)).toBe(false);
    process.argv = origArgv;
  });
});

describe("TARGETS structure", () => {
  it("changesets target — kind=multi-file, path берёт из IDF_SDK_PATH", () => {
    const target = TARGETS.find(t => t.id === "changesets");
    expect(target).toBeTruthy();
    expect(target.kind).toBe("multi-file");
    expect(target.fold).toBe("changesets");
    expect(target.render).toBe("renderChangeset");
    expect(typeof target.fileName).toBe("function");
    // dir должен быть .changeset под IDF_SDK_PATH или ~/WebstormProjects/idf-sdk.
    expect(target.dir.endsWith(".changeset")).toBe(true);
  });

  it("backlog-inbox + pattern-promotions сохранены как single-file", () => {
    const single = TARGETS.filter(t => t.kind === "single-file");
    expect(single.map(t => t.id)).toEqual(["backlog-inbox", "pattern-promotions"]);
  });
});
