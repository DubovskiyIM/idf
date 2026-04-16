const { spawn: nodeSpawn, spawnSync } = require("child_process");
const { systemPrompt } = require("./systemPrompt.js");

function resolveClaudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const candidates = [
    `${process.env.HOME}/.local/bin/claude`,
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ];
  for (const p of candidates) {
    try {
      const fs = require("fs");
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  try {
    const which = spawnSync("which", ["claude"], {
      env: { ...process.env, PATH: `${process.env.PATH || ""}:${process.env.HOME}/.local/bin:/usr/local/bin:/opt/homebrew/bin` },
    });
    const out = (which.stdout || "").toString().trim();
    if (out && out.startsWith("/")) return out;
  } catch {}
  return "claude";
}

const CLAUDE_BIN = resolveClaudeBin();

function parseAssistantMessage(msg) {
  const events = [];
  for (const part of msg?.content || []) {
    if (part.type === "text" && part.text) {
      events.push({ type: "text", delta: part.text });
    } else if (part.type === "tool_use") {
      events.push({ type: "tool_use", id: part.id, name: part.name, input: part.input });
    }
  }
  return events;
}

function parseUserMessage(msg) {
  const events = [];
  for (const part of msg?.content || []) {
    if (part.type === "tool_result") {
      events.push({
        type: "tool_result",
        tool_use_id: part.tool_use_id,
        success: !part.is_error,
        content: part.content,
      });
    }
  }
  return events;
}

function translate(line) {
  let obj;
  try { obj = JSON.parse(line); } catch { return []; }
  if (obj.type === "system" && obj.subtype === "init") return [{ type: "session_id", id: obj.session_id }];
  if (obj.type === "assistant") return parseAssistantMessage(obj.message);
  if (obj.type === "user") return parseUserMessage(obj.message);
  if (obj.type === "result") return [{ type: "done", usage: obj.usage, result: obj.result }];
  return [];
}

function spawnClaude({ domain, message, sessionId, cwd, onEvent, spawn = nodeSpawn }) {
  const args = [
    "--print",
    "--output-format", "stream-json",
    "--verbose",
    "--append-system-prompt", systemPrompt(domain),
    "--allowedTools", "Read,Edit,Write,Glob,Grep,Bash(npm test:*)",
    "--permission-mode", "acceptEdits",
    "--max-turns", "20",
  ];
  if (sessionId) args.push("--resume", sessionId);
  args.push(message);

  const env = {
    ...process.env,
    PATH: `${process.env.PATH || ""}:${process.env.HOME}/.local/bin:/usr/local/bin:/opt/homebrew/bin`,
  };
  const child = spawn(CLAUDE_BIN, args, { cwd: cwd || process.cwd(), env });
  try { child.stdin?.end(); } catch {}
  let buf = "";
  child.stdout.on("data", (chunk) => {
    buf += chunk.toString("utf8");
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      for (const evt of translate(line)) onEvent(evt);
    }
  });
  child.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    console.error("[studio/claude stderr]", text);
    onEvent({ type: "stderr", text });
  });
  const done = new Promise((resolve) => {
    child.on("close", (code) => { onEvent({ type: "close", code }); resolve({ code }); });
    child.on("error", (err) => {
      console.error("[studio/claude spawn error]", err);
      onEvent({ type: "error", message: `spawn error: ${err.message} (CLAUDE_BIN=${CLAUDE_BIN})` });
      resolve({ error: err });
    });
  });

  return { child, done, stop: () => child.kill("SIGTERM") };
}

module.exports = { spawnClaude, translate };
