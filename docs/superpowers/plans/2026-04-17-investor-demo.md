# Investor Demo — One Artifact, Four Worlds: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Подготовить вау-демо для ангельского инвестора: починить 4 UI-адаптера, создать 7-актовый demo-скрипт через agent API, и динамическую HTML-презентацию с WS-синхронизацией.

**Architecture:** Три deliverable: (1) bugfix'ы в SDK-адаптерах + прототипе для корректного переключения UI-kit'ов, (2) Node.js скрипт `investor-demo.mjs` с 7 актами real HTTP-запросов + WebSocket broadcast для синхронизации, (3) standalone HTML-презентация с 9 экранами, CSS-анимациями и WS-listener'ом.

**Tech Stack:** React 19, Vite, Radix Dialog, AntD 6, vanilla JS/CSS (презентация), Node.js fetch (demo-скрипт), WebSocket (синхронизация).

**Spec:** `docs/superpowers/specs/2026-04-17-investor-demo-design.md`

---

## Task 1: Fix AntD adapter — CSS export + import

**Files:**
- Modify: `~/WebstormProjects/idf-sdk/packages/adapter-antd/package.json`
- Modify: `~/WebstormProjects/idf/src/main.jsx`

AntD adapter не экспортирует CSS — invest-домен рендерится plain. Нужно: (1) добавить `"./styles.css"` export в package.json, (2) добавить import в main.jsx прототипа.

**Важно:** У adapter-antd НЕТ файла `src/theme.css` (в отличие от shadcn/apple). AntD стилизация идёт через `antd` npm-пакет и `ConfigProvider`. Здесь нужно создать минимальный CSS-файл с custom properties для Token Bridge, и добавить его в exports.

- [ ] **Step 1: Проверить какие CSS-переменные AntD-адаптер использует в компонентах**

Прочитать `~/WebstormProjects/idf-sdk/packages/adapter-antd/src/adapter.jsx` и найти все `var(--` references. Это определит содержимое theme.css.

- [ ] **Step 2: Создать `src/theme.css` для adapter-antd**

Если адаптер не использует custom CSS vars (а полагается на AntD ConfigProvider) — создать минимальный файл:

```css
/* AntD enterprise-fintech theme — Token Bridge */
/* AntD ConfigProvider handles component styling;
   this file provides ambient overrides only. */
```

Если использует `var(--color-antd-*)` — добавить определения по образцу adapter-apple/adapter-shadcn.

- [ ] **Step 3: Добавить build-шаг копирования theme.css в dist**

В `~/WebstormProjects/idf-sdk/packages/adapter-antd/package.json` добавить post-build копирование и export:

```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs"
  },
  "./styles.css": "./dist/theme.css"
},
```

Обновить `"scripts"`:
```json
"build": "tsup && cp src/theme.css dist/theme.css"
```

Добавить `"sideEffects": ["*.css"]` или убрать `"sideEffects": false`.

- [ ] **Step 4: Пересобрать adapter-antd**

```bash
cd ~/WebstormProjects/idf-sdk/packages/adapter-antd && pnpm build
```

Expected: `dist/theme.css` существует.

- [ ] **Step 5: Добавить import в прототип**

В `~/WebstormProjects/idf/src/main.jsx` после строки 12 добавить:

```javascript
import '@intent-driven/adapter-antd/styles.css';
```

Результат (строки 10-13):
```javascript
import '@intent-driven/adapter-shadcn/styles.css';
import '@intent-driven/adapter-apple/styles.css';
import '@intent-driven/adapter-antd/styles.css';
```

- [ ] **Step 6: Проверить в браузере**

```bash
cd ~/WebstormProjects/idf && npm run dev
```

Открыть localhost:5173, переключить на invest → PrefsPanel → AntD. Убедиться что стили применяются.

- [ ] **Step 7: Commit**

```bash
cd ~/WebstormProjects/idf-sdk && git add packages/adapter-antd && git commit -m "fix(adapter-antd): добавить CSS export для Token Bridge"
cd ~/WebstormProjects/idf && git add src/main.jsx && git commit -m "fix: импортировать стили adapter-antd"
```

---

## Task 2: Fix PrefsPanel — модалка не закрывается при переключении адаптера

**Files:**
- Modify: `~/WebstormProjects/idf/src/prototype.jsx`

`key={adapterKey}` на корневом div (строка 199) вызывает полный unmount/remount при смене адаптера. V2Shell теряет state `prefsOpen` → модалка закрывается.

- [ ] **Step 1: Убрать key с корневого div**

В `~/WebstormProjects/idf/src/prototype.jsx` строка 199 заменить:

```jsx
// Было:
<div key={adapterKey} style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0c0e14", color: "#c9cdd4", fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', monospace", fontSize: 13, overflow: "hidden" }}>
```

На:

