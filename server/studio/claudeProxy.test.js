import { describe, it, expect, vi } from "vitest";
const { EventEmitter } = require("events");
const { spawnClaude, translate } = require("./claudeProxy.js");

describe("translate", () => {
  it("handles system init", () => {
    const evts = translate(JSON.stringify({ type: "system", subtype: "init", session_id: "abc" }));
    expect(evts).toEqual([{ type: "session_id", id: "abc" }]);
  });

  it("handles assistant text delta", () => {
    const evts = translate(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hi" }] } }));
    expect(evts).toEqual([{ type: "text", delta: "hi" }]);
  });

  it("handles tool_use", () => {
    const evts = translate(JSON.stringify({
      type: "assistant",
      message: { content: [{ type: "tool_use", id: "t1", name: "Edit", input: { file_path: "x.js" } }] },
    }));
    expect(evts).toEqual([{ type: "tool_use", id: "t1", name: "Edit", input: { file_path: "x.js" } }]);
  });

  it("returns empty for unknown types", () => {
    expect(translate("not json")).toEqual([]);
    expect(translate(JSON.stringify({ type: "unknown" }))).toEqual([]);
  });
});

describe("spawnClaude", () => {
  it("builds correct CLI args and streams parsed JSON lines", async () => {
    const stdoutEmitter = new EventEmitter();
    const stderrEmitter = new EventEmitter();
    const fakeChild = Object.assign(new EventEmitter(), {
      stdout: stdoutEmitter,
      stderr: stderrEmitter,
      kill: vi.fn(),
    });
    const spawnMock = vi.fn(() => fakeChild);

    const events = [];
    const proc = spawnClaude({
      domain: "booking",
      message: "hi",
      spawn: spawnMock,
      onEvent: (evt) => events.push(evt),
    });

    stdoutEmitter.emit("data", Buffer.from(JSON.stringify({ type: "system", subtype: "init", session_id: "abc" }) + "\n"));
    stdoutEmitter.emit("data", Buffer.from(JSON.stringify({ type: "assistant", message: { content: [{ type: "text", text: "hello" }] } }) + "\n"));
    fakeChild.emit("close", 0);
    await proc.done;

    const args = spawnMock.mock.calls[0][1];
    expect(args).toContain("--print");
    expect(args).toContain("--output-format");
    expect(args).toContain("stream-json");
    expect(args).toContain("--verbose");
    expect(args[args.length - 1]).toBe("hi");

    expect(events.find((e) => e.type === "session_id" && e.id === "abc")).toBeDefined();
    expect(events.find((e) => e.type === "text" && e.delta === "hello")).toBeDefined();
    expect(events.find((e) => e.type === "close")).toBeDefined();
  });
});
