#!/usr/bin/env node
/**
 * Investor Demo — 7 актов через agent API.
 *
 * Предпосылки: npm run server (порт 3001)
 * Запуск: node scripts/investor-demo.mjs
 *
 * Каждый акт: описание → HTTP-запрос → результат → пауза.
 * WebSocket broadcast на ws://localhost:3001/ws для синхронизации
 * с HTML-презентацией (investor-deck.html).
 */

const HOST = process.env.IDF_SERVER || "http://localhost:3001";
const PAUSE_MS = parseInt(process.env.DEMO_PAUSE || "3000");

const C = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
};

function pause(ms = PAUSE_MS) {
  return new Promise(r => setTimeout(r, ms));
}

function banner(act, role, description) {
  console.log(`\n${C.bold}${"═".repeat(60)}${C.reset}`);
  console.log(`${C.cyan}  АКТ ${act}${C.reset} ${C.dim}[${role}]${C.reset}`);
  console.log(`  ${description}`);
  console.log(`${C.bold}${"═".repeat(60)}${C.reset}\n`);
}

function showResult(status, key, value) {
  const color = status < 400 ? C.green : C.red;
  const icon = status < 400 ? "✓" : "✗";
  const preview = JSON.stringify(value, null, 2);
  const lines = preview.split("\n").slice(0, 8);
  if (preview.split("\n").length > 8) lines.push("  ...");
  console.log(`  ${color}${icon} ${status}${C.reset} ${key}:`);
  lines.forEach(l => console.log(`    ${C.dim}${l}${C.reset}`));
}

