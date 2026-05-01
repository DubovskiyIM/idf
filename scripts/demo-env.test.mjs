import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DEMO_DIR = path.join(REPO, ".demo-test");

function runSetup(extraArgs = []) {
  return spawnSync(
    "node",
    [path.join(REPO, "scripts/demo-env.mjs"), "--fresh", "--out", DEMO_DIR, ...extraArgs],
    { encoding: "utf8", timeout: 30000, cwd: REPO }
  );
}

describe("demo-env setup", () => {
  it("собирается из нуля одной командой и пишет 3 файла", () => {
    rmSync(DEMO_DIR, { recursive: true, force: true });
    const res = runSetup();
    if (res.status !== 0) {
      throw new Error(`demo-env failed: ${res.stderr || res.stdout}`);
    }
    expect(existsSync(path.join(DEMO_DIR, "accounts.json"))).toBe(true);
    expect(existsSync(path.join(DEMO_DIR, "world.json"))).toBe(true);
    expect(existsSync(path.join(DEMO_DIR, "mcp-config.json"))).toBe(true);
  });

  it("accounts.json содержит owner/agent/observer с ненулевыми JWT", () => {
    const accounts = JSON.parse(readFileSync(path.join(DEMO_DIR, "accounts.json"), "utf8"));
    expect(accounts).toHaveProperty("owner");
    expect(accounts).toHaveProperty("agent");
    expect(accounts).toHaveProperty("observer");
    for (const role of ["owner", "agent", "observer"]) {
      expect(accounts[role].token).toMatch(/^eyJ/); // JWT header prefix
      expect(accounts[role].token.split(".").length).toBe(3);
      expect(accounts[role].role).toBe(role);
    }
  });

  it("mcp-config.json для Claude Desktop валидный JSON с нужными keys", () => {
    const cfg = JSON.parse(readFileSync(path.join(DEMO_DIR, "mcp-config.json"), "utf8"));
    expect(cfg).toHaveProperty("mcpServers");
    const entries = Object.values(cfg.mcpServers);
    expect(entries.length).toBeGreaterThan(0);
    const first = entries[0];
    expect(first).toHaveProperty("command");
    expect(first).toHaveProperty("env");
    expect(first.env.IDF_TOKEN).toMatch(/^eyJ/);
  });

  it("принимает --domain чтобы заранее зафиксировать demo-domain в mcp-config", () => {
    rmSync(DEMO_DIR, { recursive: true, force: true });
    const res = runSetup(["--domain", "client-onboarding"]);
    expect(res.status).toBe(0);
    const cfg = JSON.parse(readFileSync(path.join(DEMO_DIR, "mcp-config.json"), "utf8"));
    const entries = Object.values(cfg.mcpServers);
    const hasDomain = entries.some(e => (e.env.IDF_DOMAIN === "client-onboarding")
      || (e.args || []).includes("--domain=client-onboarding")
      || (e.args || []).includes("client-onboarding"));
    expect(hasDomain).toBe(true);
  });

  it("--fresh реально очищает предыдущее содержимое", () => {
    // Создаём marker-файл, затем запускаем --fresh — он должен пропасть
    const { writeFileSync } = require("node:fs");
    writeFileSync(path.join(DEMO_DIR, "marker.txt"), "x");
    runSetup();
    expect(existsSync(path.join(DEMO_DIR, "marker.txt"))).toBe(false);
  });

  it("без --fresh сохраняет существующие файлы (non-destructive)", () => {
    const { writeFileSync, mkdirSync } = require("node:fs");
    mkdirSync(DEMO_DIR, { recursive: true });
    writeFileSync(path.join(DEMO_DIR, "custom.txt"), "preserved");
    spawnSync(
      "node",
      [path.join(REPO, "scripts/demo-env.mjs"), "--out", DEMO_DIR],
      { encoding: "utf8", timeout: 30000, cwd: REPO }
    );
    expect(existsSync(path.join(DEMO_DIR, "custom.txt"))).toBe(true);
    rmSync(DEMO_DIR, { recursive: true, force: true });
  });
});
