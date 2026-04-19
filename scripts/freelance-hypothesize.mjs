#!/usr/bin/env node
/**
 * Resume-mode для freelance-pattern-batch: Phase 2+3 для уже-extracted источников,
 * плюс fl.ru с нуля. Нужен после падения batch из-за 120s timeout.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractJSON, buildPrompt, callClaude, validateCandidate } from "./pattern-researcher.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROMPTS_DIR = join(__dirname, "prompts");
const REFS_DIR = join(__dirname, "..", "refs");

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function loadPrompt(name) {
  return readFileSync(join(PROMPTS_DIR, name), "utf-8");
}

function getExistingPatternsDescription() {
  return [
    "hero-create: catalog + intent creates mainEntity с confirmation enter/click",
    "phase-aware-primary-cta: detail + entity.status select ≥3 + replace .status",
    "subcollections: detail + sub-entity с foreignKey на mainEntity",
    "irreversible-confirm: cross + intent.irreversibility=high",
    "grid-card-layout: catalog + entity с image ИЛИ ≥3 money/percentage полей",
    "inline-search: cross + intent witnesses query+results, entities=[]",
    "composer-entry: feed + intent creates mainEntity, confirmation=enter",
    "vote-group: detail + ≥2 intent creates Entity(discriminator) одной base",
    "antagonist-toggle: feed + intent.antagonist парный intent",
    "footer-inline-setter: detail + 1-param replace на одном поле mainEntity",
  ].join("\n");
}

const FL_RU_DESCRIPTION = `FL.ru — классическая российская фриланс-биржа (с 2005 года). Модель: проектная доска + портфолио + платные PRO-аккаунты.

Экран "Лента проектов":
- Реверс-хронологический feed открытых проектов.
- Группировка по категориям: "Веб-разработка", "Дизайн", "Тексты", "Переводы", "3D-графика", "Аудио/видео".
- Карточка проекта: заголовок, бюджет ("от 10 000 ₽" или "договорная"), дедлайн, описание (truncate 3 строки), теги-скиллы, количество откликов, индикатор "только для PRO".
- Фильтры: категория, бюджет, только PRO-проекты, только безопасная сделка, только "с предоплатой".
- Некоторые проекты помечены "Проект дня" (promoted) — bleed-через-фон + star icon.

Экран "Детали проекта + отклики":
- Левая колонка: полное описание, бюджет, дедлайн, attachments (brief, mockups).
- Правая колонка: список откликов. Каждый отклик: аватар фрилансера, специализация, рейтинг (PRO-бейдж), предложенная цена, срок, сообщение. Клик → развернуть полное сообщение.
- Заказчик видит отклики сразу; фрилансер — только свой отклик и общее число.
- Actions: "Написать в ЛС", "Открыть профиль", "Пригласить в проект" (reverse: заказчик зовёт фрилансера, найденного в каталоге, в конкретный проект).
- State: "Открыт" / "В работе с фрилансером X" / "Завершён" / "Отменён".

Экран "Портфолио фрилансера":
- Hero: аватар, имя, специализация, PRO-бейдж (платный аккаунт), местоположение, рейтинг.
- Галерея работ: grid из preview-images. Клик → lightbox с описанием + тегами + годом + клиентом.
- Секция "Услуги и цены" — список прайс-позиций ("Landing page — от 30 000 ₽").
- Секция "Отзывы" — текстовые + звёзды + от какого проекта.
- Секция "Контакты" — видна только авторизованным / PRO-заказчикам.
- CTA: "Предложить проект", "Написать сообщение".

Экран "Каталог фрилансеров":
- Feed карточек фрилансеров с фильтром по специализации, городу, опыту.
- Карточка: аватар, специализация, 3 последние работы миниатюрами, рейтинг, PRO-бейдж.
- Sort: "По рейтингу", "Новые", "Онлайн сейчас".
- Фильтр "Онлайн сейчас" — online-presence как first-class property (derived from last-seen).

Экран "Создание проекта":
- Форма: категория → заголовок → описание → бюджет → дедлайн → приватность → attachments.
- Опциональные платные опции: "Поднять в топ", "Выделить цветом", "Только для PRO" (checkbox с доплатой).
- Publish → модерация → появляется в ленте.

Экран "Безопасная сделка":
- Опциональный escrow: "Включить безопасную сделку" toggle на проекте.
- Если включена — при выборе исполнителя средства блокируются; release при acceptance.
- Arbiter (moderator) при disputes.

Роли: заказчик, фрилансер, PRO-фрилансер (paid tier с extra visibility/leads), модератор, observer.`;

const EXTRACTED_SOURCES = [
  { source: "profi-ru-catalog", file: "2026-04-19-profi-ru-catalog.json" },
  { source: "workzilla-marketplace", file: "2026-04-19-workzilla-marketplace.json" },
  { source: "kwork-service-packages", file: "2026-04-19-kwork-service-packages.json" },
];

async function extractFlRu() {
  console.log(`\n═══════════ fl-ru-projects-board (Phase 1) ═══════════`);
  const template = loadPrompt("extract-domain-model.md");
  const prompt = buildPrompt(template, {
    INPUT_URL: "(не предоставлен)",
    INPUT_DESCRIPTION: FL_RU_DESCRIPTION,
    ARCHETYPE_HINT: "feed",
  });
  const started = Date.now();
  const response = await callClaude(prompt);
  const extractedModel = extractJSON(response);
  const mins = ((Date.now() - started) / 60000).toFixed(1);
  console.log(`  extract done in ${mins} min, entities: ${extractedModel.entities?.length}, intents: ${extractedModel.intents?.length}`);

  ensureDir(join(REFS_DIR, "extracted"));
  const path = join(REFS_DIR, "extracted", `${today()}-fl-ru-projects-board.json`);
  writeFileSync(path, JSON.stringify(extractedModel, null, 2));
  console.log(`  saved: ${path}`);
  return { source: "fl-ru-projects-board", model: extractedModel };
}

async function hypothesize(source, extractedModel) {
  console.log(`\n═══════════ ${source} (Phase 2+3) ═══════════`);
  const started = Date.now();
  const template = loadPrompt("hypothesize-pattern.md");
  const existingPatterns = getExistingPatternsDescription();
  const prompt = buildPrompt(template, {
    EXTRACTED_MODEL: JSON.stringify(extractedModel, null, 2),
    EXISTING_PATTERNS: existingPatterns,
    SOURCE_NAME: source,
  });

  const response = await callClaude(prompt);
  const candidateResponse = extractJSON(response);
  const mins = ((Date.now() - started) / 60000).toFixed(1);

  if (candidateResponse.covered?.length) {
    console.log(`  covered (${candidateResponse.covered.length}):`);
    for (const c of candidateResponse.covered) {
      console.log(`    ${c.observation} → ${c.coveredBy}`);
    }
  }

  const candidates = candidateResponse.candidates || [];
  console.log(`  hypothesize done in ${mins} min, ${candidates.length} candidate(s)`);

  ensureDir(join(REFS_DIR, "candidates"));
  for (const candidate of candidates) {
    candidate.status = "candidate";
    const report = validateCandidate(candidate);
    const mark = report.formatValid ? "✓" : `✗ ${report.formatError}`;
    const overlap = report.overlaps.length === 0 ? "✓" : `⚠ ${report.overlaps.join(", ")}`;
    console.log(`    ${candidate.id}: format ${mark}, overlap ${overlap}`);
    const path = join(REFS_DIR, "candidates", `${today()}-${source}-${candidate.id}.json`);
    writeFileSync(path, JSON.stringify(candidate, null, 2));
  }

  return { source, candidates };
}

async function main() {
  const startedAll = Date.now();
  console.log(`Freelance Pattern Resume — ${new Date().toISOString()}`);

  const results = [];

  // 1) fl-ru full pipeline (extract + hypothesize)
  let flRuExtract;
  try {
    flRuExtract = await extractFlRu();
  } catch (err) {
    console.error(`  fl-ru extract failed: ${err.message}`);
    results.push({ source: "fl-ru-projects-board", status: "extract-failed", error: err.message });
  }

  // 2) hypothesize для 4 источников
  const allSources = [...EXTRACTED_SOURCES];
  if (flRuExtract) {
    allSources.push({ source: flRuExtract.source, file: `${today()}-fl-ru-projects-board.json` });
  }

  for (const { source, file } of allSources) {
    const path = join(REFS_DIR, "extracted", file);
    if (!existsSync(path)) {
      console.error(`  skip ${source}: ${file} not found`);
      results.push({ source, status: "no-extract" });
      continue;
    }
    const model = JSON.parse(readFileSync(path, "utf-8"));
    try {
      const r = await hypothesize(source, model);
      results.push({ source, status: "ok", candidates: r.candidates.length });
    } catch (err) {
      console.error(`  ${source} hypothesize failed: ${err.message}`);
      results.push({ source, status: "hypothesize-failed", error: err.message });
    }
  }

  const totalMin = ((Date.now() - startedAll) / 60000).toFixed(1);
  console.log(`\n═══ RESUME DONE in ${totalMin} min ═══`);
  for (const r of results) {
    const mark = r.status === "ok" ? "✓" : "✗";
    const extra = r.candidates != null ? ` (${r.candidates} candidates)` : r.error ? ` — ${r.error}` : "";
    console.log(`  ${mark} ${r.source}: ${r.status}${extra}`);
  }
}

main().catch(err => {
  console.error("Resume crashed:", err);
  process.exit(1);
});