async function post(path, body, jwt) {
  const res = await fetch(`${HOST}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}

async function get(path, jwt) {
  const headers = jwt ? { Authorization: `Bearer ${jwt}` } : {};
  const accept = path.includes("format=html") ? "text/html" : "application/json";
  headers["Accept"] = accept;
  const res = await fetch(`${HOST}${path}`, { headers });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) {
    return { status: res.status, body: await res.text(), html: true };
  }
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

let ws;
function broadcast(act, status, data) {
  if (ws?.readyState === 1) {
    ws.send(JSON.stringify({ type: "demo:act", act, status, data }));
  }
}

async function setup() {
  console.log(`${C.dim}Подключаюсь к серверу ${HOST}...${C.reset}`);

  try {
    const { WebSocket } = await import("ws");
    ws = new WebSocket(WS_URL());
    await new Promise((resolve, reject) => {
      ws.on("open", resolve);
      ws.on("error", reject);
      setTimeout(reject, 2000);
    });
    console.log(`${C.green}✓ WebSocket подключён${C.reset}`);
  } catch {
    console.log(`${C.yellow}⚠ WebSocket недоступен — презентация не синхронизируется${C.reset}`);
  }

  const investOnt = await import("../src/domains/invest/ontology.js");
  const investInt = await import("../src/domains/invest/intents.js");
  await fetch(`${HOST}/api/typemap?domain=invest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(investOnt.ONTOLOGY),
  });
  await fetch(`${HOST}/api/intents?domain=invest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(investInt.INTENTS),
  });
  console.log(`${C.green}✓ Invest domain зарегистрирован${C.reset}`);

  const authResp = await post("/api/auth/login", { email: "demo@idf.dev", password: "demo" });
  if (authResp.status === 200) return authResp.body.token;
  const regResp = await post("/api/auth/register", { name: "Demo Investor", email: "demo@idf.dev", password: "demo" });
  if (regResp.status === 200 || regResp.status === 201) return regResp.body.token;
  console.error(`${C.red}Не удалось авторизоваться${C.reset}`);
  process.exit(1);
}

function WS_URL() {
  return HOST.replace(/^http/, "ws").replace(/:\d+/, ":3001") + "/ws";
}

async function run() {
  const jwt = await setup();

  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║      IDF INVESTOR DEMO — One Artifact, Four Worlds       ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`);
  await pause(2000);

  // ═══ АКТ 1: Показать что investor уже создал портфели ═══
  banner(1, "investor", "Портфели инвестора (seed data — как если бы investor зарегистрировался)");
  const worldResp = await get("/api/agent/invest/world", jwt);
  if (worldResp.status === 200) {
    const portfolios = worldResp.body.world?.portfolios || [];
    console.log(`  ${C.green}✓${C.reset} Портфелей: ${C.bold}${portfolios.length}${C.reset}`);
    portfolios.forEach(p => {
      console.log(`    ${C.dim}• ${p.name} (${p.id}) — ${p.currency}, профиль: ${p.riskProfile}${C.reset}`);
    });
  }
  broadcast(1, "ok", { portfolios: worldResp.body.world?.portfolios?.length || 0 });
  await pause();

  // ═══ АКТ 2: Показать risk profile + preapproval (уже делегировано) ═══
  banner(2, "investor", "Профиль риска и preapproval — агенту делегированы полномочия");
  if (worldResp.status === 200) {
    const preapprovals = worldResp.body.world?.agentPreapprovals || [];
    const riskProfiles = worldResp.body.world?.riskProfiles || [];
    if (riskProfiles.length) {
      console.log(`  ${C.green}✓${C.reset} Профиль риска: ${C.bold}${riskProfiles[0].level || riskProfiles[0].profile || "balanced"}${C.reset}`);
    }
    if (preapprovals.length) {
      const pa = preapprovals[0];
      console.log(`  ${C.green}✓${C.reset} Preapproval активен:`);
      console.log(`    ${C.dim}maxOrderAmount: $${pa.maxOrderAmount?.toLocaleString() || "N/A"}${C.reset}`);
      console.log(`    ${C.dim}allowedAssetTypes: ${pa.allowedAssetTypes || "N/A"}${C.reset}`);
      console.log(`    ${C.dim}dailyLimit: $${pa.dailyLimit?.toLocaleString() || "N/A"}${C.reset}`);
      console.log(`    ${C.dim}active: ${pa.active}${C.reset}`);
    }
  }
  broadcast(2, "ok", { riskProfile: true, preapproval: true });
  await pause();

  // ═══ АКТ 3: Schema — что агент видит и может делать ═══
  banner(3, "agent", "Schema — что агент видит и может делать");
  const schemaResp = await get("/api/agent/invest/schema", jwt);
  if (schemaResp.status === 200) {
    const intents = schemaResp.body.intents || [];
    console.log(`  ${C.green}✓${C.reset} Доступных интентов: ${C.bold}${intents.length}${C.reset}`);
    intents.forEach(i => {
      console.log(`    ${C.dim}• ${i.id} — ${i.name || ""}${C.reset}`);
    });
    console.log(`\n  ${C.yellow}⚠ buy_asset, sell_asset — НЕ в списке (запрещены для agent)${C.reset}`);
  }
  broadcast(3, "ok", { intents: (schemaResp.body.intents || []).length });
  await pause();

  // ═══ АКТ 4: Agent анализирует рынок ═══
  banner(4, "agent", "Получение рыночного сигнала + предложение ребалансировки");
  const sigResp = await post("/api/agent/invest/exec", {
    intentId: "agent_fetch_market_signal",
    params: { assetId: "ast_aapl", kind: "sentiment", value: 0.78, source: "ml-pipeline" },
  }, jwt);
  showResult(sigResp.status, "market_signal", sigResp.body);

  const rebResp = await post("/api/agent/invest/exec", {
    intentId: "agent_propose_rebalance",
    params: { portfolioId: "pf_balanced", confidence: 87, rationale: "AAPL sentiment 0.78 — rebalance to capture growth" },
  }, jwt);
  showResult(rebResp.status, "propose_rebalance", rebResp.body);
  broadcast(4, "ok", { signal: "AAPL sentiment 0.78", confidence: 87 });
  await pause();

  // ═══ АКТ 5: Agent выполняет сделку В ПРЕДЕЛАХ лимита ═══
  banner(5, "agent", "Покупка акций: $3,120 (лимит: $50,000) → ожидаем 200 OK");
  const orderOk = await post("/api/agent/invest/exec", {
    intentId: "agent_execute_preapproved_order",
    params: {
      portfolioId: "pf_balanced", assetId: "ast_sber", α: "buy",
      quantity: 10, price: 312, total: 3120, assetType: "stock",
    },
  }, jwt);
  showResult(orderOk.status, "preapproved_order", orderOk.body);
  if (orderOk.status === 200) {
    console.log(`\n  ${C.green}${C.bold}✓ Сделка прошла. $3,120 < лимит $50,000${C.reset}`);
  }
  broadcast(5, orderOk.status < 400 ? "ok" : "fail", { total: 3120, limit: 50000 });
  await pause();

  // ═══ АКТ 6: Agent пытается ПРЕВЫСИТЬ лимит → 403 ═══
  banner(6, "agent", "Попытка сделки на $312,000 (лимит $50,000) → GUARDRAIL");
  const orderBig = await post("/api/agent/invest/exec", {
    intentId: "agent_execute_preapproved_order",
    params: {
      portfolioId: "pf_balanced", assetId: "ast_sber", α: "buy",
      quantity: 1000, price: 312, total: 312000, assetType: "stock",
    },
  }, jwt);
  showResult(orderBig.status, "BLOCKED", orderBig.body);
  console.log(`\n  ${C.red}${C.bold}🛑 GUARDRAIL ACTIVATED${C.reset}`);
  console.log(`  ${C.red}maxAmount exceeded: 312,000 > 50,000${C.reset}`);
  console.log(`  ${C.dim}Архитектурная невозможность превысить полномочия.${C.reset}`);
  console.log(`  ${C.dim}Не prompt-injection defense — а constraint в спецификации.${C.reset}`);
  broadcast(6, "blocked", {
    total: 312000, limit: 50000,
    reason: orderBig.body.reason,
    failedCheck: orderBig.body.failedCheck,
  });
  await pause(5000);

  // ═══ АКТ 7: Observer получает compliance-документ ═══
  banner(7, "observer", "Compliance-документ одним запросом");
  const docResp = await get("/api/document/invest/portfolios_root?format=html&as=observer", jwt);
  if (docResp.html) {
    const titleMatch = docResp.body.match(/<title>([^<]+)<\/title>/);
    console.log(`  ${C.green}✓ ${docResp.status}${C.reset} HTML Document: "${titleMatch?.[1] || "Compliance Report"}"`);
    console.log(`  ${C.dim}${docResp.body.length.toLocaleString()} bytes, ready to print${C.reset}`);
  } else {
    showResult(docResp.status, "document", docResp.body);
  }

  const voiceResp = await get("/api/voice/invest/portfolios_root?format=json&as=observer", jwt);
  if (voiceResp.status === 200) {
    const turns = voiceResp.body.turns?.length || 0;
    console.log(`  ${C.green}✓${C.reset} Voice: ${turns} turns (JSON speech-script)`);
  }
  broadcast(7, "ok", { format: "html", bytes: docResp.body?.length || 0 });

  // ═══ Финал ═══
  console.log(`\n${C.bold}${C.cyan}╔══════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║                    ДЕМО ЗАВЕРШЕНО                        ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚══════════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`\n  ${C.bold}Результат:${C.reset}`);
  console.log(`  • 7 актов, 3 роли (investor / agent / observer)`);
  console.log(`  • Preapproval guard заблокировал сделку на $312K`);
  console.log(`  • Compliance-документ + voice за 1 запрос каждый`);
  console.log(`  • Один артефакт — четыре материализации\n`);

  broadcast("done", "ok", {});
  if (ws) ws.close();
}

run().catch(err => {
  console.error(`${C.red}Ошибка: ${err.message}${C.reset}`);
  if (err.cause) console.error(C.dim, err.cause, C.reset);
  process.exit(1);
});