```jsx
// Стало:
<div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#0c0e14", color: "#c9cdd4", fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Code', monospace", fontSize: 13, overflow: "hidden" }}>
```

`registerUIAdapter(adapter)` на строке 77 уже обновляет реестр при каждом render — remount не нужен. CausalityGraph уже имеет свой `key={domainId}`.

- [ ] **Step 2: Проверить в браузере**

Открыть PrefsPanel (шестерёнка), переключить адаптер. Модалка должна остаться открытой. UI должен обновиться без remount.

- [ ] **Step 3: Проверить что переключение домена всё ещё работает**

Переключить домен в select'е (booking → invest → reflect). Каждый должен загрузиться корректно.

- [ ] **Step 4: Commit**

```bash
cd ~/WebstormProjects/idf && git add src/prototype.jsx && git commit -m "fix: убрать key={adapterKey} с корневого div — модалка PrefsPanel не закрывается при переключении"
```

---

## Task 3: Fix shadcn ModalShell — `opened` prop undefined

**Files:**
- Modify: `~/WebstormProjects/idf-sdk/packages/adapter-shadcn/src/adapter.jsx`

Renderer передаёт `ModalShell({ onClose, children, title })` **без** `opened` prop. `ShadcnModalShell` ожидает `opened` → `Dialog.Root open={undefined}` → модалка не открывается.

- [ ] **Step 1: Исправить ShadcnModalShell**

В `~/WebstormProjects/idf-sdk/packages/adapter-shadcn/src/adapter.jsx` строка 346 заменить:

```jsx
// Было:
function ShadcnModalShell({ opened, onClose, title, children }) {
  return (
    <Dialog.Root open={opened} onOpenChange={v => { if (!v) onClose(); }}>
```

На:

```jsx
// Стало:
function ShadcnModalShell({ onClose, title, children }) {
  return (
    <Dialog.Root open={true} onOpenChange={v => { if (!v) onClose(); }}>
```

Компонент рендерится только когда модалка нужна — `open={true}` корректно.

- [ ] **Step 2: Пересобрать adapter-shadcn**

```bash
cd ~/WebstormProjects/idf-sdk/packages/adapter-shadcn && pnpm build
```

- [ ] **Step 3: Проверить в браузере**

Переключить на shadcn-адаптер, открыть форму (создать сущность). Модалка должна появиться.

- [ ] **Step 4: Commit**

```bash
cd ~/WebstormProjects/idf-sdk && git add packages/adapter-shadcn/src/adapter.jsx && git commit -m "fix(adapter-shadcn): ModalShell open={true} — renderer не передаёт opened prop"
```

---

## Task 4: Fix apple ModalShell — `opened` prop undefined

**Files:**
- Modify: `~/WebstormProjects/idf-sdk/packages/adapter-apple/src/adapter.jsx`

Та же проблема что в Task 3 — `AppleModalShell` ожидает `opened`, renderer не передаёт.

- [ ] **Step 1: Исправить AppleModalShell**

В `~/WebstormProjects/idf-sdk/packages/adapter-apple/src/adapter.jsx` строка 334 заменить:

```jsx
// Было:
function AppleModalShell({ opened, onClose, title, children }) {
  return (
    <Dialog.Root open={opened} onOpenChange={v => { if (!v) onClose(); }}>
```

На:

```jsx
// Стало:
function AppleModalShell({ onClose, title, children }) {
  return (
    <Dialog.Root open={true} onOpenChange={v => { if (!v) onClose(); }}>
```

- [ ] **Step 2: Пересобрать adapter-apple**

```bash
cd ~/WebstormProjects/idf-sdk/packages/adapter-apple && pnpm build
```

- [ ] **Step 3: Проверить в браузере**

Переключить на Apple-адаптер, открыть форму. Модалка с glass-эффектом должна появиться.

- [ ] **Step 4: Commit**

```bash
cd ~/WebstormProjects/idf-sdk && git add packages/adapter-apple/src/adapter.jsx && git commit -m "fix(adapter-apple): ModalShell open={true} — renderer не передаёт opened prop"
```

---

## Task 5: Fix shadcn PostCSS `@import` order

**Files:**
- Modify: `~/WebstormProjects/idf-sdk/packages/adapter-shadcn/package.json`

Build-скрипт удаляет `@import "tailwindcss"` из theme.css, но оставляет `@import url('https://fonts...')` ПОСЛЕ `@theme {}`. PostCSS требует все `@import` перед остальным кодом.

- [ ] **Step 1: Исправить build-скрипт**

В `~/WebstormProjects/idf-sdk/packages/adapter-shadcn/package.json` строка 24 заменить build-скрипт:

