import { describe, it, expect } from "vitest";
const { createFileWatcher } = require("./fileWatcher.js");
const fs = require("fs");
const path = require("path");
const os = require("os");

describe("createFileWatcher", () => {
  it("emits 'change' when a watched file changes", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "fw-"));
    const file = path.join(dir, "x.js");
    fs.writeFileSync(file, "initial");
    const watcher = createFileWatcher(dir);
    await new Promise((r) => setTimeout(r, 300));

    const seen = new Promise((resolve) => watcher.once("change", resolve));
    fs.writeFileSync(file, "updated");
    const evt = await Promise.race([
      seen,
      new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000)),
    ]);
    expect(evt.path).toBe(file);

    watcher.close();
    fs.rmSync(dir, { recursive: true });
  });
});
