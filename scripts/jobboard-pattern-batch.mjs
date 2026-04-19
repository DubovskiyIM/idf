#!/usr/bin/env node
/**
 * Pattern Bank batch для job-boards: LinkedIn Jobs, Indeed, hh.ru.
 * Источник описаний — ручной пре-промпт пользователя с анализом UX каждого.
 * Использует pattern-researcher.mjs (Phase 1-2-3), timeout 300s.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESEARCHER = join(__dirname, "pattern-researcher.mjs");

const SOURCES = [
  {
    name: "linkedin-jobs-mobile",
    archetype: "feed",
    description: `LinkedIn Jobs (mobile app, iOS/Android, 2025-2026). Часть социальной сети LinkedIn, но Jobs — отдельный "слой" поверх. Задаёт эталон мобильного UX для job-boards.

Навигация. Пять иконок в нижнем таб-баре: Home / My Network / Post / Notifications / Jobs. Стандартный мобильный bottom-tab pattern.

Экран Jobs (главный):
- Сверху крупная поисковая строка (What: role/keyword).
- Горизонтальные scrollable чипы-фильтры: Remote, Hybrid, Date posted, Experience level, Salary. Tap чип → live-apply.
- Feed карточек вакансий (реверс-хронологический + алгоритмический mix).
- Карточка вакансии: логотип компании, название роли, компания, локация, зарплатная вилка, бейджи "Easy Apply" / "Promoted" / "Actively recruiting" / "Top Applicant".
- Social proof прямо в карточке: "23 of your connections work here", "You have 85% skill match", имя рекрутера с фото.
- Промо-посты и "people you may know" вперемешку с вакансиями (feature bloat).

Карточка вакансии (detail):
- Hero: логотип + название + компания + зарплата + локация + тип (Remote/Hybrid/Onsite).
- Секции: Description (collapsible), About the company (с embedded лентой компании без перехода!), Employees who work here, Similar jobs.
- Primary CTA: "Easy Apply" (2-3 тапа: заполненный профиль → submit) или "Apply on company site" (внешняя форма).
- Skill match breakdown: "You match 7 of 10 required skills" с per-skill indicator.
- Bookmark / Save / Report / Share actions в вторичном меню.

Easy Apply flow (wizard):
- Step 1: contact info (pre-filled из профиля).
- Step 2: resume upload (default — профиль как PDF).
- Step 3: custom questions работодателя (если есть).
- Step 4: review & submit.
- Общая идея: профиль = заполненная форма, отклик = 2-3 тапа. Главный UX-сдвиг индустрии за 10 лет.

Подвкладки в My Jobs (детальная навигация):
- My Jobs / Preferences / Saved searches / Applied / Interviews. Логика между ними неочевидна — feature bloat, частый источник жалоб.

Профиль-как-резюме (Profile):
- Hero: фото, имя, headline, компания.
- Секции: About, Experience, Education, Skills (с endorsement-counter), Recommendations, Activity.
- Завершённость профиля показана %-прогрессом ("Your profile is 87% complete" с подсказками "Add 2 skills to reach 95%").

Премиум-апсейл (dark pattern):
- Заблюренные данные "кто смотрел ваш профиль" с CTA "Unlock with Premium".
- Счётчик "Top Applicant" — виден только Premium-подписчикам.
- Hover-cards на recruiter'ах с Premium-CTA "See full profile".

Роли: job-seeker (owner of profile + applications), recruiter (posts jobs, searches candidates), observer (не залогиненный — ограниченный доступ).

Ключевые intent'ы: search_jobs, apply_easy (single-click), apply_external (переход), save_job, save_search, follow_company, get_notified_about_search, view_applicant_insights (Premium-gated), send_inmail (Premium-gated).

Эталон. Five-tab bottom navigation. Easy Apply как single-tap action. Skill match percentage. Social proof в карточках. Premium dark patterns.`,
  },
  {
    name: "indeed-jobs-mobile",
    archetype: "feed",
    description: `Indeed (mobile app, iOS/Android, 2025-2026). Эталон минимализма среди job-boards. Крупнейший мировой объём вакансий.

Навигация. Bottom tab bar: Home / Find Jobs / Messages / My Jobs / Profile.

Домашний экран:
- Две гигантские строки поиска: "What" (job title, keyword, company) + "Where" (city, state, zip). Буквально полэкрана.
- Под ними — сетка рекомендаций "Jobs for you" (до 10 карточек).
- Раздел "Sponsored jobs" ниже (явно помечен как реклама).

Карточка вакансии — "самая чистая" в индустрии:
- Заголовок роли (bold).
- Компания + локация (одной строкой).
- Зарплата (если есть) — выделена цветом.
- 3-4 буллета описания (первые строки description).
- Рейтинг компании inline: звёзды + число отзывов ("4.2 ★ 1,287 reviews") — кликабельно, открывает отзывы.
- Кнопка Apply (single primary) + иконки Save / Share.

Detail-экран вакансии (progressive disclosure):
- Hero: заголовок + компания + локация + salary + badges (Full-time, Remote, Urgently hiring).
- Job description — полностью, с форматированием работодателя.
- "Benefits" / "Requirements" / "Responsibilities" как разделы (если работодатель заполнил).
- Секция "About the company": рейтинг, reviews, salaries ранее на этой роли.
- Кнопка Apply now — либо Quick Apply (пересылка Indeed-профиля), либо внешняя форма.

Сохранённые поиски:
- First-class фича: пользователь вводит запрос → кнопка "Save search" → даёт имя → подписка на push-уведомления о новых вакансиях.
- Список saved searches с возможностью отключить/удалить/переименовать, и badge на tab Find Jobs при новых.
- Один из редких случаев, когда push реально полезен (пользователь сам контролирует сигнал).

Компании (Company profile):
- Hero: логотип + название + headquarters + размер + industry.
- Рейтинг: общий + breakdown (Work-life balance / Compensation / Management / Culture / Opportunities).
- Reviews: список с фильтром (All / Positive / Negative / Former / Current employees).
- Salaries: средняя зарплата по ролям в компании (data from Indeed users).

Dark patterns / проблемы UX (явно обсуждаются в жалобах):
- App-install interstitials: при заходе на сайт всплывающее окно "Get better results in the app" блокирует UI, не даёт пользоваться сайтом без установки.
- AI-движок удаляет до 90% "нерелевантных" вакансий без возможности отключить — пользователи жалуются, что не могут увидеть весь список.
- Ghost-вакансии: вакансия висит месяцами, реальный найм не ведётся. Нет механизма репорта на просроченное.
- Слабая обратная связь после отклика: статус "viewed" и тишина месяцами. Трекер откликов визуально бедный.

Профиль (resume):
- Минимум полей: имя, email, phone, work experience, education, skills.
- "Your Indeed Resume" — единый документ, передаётся с каждым Quick Apply.
- Нет концепции "связей" / "endorsement" — чисто функциональное резюме.

Роли: seeker, employer (постит вакансии + ищет), observer.

Ключевые intent'ы: search_jobs (two-field), save_search, subscribe_to_search_notifications, apply_quick, apply_external, rate_company, leave_review, save_job, message_recruiter.

Эталон. Two-field search dominating screen. Inline company rating в карточке. Saved searches + push как first-class. App interstitial как anti-pattern.`,
  },
  {
    name: "hh-ru-mobile",
    archetype: "feed",
    description: `hh.ru / HeadHunter (mobile app, iOS/Android, 2025-2026). Крупнейший job-board русского рынка. Красно-белая айдентика.

Навигация. Bottom tab bar с 5 разделами: Поиск / Отклики / Сообщения / Избранное / Профиль.

Экран Поиск:
- Поисковая строка сверху (ищет по заголовку/компании).
- Чипы-фильтры: "Зарплата от", "Опыт работы", "График", "Удалёнка", "Тип занятости".
- Большая кнопка "Расширенный поиск" — открывает шторку с 15+ параметрами.
- Feed карточек вакансий.

Карточка вакансии:
- Заголовок роли, компания, локация.
- **Зарплатная вилка выделена жирным** (100 000 – 150 000 ₽).
- Бейджи: "Открытый работодатель" (верифицирован), "Готов к удалёнке", "Подходит по резюме".
- **Процент соответствия резюме:** "Подходит вам на 82%" — прямо в карточке, снижает cognitive load при скроллинге.
- Quick-action: "Откликнуться" / "В избранное".

Detail вакансии:
- Hero: заголовок + компания + salary + локация.
- Полное описание (с форматированием работодателя — часто некачественное).
- Требования, обязанности, условия.
- Информация о компании: размер, сайт, похожие вакансии.
- Primary CTA: "Откликнуться" (одним тапом, если резюме уже есть) → откроется модалка с выбором резюме (если их несколько) + optional сопроводительное письмо.

Раздел Отклики — один из лучших трекеров в категории:
- Табы: Все / Приглашения / Отказы / В архиве.
- Карточка отклика: вакансия + компания + дата отклика + текущий статус.
- **Воронка статусов**: Отправлено → Просмотрено → Приглашение / Отказ / Нет ответа.
- Таймлайн действий рекрутера внутри карточки: "2 апреля — просмотрел", "5 апреля — пригласил на собеседование".
- Push при смене статуса.

Раздел Сообщения:
- Интегрированный мессенджер с работодателями.
- Шаблоны ответов (pre-built responses): "Готов к собеседованию", "Удобное время для звонка?".
- Статусы прочтения (галочки, как в WhatsApp).
- Чат привязан к конкретному отклику: контекст вакансии всегда виден сверху.

Раздел Профиль / Резюме:
- Мастер создания резюме — пошаговый wizard с подсказками:
  - Шаг 1: персональные данные.
  - Шаг 2: желаемая должность + зарплата.
  - Шаг 3: опыт работы (с подсказками "опишите достижения в цифрах").
  - Шаг 4: образование.
  - Шаг 5: навыки (с подсказкой "популярные навыки для вашей должности").
  - Шаг 6: дополнительная информация (языки, водительские права, и т.д.).
- Контекстные подсказки по каждому полю (inline tooltip / help-bubble).
- Несколько резюме можно хранить одновременно (для разных типов работ).
- Кнопка "Проверка резюме" — скан через систему и выдача рекомендаций.

Проблемы UX (явно обсуждаются):
- Choice overload в расширенном поиске: 15+ параметров в одной шторке, дубли между базовым и расширенным.
- Визуальная плотность: много мелкого текста, форматирование вакансий от работодателя часто ломает layout.
- Монетизация через "Премиум-подписку" и "бусты резюме" — навязчивая, баннеры на главной и в откликах.
- Качество модерации: сетевой маркетинг и дубли.

Роли: соискатель, работодатель, observer.

Ключевые intent'ы: search_vacancies, apply (с выбором резюме + cover letter), save_to_favorites, send_message, create_resume (wizard), boost_resume (paid), receive_status_update, view_funnel.

Эталон. Match percentage в карточке ("82%"). Встроенный мессенджер как основной канал. Воронка откликов как visual funnel tracker. Wizard с контекстными подсказками для создания резюме.`,
  },
];

function run(source) {
  return new Promise((resolve, reject) => {
    const args = [
      RESEARCHER,
      "--source", source.name,
      "--description", source.description,
      "--archetype", source.archetype,
    ];
    const started = Date.now();
    console.log(`\n═══════════ ${source.name} ═══════════`);
    console.log(`  started at ${new Date().toISOString()}`);
    const proc = spawn("node", args, { stdio: ["ignore", "inherit", "inherit"] });
    proc.on("close", code => {
      const mins = ((Date.now() - started) / 60000).toFixed(1);
      console.log(`  ${source.name} finished in ${mins} min (exit ${code})`);
      if (code === 0) resolve({ source: source.name, minutes: mins });
      else reject(new Error(`${source.name} failed with exit ${code}`));
    });
    proc.on("error", reject);
  });
}

async function main() {
  const startedAll = Date.now();
  console.log(`Job-board Pattern Batch — ${new Date().toISOString()}`);
  console.log(`Sources: ${SOURCES.map(s => s.name).join(", ")}`);

  const results = [];
  for (const source of SOURCES) {
    try {
      const r = await run(source);
      results.push({ ...r, status: "ok" });
    } catch (err) {
      console.error(`  error: ${err.message}`);
      results.push({ source: source.name, status: "failed", error: err.message });
    }
  }

  const totalMin = ((Date.now() - startedAll) / 60000).toFixed(1);
  console.log(`\n═══ BATCH DONE in ${totalMin} min ═══`);
  for (const r of results) {
    console.log(`  ${r.status === "ok" ? "✓" : "✗"} ${r.source}${r.minutes ? ` (${r.minutes} min)` : ""}`);
  }
}

main().catch(err => {
  console.error("Batch crashed:", err);
  process.exit(1);
});
