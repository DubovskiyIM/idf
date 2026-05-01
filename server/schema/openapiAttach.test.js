import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { saveAttachment, uploadToAnthropic, removeAttachment } = req("./openapiAttach.cjs");

describe("openapiAttach.saveAttachment", () => {
  let dir;
  beforeEach(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), "att-")); });
  afterEach(async () => { await fs.rm(dir, { recursive: true, force: true }); });

  it("сохраняет multipart-buffer в stagingDir с safe-filename", async () => {
    const fixture = await fs.readFile(path.resolve(__dirname, "../__fixtures__/openapi/petstore-mini.yaml"));
    const r = await saveAttachment({
      stagingDir: dir,
      sessionId: "sess1",
      originalName: "Pet store.yaml",
      buffer: fixture,
    });
    expect(r.path.startsWith(dir)).toBe(true);
    expect(r.path).toMatch(/sess1/);
    expect(r.path).toMatch(/\.yaml$/);
    expect(r.size).toBe(fixture.length);
    const persisted = await fs.readFile(r.path);
    expect(persisted.equals(fixture)).toBe(true);
  });

  it("отклоняет файлы > maxBytes", async () => {
    await expect(saveAttachment({
      stagingDir: dir, sessionId: "s", originalName: "big.yaml",
      buffer: Buffer.alloc(11 * 1024 * 1024), maxBytes: 10 * 1024 * 1024,
    })).rejects.toThrow(/too_large|размер/i);
  });

  it("отклоняет не-yaml/json расширения", async () => {
    await expect(saveAttachment({
      stagingDir: dir, sessionId: "s", originalName: "evil.exe",
      buffer: Buffer.from("x"),
    })).rejects.toThrow(/extension|формат/i);
  });

  it("отклоняет невалидный YAML", async () => {
    await expect(saveAttachment({
      stagingDir: dir, sessionId: "s", originalName: "bad.yaml",
      buffer: Buffer.from("foo: [bar"),
    })).rejects.toThrow(/yaml|parse/i);
  });
});

describe("openapiAttach.uploadToAnthropic", () => {
  it("вызывает client.beta.files.upload и возвращает {fileId, name}", async () => {
    const upload = vi.fn().mockResolvedValue({ id: "file_abc", filename: "spec.yaml" });
    const fakeClient = { beta: { files: { upload } } };
    const tmpFile = path.join(os.tmpdir(), `spec-test-${Date.now()}.yaml`);
    fsSync.writeFileSync(tmpFile, "openapi: 3.0.0\ninfo: {title: t, version: 1.0.0}\npaths: {}");
    try {
      const r = await uploadToAnthropic({ filePath: tmpFile, client: fakeClient });
      expect(upload).toHaveBeenCalledOnce();
      expect(r.fileId).toBe("file_abc");
      expect(r.name).toBe("spec.yaml");
    } finally {
      if (fsSync.existsSync(tmpFile)) fsSync.unlinkSync(tmpFile);
    }
  });
});

describe("openapiAttach.removeAttachment", () => {
  it("удаляет файл, если он есть", async () => {
    const tmp = path.join(os.tmpdir(), `att-rm-${Date.now()}.yaml`);
    fsSync.writeFileSync(tmp, "x");
    await removeAttachment(tmp);
    expect(fsSync.existsSync(tmp)).toBe(false);
  });
  it("не падает если файла уже нет", async () => {
    await expect(removeAttachment("/tmp/idf-nonexistent-xxx.yaml")).resolves.not.toThrow();
  });
});