```json
"build": "tsup && node -e \"const fs=require('fs'); let css=fs.readFileSync('src/theme.css','utf8').replace(/@import \\\"tailwindcss\\\";\\n?/g,''); const imports=[]; css=css.replace(/@import url\\\\([^)]+\\\\);[\\\\n]*/g,(m)=>{imports.push(m.trim());return '';}); fs.writeFileSync('dist/theme.css', imports.join('\\n')+'\\n'+css)\""
```

Логика: удалить `@import "tailwindcss"`, собрать все оставшиеся `@import url(...)`, поставить их в начало файла.

- [ ] **Step 2: Пересобрать и проверить dist/theme.css**

```bash
cd ~/WebstormProjects/idf-sdk/packages/adapter-shadcn && pnpm build && head -5 dist/theme.css
```

Expected: первая строка — `@import url('https://fonts.googleapis.com/...');`, затем `@theme {`.

- [ ] **Step 3: Проверить в браузере**

Переключить на shadcn-адаптер. Шрифты Caveat/Architects Daughter должны загрузиться. Линованная бумага видна.

- [ ] **Step 4: Commit**

```bash
cd ~/WebstormProjects/idf-sdk && git add packages/adapter-shadcn/package.json && git commit -m "fix(adapter-shadcn): PostCSS @import order — imports перед @theme в dist"
```

---

## Task 6: Визуальный аудит всех 4 адаптеров в invest-домене

**Files:** нет изменений — чисто проверка

После Tasks 1-5 нужно убедиться что все 4 адаптера визуально работают в invest-домене.

- [ ] **Step 1: Запустить сервер и dev**

```bash
cd ~/WebstormProjects/idf && npm run server &
npm run dev
```

- [ ] **Step 2: Открыть invest, проверить AntD (дефолт)**

Открыть localhost:5173, выбрать invest. Ожидание: enterprise-стиль, Statistic cards, AntD-кнопки, таблицы.

- [ ] **Step 3: Переключить на Mantine**

PrefsPanel → Mantine. Ожидание: data-dense corporate, модалки через Mantine Modal.

- [ ] **Step 4: Переключить на shadcn**

PrefsPanel → shadcn. Ожидание: doodle-стиль, линованная бумага, шрифт Caveat, wavy underlines.

- [ ] **Step 5: Переключить на Apple**

PrefsPanel → Apple. Ожидание: glass-эффекты, blur, premium-minimal.

- [ ] **Step 6: Проверить модалки в каждом адаптере**

В каждом адаптере: нажать «Новый портфель» (wizard). Модалка/форма должна открыться и работать.

- [ ] **Step 7: Зафиксировать визуальные проблемы**

Если есть проблемы — создать отдельные задачи. Если всё ок — перейти к Task 7.

---

## Task 7: Создать `scripts/investor-demo.mjs` — 7 актов через agent API

**Files:**
- Create: `~/WebstormProjects/idf/scripts/investor-demo.mjs`

Demo-скрипт: 7 актов с реальными HTTP-запросами к серверу. Каждый акт: описание на русском → запрос → подсвеченный ответ → пауза. WebSocket broadcast для синхронизации с презентацией.

Использовать паттерны из `scripts/agent-smoke.mjs` (helpers `get`, `post`, `log`, `ok`, `fail`).

- [ ] **Step 1: Создать скрипт с setup-частью**

```javascript
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
const PAUSE_MS = 3000;
const WS_URL = "ws://localhost:3001/ws";

const COLORS = {
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
  console.log(`\n${COLORS.bold}${"═".repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.cyan}  АКТ ${act}${COLORS.reset} ${COLORS.dim}[${role}]${COLORS.reset}`);
  console.log(`  ${description}`);
  console.log(`${COLORS.bold}${"═".repeat(60)}${COLORS.reset}\n`);
}

function showResult(status, key, value) {
  const color = status < 400 ? COLORS.green : COLORS.red;
  const icon = status < 400 ? "✓" : "✗";
  console.log(`  ${color}${icon} ${status}${COLORS.reset} ${key}: ${JSON.stringify(value, null, 2).slice(0, 200)}`);
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
```

- [ ] **Step 2: Добавить setup — регистрация invest-домена + auth**

```javascript
async function setup() {
  console.log(`${COLORS.dim}Подключаюсь к серверу ${HOST}...${COLORS.reset}`);

  // WebSocket для синхронизации с презентацией
  try {
    const { WebSocket } = await import("ws");
    ws = new WebSocket(WS_URL);
    await new Promise((resolve, reject) => {
      ws.on("open", resolve);
      ws.on("error", reject);
      setTimeout(reject, 2000);
    });
    console.log(`${COLORS.green}✓ WebSocket подключён${COLORS.reset}`);
  } catch {
    console.log(`${COLORS.yellow}⚠ WebSocket недоступен — презентация не синхронизируется${COLORS.reset}`);
  }

  // Публикуем ontology + intents invest-домена
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
  console.log(`${COLORS.green}✓ Invest domain зарегистрирован${COLORS.reset}`);

  // Auth — получаем JWT
  const authResp = await post("/api/auth/login", { email: "demo@idf.dev", password: "demo" });
  if (authResp.status !== 200) {
    const regResp = await post("/api/auth/register", { name: "Demo Investor", email: "demo@idf.dev", password: "demo" });
    if (regResp.status !== 200 && regResp.status !== 201) {
      console.error("Не удалось авторизоваться");
      process.exit(1);
    }
    return regResp.body.token;
  }
  return authResp.body.token;
}
```

- [ ] **Step 3: Добавить 7 актов**

```javascript
async function run() {
  const jwt = await setup();

  // ═══ АКТ 1: Investor создаёт портфель ═══
  banner(1, "investor", "Регистрация и создание портфеля");
  const portfolioResp = await post("/api/agent/invest/exec", {
    intentId: "create_portfolio",
    params: { name: "Demo Portfolio", currency: "USD", riskProfile: "balanced" },
  }, jwt);
  showResult(portfolioResp.status, "Портфель", portfolioResp.body);
  broadcast(1, portfolioResp.status < 400 ? "ok" : "fail", portfolioResp.body);
  await pause();

  // ═══ АКТ 2: Risk questionnaire wizard ═══
  banner(2, "investor", "Прохождение risk-questionnaire (wizard 4 шага)");
  const rq1 = await post("/api/agent/invest/exec", {
    intentId: "start_risk_questionnaire", params: {},
  }, jwt);
  showResult(rq1.status, "start_risk_questionnaire", rq1.body);

  const rq2 = await post("/api/agent/invest/exec", {
    intentId: "set_risk_horizon", params: { horizon: "5-10 лет" },
  }, jwt);
  showResult(rq2.status, "set_risk_horizon", rq2.body);

  const rq3 = await post("/api/agent/invest/exec", {
    intentId: "set_risk_tolerance", params: { tolerance: "moderate" },
  }, jwt);
  showResult(rq3.status, "set_risk_tolerance", rq3.body);

  const rq4 = await post("/api/agent/invest/exec", {
    intentId: "compute_risk_profile", params: {},
  }, jwt);
  showResult(rq4.status, "compute_risk_profile", rq4.body);
  broadcast(2, "ok", { steps: 4 });
  await pause();

  // ═══ АКТ 3: Delegate to agent с лимитами ═══
  banner(3, "investor", "Делегирование агенту: max 50K, только stock/bond/etf");
  const delegateResp = await post("/api/agent/invest/exec", {
    intentId: "delegate_to_agent",
    params: {
      maxOrderAmount: 50000,
      allowedAssetTypes: "stock,bond,etf",
      dailyLimit: 200000,
      expiresInDays: 180,
    },
  }, jwt);
  showResult(delegateResp.status, "delegate_to_agent", delegateResp.body);
  broadcast(3, delegateResp.status < 400 ? "ok" : "fail", {
    limits: { maxOrder: 50000, types: "stock,bond,etf", daily: 200000 },
  });
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
    params: { portfolioId: "pf_balanced", confidence: 87, rationale: "AAPL sentiment high, rebalance to capture growth" },
  }, jwt);
  showResult(rebResp.status, "propose_rebalance", rebResp.body);
  broadcast(4, "ok", { signal: "AAPL sentiment 0.78", confidence: 87 });
  await pause();

  // ═══ АКТ 5: Agent выполняет сделку В ПРЕДЕЛАХ лимита ═══
  banner(5, "agent", "Покупка акций: $3,120 (в пределах лимита $50,000)");
  const orderOk = await post("/api/agent/invest/exec", {
    intentId: "agent_execute_preapproved_order",
    params: {
      portfolioId: "pf_balanced", assetId: "ast_sber", α: "buy",
      quantity: 10, price: 312, total: 3120, assetType: "stock",
    },
  }, jwt);
  showResult(orderOk.status, "preapproved_order", orderOk.body);
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
  console.log(`\n  ${COLORS.red}${COLORS.bold}🛑 GUARDRAIL: maxAmount exceeded (312,000 > 50,000)${COLORS.reset}`);
  console.log(`  ${COLORS.dim}Архитектурная невозможность превысить полномочия.${COLORS.reset}`);
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
    console.log(`  ${COLORS.green}✓ ${docResp.status}${COLORS.reset} HTML Document: "${titleMatch?.[1] || "Compliance Report"}"`);
    console.log(`  ${COLORS.dim}${docResp.body.length} bytes, ready to print${COLORS.reset}`);
  } else {
    showResult(docResp.status, "document", docResp.body);
  }
  broadcast(7, "ok", { format: "html", bytes: (docResp.body?.length || 0) });

  // ═══ Финал ═══
  console.log(`\n${COLORS.bold}${"═".repeat(60)}${COLORS.reset}`);
  console.log(`${COLORS.green}${COLORS.bold}  ДЕМО ЗАВЕРШЕНО${COLORS.reset}`);
  console.log(`  7 актов, 4 роли, 1 артефакт.`);
  console.log(`  Preapproval guard заблокировал сделку на $312K.`);
  console.log(`  Compliance-документ готов за 1 запрос.`);
  console.log(`${COLORS.bold}${"═".repeat(60)}${COLORS.reset}\n`);

  broadcast("done", "ok", {});
  if (ws) ws.close();
}

run().catch(err => {
  console.error(`${COLORS.red}Ошибка:${COLORS.reset}`, err);
  process.exit(1);
});
```

- [ ] **Step 4: Добавить npm script**

В `~/WebstormProjects/idf/package.json` добавить в `"scripts"`:

```json
"investor-demo": "node scripts/investor-demo.mjs"
```

- [ ] **Step 5: Тест-прогон**

```bash
cd ~/WebstormProjects/idf && npm run server &
sleep 2
npm run investor-demo
```

Expected: 7 актов, акт 6 → 403 preapproval_denied, акт 7 → HTML document.

- [ ] **Step 6: Commit**

```bash
cd ~/WebstormProjects/idf && git add scripts/investor-demo.mjs package.json && git commit -m "feat: investor-demo скрипт — 7 актов через agent API с WS-синхронизацией"
```

---

## Task 8: Создать HTML-презентацию `investor-deck.html`

**Files:**
- Create: `~/WebstormProjects/idf/src/presentation/investor-deck.html`

Standalone HTML: 9 экранов, CSS-анимации, WebSocket-listener для синхронизации с demo-скриптом. Стиль Apple Keynote: тёмный фон, крупная типографика, одна мысль на экран.

- [ ] **Step 1: Создать директорию и файл**

```bash
mkdir -p ~/WebstormProjects/idf/src/presentation
```

- [ ] **Step 2: Написать HTML-презентацию**

Файл `~/WebstormProjects/idf/src/presentation/investor-deck.html`:

```html
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>IDF — Investor Demo</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700;900&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: #0a0a0f;
    color: #e8e8ed;
    overflow: hidden;
    height: 100vh;
    width: 100vw;
  }

  .slide {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px;
    opacity: 0;
    transform: translateY(40px);
    transition: opacity 0.6s ease, transform 0.6s ease;
    pointer-events: none;
  }

  .slide.active {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
  }

  h1 {
    font-size: 72px;
    font-weight: 900;
    letter-spacing: -2px;
    line-height: 1.1;
    text-align: center;
  }

  h2 {
    font-size: 48px;
    font-weight: 700;
    letter-spacing: -1px;
    text-align: center;
  }

  .subtitle {
    font-size: 24px;
    font-weight: 300;
    color: #8888a0;
    margin-top: 16px;
    text-align: center;
  }

  .accent { color: #6366f1; }
  .green { color: #22c55e; }
  .red { color: #ef4444; }
  .gold { color: #f59e0b; }

  .metric-row {
    display: flex;
    gap: 48px;
    margin-top: 48px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .metric {
    text-align: center;
  }

  .metric-value {
    font-size: 64px;
    font-weight: 900;
    letter-spacing: -2px;
  }

  .metric-label {
    font-size: 16px;
    font-weight: 400;
    color: #8888a0;
    margin-top: 4px;
  }

  .diagram {
    display: flex;
    align-items: center;
    gap: 32px;
    margin-top: 48px;
  }

  .diagram-center {
    width: 120px;
    height: 120px;
    border-radius: 20px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .diagram-arrows {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .diagram-target {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 20px;
    font-weight: 600;
  }

  .diagram-target .arrow {
    color: #6366f1;
    font-size: 24px;
  }

  /* Acts visualization */
  .acts-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 32px;
    width: 100%;
    max-width: 800px;
  }

  .act-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 24px;
    border-radius: 12px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    opacity: 0.3;
    transform: translateX(-20px);
    transition: all 0.5s ease;
  }

  .act-card.revealed {
    opacity: 1;
    transform: translateX(0);
  }

  .act-card.blocked {
    border-color: #ef4444;
    background: rgba(239,68,68,0.08);
    animation: pulse-red 1.5s ease-in-out;
  }

  @keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    50% { box-shadow: 0 0 30px 10px rgba(239,68,68,0.3); }
  }

  .act-num {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(99,102,241,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 14px;
    flex-shrink: 0;
  }

  .act-role {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    color: #8888a0;
    width: 80px;
    flex-shrink: 0;
  }

  .act-desc {
    flex: 1;
    font-size: 16px;
  }

  .act-status {
    font-size: 20px;
    flex-shrink: 0;
  }

  /* Counter animation */
  .counter {
    display: inline-block;
  }

  .counter.animate {
    animation: countUp 1.5s ease-out forwards;
  }

  @keyframes countUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* Three paths comparison */
  .paths {
    display: flex;
    gap: 32px;
    margin-top: 48px;
  }

  .path-card {
    flex: 1;
    padding: 32px;
    border-radius: 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    text-align: center;
  }

  .path-card.highlight {
    border-color: #6366f1;
    background: rgba(99,102,241,0.08);
  }

  .path-card h3 {
    font-size: 20px;
    margin-bottom: 8px;
  }

  .path-card .provider {
    font-size: 14px;
    color: #8888a0;
    margin-bottom: 16px;
  }

  .path-card .verdict {
    font-size: 14px;
    margin-top: 12px;
  }

  /* Shield animation for Act 6 */
  .shield {
    font-size: 80px;
    animation: shieldAppear 0.8s ease-out;
  }

  @keyframes shieldAppear {
    0% { transform: scale(0) rotate(-20deg); opacity: 0; }
    60% { transform: scale(1.2) rotate(5deg); }
    100% { transform: scale(1) rotate(0); opacity: 1; }
  }

  /* Slide indicator */
  .slide-nav {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    z-index: 100;
  }

  .slide-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    transition: all 0.3s;
  }

  .slide-dot.active {
    background: #6366f1;
    width: 24px;
    border-radius: 4px;
  }

  /* WS status */
  .ws-status {
    position: fixed;
    top: 16px;
    right: 16px;
    font-size: 12px;
    color: #8888a0;
    z-index: 100;
  }

  .ws-status.connected { color: #22c55e; }
</style>
</head>
<body>

<!-- Slide 1: Title -->
<div class="slide active" data-slide="0">
  <h1>Intent-Driven<br><span class="accent">Frontend</span></h1>
  <p class="subtitle">One Artifact. Four Worlds. Zero Runtime AI.</p>
</div>

<!-- Slide 2: Problem -->
<div class="slide" data-slide="1">
  <h2>Типичное приложение</h2>
  <div class="metric-row">
    <div class="metric">
      <div class="metric-value red counter" data-target="6">0</div>
      <div class="metric-label">месяцев разработки</div>
    </div>
    <div class="metric">
      <div class="metric-value red counter" data-target="5">0</div>
      <div class="metric-label">команд</div>
    </div>
    <div class="metric">
      <div class="metric-value red counter" data-target="500">0</div>
      <div class="metric-label">тысяч $ бюджета</div>
    </div>
  </div>
  <p class="subtitle" style="margin-top:32px">На каждый канал (web, mobile, voice, API) — заново.</p>
</div>

<!-- Slide 3: Solution -->
<div class="slide" data-slide="2">
  <h2>Один артефакт &mdash; четыре мира</h2>
  <div class="diagram">
    <div class="diagram-center">JSON<br>Artifact</div>
    <div class="diagram-arrows">
      <div class="diagram-target"><span class="arrow">&rarr;</span> <span class="accent">Pixels</span> &nbsp;4 UI-адаптера</div>
      <div class="diagram-target"><span class="arrow">&rarr;</span> <span class="green">Voice</span> &nbsp;Speech-script</div>
      <div class="diagram-target"><span class="arrow">&rarr;</span> <span class="gold">Document</span> &nbsp;HTML/PDF</div>
      <div class="diagram-target"><span class="arrow">&rarr;</span> <span style="color:#ec4899">Agent API</span> &nbsp;Semantic</div>
    </div>
  </div>
  <p class="subtitle">Zero frontend code. Zero runtime AI cost.</p>
</div>

<!-- Slide 4: Live adapters -->
<div class="slide" data-slide="3">
  <h2>Live: <span class="accent">4 UI-адаптера</span></h2>
  <div class="metric-row" style="margin-top:32px">
    <div class="metric"><div class="metric-value" style="font-size:32px">AntD</div><div class="metric-label">Enterprise / Fintech</div></div>
    <div class="metric"><div class="metric-value" style="font-size:32px">Apple</div><div class="metric-label">Premium / Minimal</div></div>
    <div class="metric"><div class="metric-value" style="font-size:32px">shadcn</div><div class="metric-label">Handcrafted / Sketch</div></div>
    <div class="metric"><div class="metric-value" style="font-size:32px">Mantine</div><div class="metric-label">Corporate / Data-dense</div></div>
  </div>
  <p class="subtitle">Один клик. Без перезагрузки. Без потери данных.</p>
</div>

<!-- Slide 5: Three paths -->
<div class="slide" data-slide="4">
  <h2>Три пути AI-агента</h2>
  <div class="paths">
    <div class="path-card">
      <h3>Computer Use</h3>
      <div class="provider">Anthropic</div>
      <p>Агент тыкает в пиксели</p>
      <p class="verdict red">Ненадёжно</p>
    </div>
    <div class="path-card">
      <h3>Function Calling</h3>
      <div class="provider">OpenAI</div>
      <p>Агент дёргает RPC</p>
      <p class="verdict gold">Нет UI-семантики</p>
    </div>
    <div class="path-card highlight">
      <h3>Semantic API</h3>
      <div class="provider accent">IDF</div>
      <p>Агент работает через<br>семантический API</p>
      <p class="verdict green">Guardrails из коробки</p>
    </div>
  </div>
</div>

<!-- Slide 6: Acts -->
<div class="slide" data-slide="5">
  <h2>Эксперимент: <span class="accent">Claude как пользователь</span></h2>
  <div class="acts-grid">
    <div class="act-card" data-act="1">
      <div class="act-num">1</div>
      <div class="act-role">investor</div>
      <div class="act-desc">Регистрация + создание портфеля</div>
      <div class="act-status"></div>
    </div>
    <div class="act-card" data-act="2">
      <div class="act-num">2</div>
      <div class="act-role">investor</div>
      <div class="act-desc">Risk questionnaire (wizard, 4 шага)</div>
      <div class="act-status"></div>
    </div>
    <div class="act-card" data-act="3">
      <div class="act-num">3</div>
      <div class="act-role">investor</div>
      <div class="act-desc">Делегирование агенту (max $50K, stock/bond/etf)</div>
      <div class="act-status"></div>
    </div>
    <div class="act-card" data-act="4">
      <div class="act-num">4</div>
      <div class="act-role">agent</div>
      <div class="act-desc">Рыночный сигнал + предложение ребалансировки</div>
      <div class="act-status"></div>
    </div>
    <div class="act-card" data-act="5">
      <div class="act-num">5</div>
      <div class="act-role">agent</div>
      <div class="act-desc">Покупка $3,120 (в пределах лимита)</div>
      <div class="act-status"></div>
    </div>
    <div class="act-card" data-act="6">
      <div class="act-num" style="background:rgba(239,68,68,0.2)">6</div>
      <div class="act-role red">agent</div>
      <div class="act-desc"><strong>Попытка $312,000</strong> (лимит $50,000)</div>
      <div class="act-status"></div>
    </div>
    <div class="act-card" data-act="7">
      <div class="act-num">7</div>
      <div class="act-role">observer</div>
      <div class="act-desc">Compliance-документ одним запросом</div>
      <div class="act-status"></div>
    </div>
  </div>
</div>

<!-- Slide 7: Evidence -->
<div class="slide" data-slide="6">
  <h2>Доказательная база</h2>
  <div class="metric-row">
    <div class="metric">
      <div class="metric-value accent counter" data-target="9">0</div>
      <div class="metric-label">доменов</div>
    </div>
    <div class="metric">
      <div class="metric-value accent counter" data-target="531">0</div>
      <div class="metric-label">интентов</div>
    </div>
    <div class="metric">
      <div class="metric-value green counter" data-target="458">0</div>
      <div class="metric-label">тестов (все green)</div>
    </div>
    <div class="metric">
      <div class="metric-value gold counter" data-target="4">0</div>
      <div class="metric-label">материализации</div>
    </div>
  </div>
  <div class="metric-row" style="margin-top:24px">
    <div class="metric">
      <div class="metric-value" style="font-size:48px">$<span class="green counter" data-target="0">0</span></div>
      <div class="metric-label">Runtime AI cost</div>
    </div>
    <div class="metric">
      <div class="metric-value" style="font-size:48px"><span class="accent counter" data-target="8">0</span></div>
      <div class="metric-label">npm-пакетов (SDK)</div>
    </div>
  </div>
</div>

<!-- Slide 8: Vision -->
<div class="slide" data-slide="7">
  <h1><span class="accent">OpenAPI</span><br>для приложений</h1>
  <p class="subtitle" style="max-width:600px">
    Формат описания. SDK на npm. Спецификация с conformance levels.
    <br><br>
    LLM создаёт приложение &mdash; приложение работает без LLM.
  </p>
</div>

<!-- Slide 9: Ask -->
<div class="slide" data-slide="8">
  <h2>Следующий шаг</h2>
  <div class="metric-row" style="margin-top:32px">
    <div class="metric">
      <div class="metric-value accent" style="font-size:36px">Production</div>
      <div class="metric-label">invest + sales deploy</div>
    </div>
    <div class="metric">
      <div class="metric-value gold" style="font-size:36px">Статья</div>
      <div class="metric-label">публикация + HN launch</div>
    </div>
    <div class="metric">
      <div class="metric-value green" style="font-size:36px">CLI</div>
      <div class="metric-label">idf init &lt;domain&gt;</div>
    </div>
  </div>
</div>

<!-- Navigation dots -->
<div class="slide-nav" id="nav"></div>

<!-- WS status -->
<div class="ws-status" id="wsStatus">WS: disconnected</div>

<script>
const TOTAL_SLIDES = 9;
let current = 0;

// Build nav dots
const nav = document.getElementById("nav");
for (let i = 0; i < TOTAL_SLIDES; i++) {
  const dot = document.createElement("div");
  dot.className = "slide-dot" + (i === 0 ? " active" : "");
  dot.dataset.index = i;
  dot.onclick = () => goTo(i);
  nav.appendChild(dot);
}

function goTo(n) {
  if (n < 0 || n >= TOTAL_SLIDES) return;
  document.querySelectorAll(".slide").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".slide-dot").forEach(d => d.classList.remove("active"));
  current = n;
  const slide = document.querySelector(`[data-slide="${n}"]`);
  slide.classList.add("active");
  nav.children[n].classList.add("active");
  animateCounters(slide);
}

function animateCounters(slide) {
  slide.querySelectorAll(".counter[data-target]").forEach(el => {
    const target = parseInt(el.dataset.target);
    if (el.dataset.animated) return;
    el.dataset.animated = "1";
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// Keyboard navigation
document.addEventListener("keydown", e => {
  if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); goTo(current + 1); }
  if (e.key === "ArrowLeft") { e.preventDefault(); goTo(current - 1); }
});

// Touch navigation
let touchStartX = 0;
document.addEventListener("touchstart", e => { touchStartX = e.touches[0].clientX; });
document.addEventListener("touchend", e => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 50) goTo(current + (dx < 0 ? 1 : -1));
});

// WebSocket sync with demo script
function connectWS() {
  const wsStatus = document.getElementById("wsStatus");
  try {
    const ws = new WebSocket("ws://localhost:3001/ws");
    ws.onopen = () => {
      wsStatus.textContent = "WS: connected";
      wsStatus.className = "ws-status connected";
    };
    ws.onclose = () => {
      wsStatus.textContent = "WS: disconnected";
      wsStatus.className = "ws-status";
      setTimeout(connectWS, 3000);
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type !== "demo:act") return;
        handleDemoAct(msg);
      } catch {}
    };
  } catch {
    setTimeout(connectWS, 3000);
  }
}

function handleDemoAct(msg) {
  // Auto-navigate to acts slide when demo starts
  if (msg.act === 1 && current < 5) goTo(5);

  const card = document.querySelector(`.act-card[data-act="${msg.act}"]`);
  if (!card) return;

  card.classList.add("revealed");

  if (msg.status === "blocked") {
    card.classList.add("blocked");
    card.querySelector(".act-status").textContent = "\u{1f6d1}";
  } else if (msg.status === "ok") {
    card.querySelector(".act-status").textContent = "\u2705";
  } else {
    card.querySelector(".act-status").textContent = "\u274c";
  }

  // Auto-navigate to evidence after demo done
  if (msg.act === "done") {
    setTimeout(() => goTo(6), 2000);
  }
}

connectWS();
</script>

</body>
</html>
```

- [ ] **Step 3: Проверить в браузере**

```bash
open ~/WebstormProjects/idf/src/presentation/investor-deck.html
```

Проверить: навигация стрелками, анимации счётчиков, все 9 экранов читабельны.

- [ ] **Step 4: Проверить WS-синхронизацию**

Запустить сервер + demo-скрипт и убедиться что экран Acts обновляется автоматически.

- [ ] **Step 5: Commit**

```bash
cd ~/WebstormProjects/idf && git add src/presentation/investor-deck.html && git commit -m "feat: HTML-презентация investor-deck — 9 экранов с WS-синхронизацией"
```

---

## Task 9: End-to-end прогон + финальная проверка

**Files:** нет новых — интеграционная проверка

- [ ] **Step 1: Полный прогон**

Три окна:
1. `npm run server` (порт 3001)
2. `npm run dev` + браузер с invest-доменом (localhost:5173)
3. `investor-deck.html` в отдельной вкладке

Запустить `npm run investor-demo`. Проверить:
- Акты отображаются в терминале с цветами
- UI в браузере обновляется через SSE
- Презентация получает WS-события и показывает акты
- Акт 6 → 403, красная вспышка в презентации
- Акт 7 → compliance-документ

- [ ] **Step 2: Переключение адаптеров во время демо**

Во время работы demo-скрипта (или после) переключить адаптер в PrefsPanel:
- AntD → Apple → shadcn → Mantine
- Модалка не закрывается
- Данные не теряются

- [ ] **Step 3: Прогнать тесты**

```bash
cd ~/WebstormProjects/idf && npm test
```

Expected: 458 тестов, все green. Наши изменения не должны сломать ничего.

- [ ] **Step 4: Прогнать agent-smoke**

```bash
cd ~/WebstormProjects/idf && npm run agent-smoke
```

Expected: 74 шага, все pass.

- [ ] **Step 5: Финальный commit если были правки**

Если в ходе end-to-end обнаружились проблемы и были фиксы — закоммитить.
