#!/usr/bin/env node
/**
 * Pattern Bank batch для доменов с наименьшим покрытием в refs/extracted/.
 *
 * Охват (3 домена × 3 эталонных приложения = 9 sources):
 *   booking   — Calendly, Cal.com, YClients
 *   messenger — WhatsApp, Telegram, Slack
 *   invest    — Robinhood, Tinkoff Investments, Interactive Brokers
 *
 * Использует pattern-researcher.mjs (Phase 1-2-3). По аналогии с
 * jobboard-pattern-batch.mjs: описания — ручной пре-промпт с UX-аналитикой.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESEARCHER = join(__dirname, "pattern-researcher.mjs");

const SOURCES = [
  // ══════════════════════════ BOOKING ══════════════════════════
  {
    name: "calendly-scheduling",
    archetype: "feed",
    description: `Calendly (web + mobile, 2025-2026). Эталон асимметричного scheduling: host публикует event-type, гость выбирает слот без регистрации. Задаёт UX-стандарт для 1:1 встреч в B2B.

Ключевая асимметрия: host (account) vs booker (одноразовый, без логина).

Экран host-а:
- Dashboard: список Event Types карточками — "30-min meeting", "Intro call 15 min", "Weekly sync". Каждая карточка = настроенный template (длительность, voc-policy, интеграция с календарём).
- Availability rules: weekly-recurring schedule (Mon-Fri 9-17), buffer time, date overrides, holidays.
- Calendar integrations: Google / Outlook / iCloud — host соединяет свой календарь, Calendly автоматически скрывает занятые слоты.
- Round-robin и collective event-types (для команд): "ближайший свободный из A/B/C".

Экран booker-а (public link calendly.com/username/30min):
- Hero: имя host, аватар, описание event-type, длительность.
- Календарная сетка месяца — доступные даты подсвечены, недоступные приглушены.
- Выбор даты → колонка слотов по 30 минут. Слот — primary CTA.
- После выбора слота — форма: Name, Email, optional custom questions (host настраивает).
- Confirm → email с ICS + ссылка "Reschedule / Cancel" (stateless token).

Workflow автоматизации:
- Pre-meeting email (за день до), reminders (за 10 минут), post-meeting follow-up.
- Условные branches: "если booker выбрал X, отправить Y".
- Интеграции: Zoom/Google Meet автоматически генерирует ссылку и кладёт в invite.

Payments (paid event-types):
- Host может включить Stripe/PayPal: booker оплачивает перед подтверждением слота.
- No-show policy: авто-списание депозита если не пришёл (настраивается).

Analytics:
- Bookings by event-type, no-show rate, most-booked times, lead source.
- Export в CSV.

Роли: host (owner), booker (guest, не нужен аккаунт), teammate (для team plans, делит event-types).

Ключевые intent'ы: create_event_type, set_availability, connect_calendar, share_booking_link, book_slot (guest), reschedule (stateless), cancel (stateless), capture_payment, export_analytics.

Эталон. Stateless guest booking через public link. Event Type как first-class template. Calendar overlay с автоматическим скрытием занятых слотов. Weekly-recurring + date-override как availability rules.`,
  },
  {
    name: "cal-com-scheduling",
    archetype: "feed",
    description: `Cal.com (web + mobile, 2025-2026). Open-source аналог Calendly. Эталон self-hosted scheduling с прицелом на разработчиков и enterprise.

Дифференциатор от Calendly — extensibility (app store), team-heavy, embeds.

Home dashboard:
- Bookings tab: Upcoming / Past / Pending / Cancelled — с фильтрами по event-type и team member.
- Event Types tab: карточки с per-type настройками; поддержка групповых events (multi-host).
- Availability tab: несколько schedules (working, on-call, vacation) — переключаются per-event-type.
- Teams tab: organization → teams → members. Collective event-types.

Event Type config (богатая форма):
- Basic: название, длительность, локация (in-person / link / Phone / custom).
- Advanced: min notice, limit bookings per day/week, require confirmation.
- Apps: Zoom, Meet, Daily.co, Around, Riverside — выбор в dropdown.
- Workflows: auto-SMS, auto-email, webhook, custom scripts.
- Round-robin settings: distribution algorithm (load-balanced / optimal / custom).
- Booking questions: text, phone, email, multiselect — host конструирует форму как form-builder.

Booking page (booker view):
- Встраиваемый iframe / popup / inline embed — developer-friendly.
- Календарь с dark-mode.
- Slot-picker с временной зоной booker-а (auto-detect или manual).
- После выбора — multi-step form (host настраивает steps) → confirm.

App Store (marketplace):
- 80+ интеграций: Google/Outlook calendars, video, payments, CRM, routing.
- Install/uninstall как плагины с per-app config.
- Developer API для собственных интеграций.

Routing forms (enterprise):
- Pre-booking questionnaire: "What's your budget?", "Team size?" → routing rule → правильный host.
- Salesforce/HubSpot lookup для верификации лида перед бронированием.

Insights:
- Team analytics: booked rate per member, no-show rate, average meeting length.
- Funnel: page-visit → slot-selected → booked → attended.

Роли: owner, team admin, team member (host), booker, developer (API key).

Ключевые intent'ы: create_event_type, configure_workflow, install_app, set_availability_override, enable_round_robin, share_embed, book_slot (guest), confirm_booking (host-moderated), fetch_insights.

Эталон. Multi-schedule availability (working / on-call / vacation). Routing form → host lookup до бронирования. App store как плагин-модель. Embed (iframe / popup) как first-class distribution channel.`,
  },
  {
    name: "yclients-booking",
    archetype: "feed",
    description: `YClients (web + mobile, 2025-2026). Эталон B2B2C booking для beauty / wellness / services в РФ. Двусторонняя платформа: салон управляет, клиент бронирует.

Две ортогональные роли: администратор салона (рабочее место), клиент (мобильное приложение).

Рабочее место администратора (desktop):
- Журнал записи — гибрид Kanban и календаря: по вертикали сотрудники (columns), по горизонтали время (rows, 15-мин grid).
- Drag-drop: перенос записи между мастерами / временными слотами.
- Cell state: свободно / занято (клиент + услуга + длительность) / перерыв / отсутствие.
- Правый клик по ячейке → quick-create "Добавить запись".
- Боковая панель: сегодняшние записи списком, фильтр по мастеру.

Клиент (карточка CRM):
- История посещений, предпочтения, заметки администратора.
- Аллергии / противопоказания (для медицинских услуг).
- Скидки, программы лояльности, баланс бонусов.
- Блокировка (блеклист клиентов).

Каталог услуг:
- Категории (маникюр / педикюр / окрашивание), длительность, стоимость.
- Привязка к сотрудникам: кто может оказывать эту услугу.
- Расходные материалы (списание со склада автоматически).

Онлайн-запись (public widget):
- Iframe / QR-код / ссылка — встраивается на сайт салона.
- Шаги: выбор услуги → выбор мастера (или "любой свободный") → выбор даты и времени → контакт + phone verify → confirm.
- Клиент видит только доступные слоты (по availability мастера и занятости).

Мобильное приложение клиента (white-label + "YClients кабинет"):
- Список "Мои записи": предстоящие + история.
- Уведомления о подтверждении / напоминании (за день / час).
- Отмена / перенос через "Мои записи".
- Оценка услуги после визита: звёзды + отзыв + фото результата.

Модули pro-тарифов:
- Склад: учёт расходников, закупки, инвентаризация.
- Касса: оплата услуги в записи, кассовые смены, ФФД / 54-ФЗ.
- Зарплата мастеров: процент от услуги, премии, оклад.
- Аналитика: конверсия, LTV, средний чек, воронка записей.

Уведомления:
- SMS / push / WhatsApp / Telegram — админ настраивает шаблоны.
- Триггеры: создание записи, напоминание, подтверждение, отмена.

Роли: администратор салона (owner), мастер (provider, видит свой график), клиент (booker), наблюдатель (owner без прав изменения).

Ключевые intent'ы: create_appointment, reassign_appointment (drag-drop), block_time, mark_no_show, charge_visit, record_consumable_usage, send_reminder, review_visit, accrue_loyalty.

Эталон. Vertical-resource × time-grid как основной canvas. Drag-drop перенос между мастерами. White-label booking widget. Интеграция с кассой / складом / зарплатой как модули. Multi-channel уведомления с настраиваемыми шаблонами.`,
  },

  // ══════════════════════════ MESSENGER ══════════════════════════
  {
    name: "whatsapp-mobile",
    archetype: "feed",
    description: `WhatsApp (mobile, iOS/Android, 2025-2026). Массовый мессенджер. 2+ млрд MAU. Задаёт бытовой стандарт chat UX.

Навигация (iOS): нижний tab bar — Updates / Calls / Communities / Chats / Settings.
Навигация (Android): верхний tab strip — Chats / Updates / Communities / Calls.

Экран Chats (главный):
- Список бесед отсортирован reverse-chronological (последнее сообщение сверху).
- Строка беседы: аватар + имя + preview текста (1 строка) + время + badge непрочитанных (зелёный).
- Pinned chats — до 3 прикреплённых сверху.
- Swipe-actions: архивировать (влево), прочитать (вправо).
- Floating action button "+" для нового чата.

Окно беседы (1:1):
- Header: аватар + имя + статус "Online" / "last seen at 14:32".
- Backdrop: обои (пользователь выбирает или дефолт).
- Сообщения как bubbles: свои справа (зелёные), чужие слева (белые/серые).
- Status ticks у своих сообщений: ✓ (sent) / ✓✓ (delivered) / ✓✓ синие (read).
- Composer снизу: текст + эмодзи + attachment (+) + voice-record (hold).
- Attachment: фото / видео / документ / контакт / локация / опрос / GIF / стикер.
- Reply: swipe вправо по сообщению → composer с quote.
- Reactions: long-press → 6 quick-reactions + "+" для любой эмодзи.
- Forward: select → forward arrow → multi-recipient picker.

Group chat:
- До 1024 участников (2024+).
- Admin может: добавлять / удалять / делать админом / ограничивать отправку только админам.
- @mention в групповом → уведомление даже если чат mute.
- Disappearing messages: per-chat timer (24h / 7d / 90d).

Status (Stories):
- Полноэкранные фото/видео на 24 часа — видны контактам по умолчанию.
- Privacy: "My contacts except..." / "Only share with...".
- Viewer list — host видит кто смотрел.

Voice / Video calls:
- End-to-end encryption.
- Group calls до 32 участников.
- Call history в табе Calls.

Communities (2023+):
- Иерархия: community → announcement group + до 100 sub-groups.
- Админ пишет в announcement → приходит всем подписчикам.

Channels (2023+):
- One-to-many broadcast (админ → followers, followers не видят друг друга).
- Emoji-реакции, опросы, картинки/видео.

Роли: user (owner of own messages), group admin, channel owner, community admin.

Ключевые intent'ы: send_message, react_to_message, reply_to_message, forward_message, delete_for_everyone (2-hour window), mark_unread, archive_chat, mute_chat, create_group, promote_admin, start_voice_call, start_video_call, post_status, view_status.

Эталон. Tick-based delivery ticker. Swipe-to-reply. Long-press reactions. Disappearing messages per-chat timer. E2E encryption как baseline. Voice-message через hold-to-record. Stories (Status) как ephemeral broadcast. Channels as one-way broadcast.`,
  },
  {
    name: "telegram-mobile",
    archetype: "feed",
    description: `Telegram (mobile, iOS/Android, 2025-2026). Эталон feature-rich мессенджера с каналами, ботами, cloud-first архитектурой.

Навигация: bottom tab bar (iOS) — Contacts / Calls / Chats / Settings. Chats — главный экран.

Chats:
- Folders — пользователь группирует чаты в custom folders (Work / Family / Channels). Tabs сверху.
- Архив автосвайп: mute-chats отправляются в Archive автоматически.
- Pinned chats (до 5).
- Drafts сохраняются в облаке (открыл на другом устройстве — черновик там).

Окно беседы (1:1 / group):
- Cloud-first: все сообщения в облаке, доступны на всех устройствах мгновенно.
- Messages: текст, форматирование (bold / italic / spoiler / code / link), до 4000 символов.
- Edit в любое время (для своих), до 48 часов (2023+) — бесконечно (2024+).
- Reactions: 30+ кастомных эмодзи-пакетов + emoji.
- Reply с quote (частичный текст), Reply to one specific user in topic (форумы).
- Forward: с подписью автора или без ("hide source").
- Scheduled messages — отправить в N часов.
- Silent message — без push уведомления.

Attachments:
- Фото / видео / документ (до 2 ГБ / 4 ГБ Premium).
- Стикеры (pack-based, free + premium).
- GIF — встроенный search.
- Голос / кружок (video-message).
- Опрос (anonymous / non-anonymous / quiz / multi-choice).

Channels (broadcast):
- One-to-many, followers не видят друг друга.
- Подписчики до миллионов.
- Post formatting, scheduled posts, reactions, comments (через discussion group).
- Auto-delete: posts удаляются через N дней (новое).

Groups:
- До 200 000 участников.
- Topics (forum mode) — subchannels внутри большой группы.
- Admin rights: granular (post / edit / pin / ban / add / remove / invite).
- Slow mode — один message per user per N seconds.

Bots:
- First-class bot API: inline mode, commands, custom keyboards, webapps, payments.
- Mini-apps (WebApps) — полноценные приложения внутри чата (Stars / TON payments).

Secret chats:
- E2E encrypted, per-device, self-destruct timer, no forward.

Telegram Premium:
- 4 ГБ upload, custom emoji, reactions, voice-to-text, folders, profile badges.

Роли: user, group admin (granular rights), channel owner, bot (API-only), premium user.

Ключевые intent'ы: send_message, schedule_message, edit_message (48h+), delete_message (for me / everyone), react_to_message, reply_to_message, forward_message (with/without author), create_channel, create_group, create_topic, pin_message, mute_chat, use_bot_command, open_webapp, subscribe_channel, manage_stars_payment.

Эталон. Cloud-first (мгновенный cross-device). Folders + archive. Scheduled messages + silent send. Editable messages. Reactions с кастомными эмодзи. Channels / Groups / Forum topics как три разных масштаба broadcast. Bot API + WebApps как платформа.`,
  },
  {
    name: "slack-desktop",
    archetype: "feed",
    description: `Slack (desktop + mobile, 2025-2026). Эталон рабочего мессенджера. Workspace-centric, channel-first.

Навигация (desktop): левый sidebar — Workspace switcher / Home / DMs / Activity / Later / More. В Home — дерево channels + DMs + applications.

Channels (каналы):
- Public (#general, #random) — доступны всем в workspace.
- Private (🔒) — только по приглашению.
- Shared channels — между двумя workspaces (Slack Connect).
- Каналы сгруппированы по sections (Starred / Unreads / Announcements / Projects) — user настраивает.

Окно канала:
- Header: название + purpose + pinned items + список участников.
- Список сообщений reverse-chronological, сгруппирован по дням.
- Threads: ответ в thread не засоряет канал → sidebar с thread-replies.
- Composer снизу: rich-text formatting (bold / italic / bullet / code / блок / quote / emoji).
- Slash commands: /remind, /dm, /away, /topic, /giphy, /poll.
- Bookmarks внутри канала (canvas + docs + links).
- Canvas (2023+) — встроенный документ для долгоживущих заметок.

Сообщение (rich):
- Attachments: файлы, ссылки с preview, снипеты кода (syntax highlighting), блоки из bot API (buttons / selects / modals).
- Reactions: emoji — выводят счётчик + список пользователей при hover.
- "Save for later" — откладывает в Later tab.
- Thread reply / reply in channel.
- Share to another channel — with optional comment.

Huddles (2022+):
- Аудио-чат в канале: нажал → join → все остальные в канале видят активный huddle и могут зайти.
- Screen-share, draw mode, low-friction голосовая встреча.
- Clip — запись сообщения (audio / video) как ephemeral attachment.

Workflow Builder:
- No-code автоматизация: Trigger (slash / emoji / form / schedule) → Steps (send message / collect input / open modal / call webhook).
- Доступен всем в workspace, не требует admin.

Apps / integrations:
- 2000+ apps (Google Drive, GitHub, Jira, Notion, Figma).
- Bot пишет в канал, реагирует на mention, модалки для формы.
- Incoming / outgoing webhooks для самописных интеграций.

Search:
- Global (mod+K): messages, files, channels, people.
- Filters: from:user, in:channel, before/after:date, has:link.

Profile:
- Status: emoji + текст + expiration (до 10 min / 1 hour / today / custom).
- Do not disturb scheduling.
- Custom fields (department, role, pronouns, Slack admin определяет).

Notifications:
- Per-channel: all / mentions only / off.
- DND schedule.
- Mobile push отличается от desktop (настраивается).

Роли: owner, admin, multi-channel guest, single-channel guest, member, bot.

Ключевые intent'ы: post_message (channel / thread / dm), react_to_message, start_thread, start_huddle, share_screen, save_for_later, set_status, schedule_message, search_workspace, run_workflow_trigger, install_app, mention_user, invite_to_channel, create_canvas.

Эталон. Channel-first + threads как anti-noise. Workflow Builder как no-code automation. Huddles как low-friction voice-room. Canvas как long-lived doc. Slash commands + bot API. Save for Later / Later tab как async-reading lane.`,
  },

  // ══════════════════════════ INVEST ══════════════════════════
  {
    name: "robinhood-mobile",
    archetype: "dashboard",
    description: `Robinhood (mobile, iOS/Android, 2025-2026). Эталон consumer-grade инвестиционного приложения. Гейфицированный UX, commission-free trading.

Навигация: bottom tab bar — Home / Browse / Notifications / Profile / Search.

Home (главный экран = dashboard портфеля):
- Top hero: текущая стоимость портфеля крупными цифрами + дельта за день (зелёный / красный).
- Period switcher: 1D / 1W / 1M / 3M / 1Y / All — меняет график и дельту.
- График цены — line chart, haptic feedback при swipe по X-оси (пользователь "щупает" точку).
- Holdings list: карточка позиции — тикер + имя + текущая цена + per-position дельта + spark-line.
- Watchlists sections: Stocks / Crypto / Options / Movers — горизонтальные scrollable ряды карточек.

Карточка актива (stock detail):
- Hero: тикер + название + текущая цена + per-day дельта.
- Crossfade chart (line / candle) с period switcher + сравнение с индексами.
- Key stats: Market Cap, P/E, 52-Week high/low, Dividend yield, Beta.
- About: описание компании, CEO, headquartered, employees.
- Your position (если owned): shares + avg cost + total return + dollar P&L.
- Primary CTA: "Buy" (green) / "Sell" (red).
- Analyst ratings: % buy / hold / sell, price target.
- Related lists: "Stocks you might like", "People also own".

Buy / sell flow:
- Order-type selector: Market / Limit / Stop / Stop-limit.
- Dollar-based fractional (0.001 share минимум).
- Review screen: ticker + shares + cost + estimated fees (0 для stocks!) + primary "Swipe to submit".
- Confirmation with confetti (дефолт отключен в 2022+, но sound effects остались).

Portfolio analytics:
- Performance tab: dollar return / percent return / dividend total / total contribution / net change.
- Breakdown by sector / asset class.
- Tax lots (Robinhood Gold): cost basis method, harvest-opportunity flags.

Crypto:
- 20+ тикеров (BTC, ETH, DOGE, SOL, etc).
- 24/7 trading, real-time price.
- Transfer to external wallet (2023+).

Options (Level 2/3 approval):
- Strategy selector: single-leg, vertical, iron condor, etc.
- P/L visualiser — график прибыли на expiration.
- Greek display: Delta / Gamma / Theta / Vega.

Alerts:
- Price alerts (crossing threshold).
- News alerts для owned stocks.
- Earnings alerts (pre/post-market).

Robinhood Gold (subscription):
- Margin trading, Level II data, extended research, cash sweep с FDIC.

Education (Learn tab):
- Article stubs, онбординг-туториалы, glossary.
- Snacks — daily market newsletter push.

Роли: user (trader), observer (не authenticated), advisor (не существует — self-directed), Robinhood (broker — клиринг).

Ключевые intent'ы: buy_stock (market / limit), sell_stock, set_price_alert, add_to_watchlist, enable_options, buy_crypto, set_recurring_investment, enable_dividend_reinvestment, view_tax_documents, transfer_crypto_external, subscribe_gold.

Эталон. Gamified UX (сплошной зелёный/красный, haptic chart, confetti). Fractional dollar-based shares. Swipe-to-submit orders. Period-switcher chart с haptic. 1-tap watchlist. Crypto + stocks + options в одном приложении.`,
  },
  {
    name: "tinkoff-investments",
    archetype: "dashboard",
    description: `Т-Инвестиции (бывш. Тинькофф Инвестиции, mobile + web, 2025-2026). Эталон retail-инвестирования в РФ. Часть supe-app T-Bank / Т-Банк.

Навигация: bottom tab bar — Главная / Что купить / Портфель / Сообщества / Ещё.

Главная:
- Hero: стоимость портфеля + дельта за период (day / week / month / year / all).
- График портфеля — line chart с tap-по-точке = tooltip (дата + стоимость).
- Блок "Пульс": лента от инвесторов и пульс-авторов (Tinkoff social network внутри приложения).
- Идеи и прогнозы от аналитиков Т-Банка.
- Рекламные карточки: "Купите ОФЗ с купоном X%", "Новый БПИФ Т-Капитал".

Что купить (catalog):
- Категории: Акции / Облигации / Фонды / Валюта / Фьючерсы / Опционы / Структурные ноты.
- Скринер с фильтрами: сектор, капитализация, дивидендная доходность, страна, рейтинг аналитиков.
- Карточка актива: тикер + цена + дневная дельта + рекомендация аналитика (Buy / Hold / Sell) + целевая цена.
- Подборки: "Дивидендные короли", "Для начинающих", "Максимальная доходность", "Самое надёжное".

Карточка актива (stock / bond detail):
- Hero: название + тикер + цена + дельта + валюта.
- График с period switcher + сравнение с индексом IMOEX / RTS / SPX.
- Вкладки: О компании / Дивиденды / Мультипликаторы / Прогнозы аналитиков / Пульс / Отчётность / Календарь событий / Страны операций.
- Рекомендация аналитика с pro/con доводами.
- Блок "Подходит ли вам": тест на риск-профиль, если актив противоречит профилю — предупреждение с CTA "Изменить профиль".
- Primary CTA: "Купить" (зелёный) / "Продать" (красный) / "Открыть IIS".

Flow покупки:
- Выбор счёта: брокерский / ИИС-А / ИИС-Б.
- Тип заявки: Рыночная / Лимитная / Стоп.
- Количество: в штуках ИЛИ в лотах (для облигаций и фьючерсов).
- Расчёт: стоимость + комиссия (0.3% стандарт / 0.05% Premium).
- Подтверждение через биометрию / PIN.
- Статус исполнения — в реальном времени.

Портфель:
- Разбивка по классам активов (pie chart): акции / облигации / валюта / фонды.
- Разбивка по секторам / странам / валютам.
- Доходность: за период, XIRR, с учётом дивидендов.
- Таблица позиций: тикер / количество / средняя цена / текущая цена / прибыль абс / прибыль % / доля в портфеле.
- Валютный P&L — Т-Инвестиции показывает ROI отдельно в рублях и в валюте актива.
- Экспорт: CSV, PDF (отчёт по ИИС).

Пульс (соцсеть):
- Лента постов от инвесторов о сделках и идеях.
- Профили Пульс-авторов с рейтингом (IRR, риск, подписчики).
- Подписка на автора → автокопирование сделок (с ограничениями).
- Комментарии, лайки, репосты.

Роботы:
- "Вечный портфель" — автоматически поддерживает пропорцию 25/25/25/25 (акции / облигации / золото / валюта).
- DCA-стратегии — автопокупка N рублей раз в неделю.
- "Инвесткопилка" — копит проценты с остатка на карте в ETF.

Робот-советник:
- Анкета: цель / горизонт / риск-профиль.
- Выдаёт конкретный список активов с весами.
- Режим "Автоследование": Т-Банк rebalances портфель.

Уведомления:
- Price alerts, дивидендные выплаты, купоны, корпоративные действия.
- Push при исполнении стоп-лосса / стоп-лимита.

Налоги:
- Автоматический расчёт НДФЛ с реализованной прибыли.
- Справка 2-НДФЛ скачивается в 2 тапа.
- ИИС-А / ИИС-Б учёт вычетов.

Роли: инвестор (owner), наблюдатель (observer, для совместных счетов), советник (advisor, Robo-Advisor), Т-Банк (broker / administrator).

Ключевые intent'ы: buy_security, sell_security, open_iis, configure_autoinvest, subscribe_pulse_author, toggle_autofollowing, enable_cashback_to_etf, rebalance_portfolio, request_tax_report, set_price_alert, browse_analyst_ideas, post_to_pulse.

Эталон. Multi-account (брокерский + ИИС-А + ИИС-Б) в одном UI. "Подходит ли вам" — risk-profile gate перед сделкой. Пульс как social-feed внутри брокера. Автоследование / Вечный портфель / Инвесткопилка как automation presets. Валютный P&L двумя колонками.`,
  },
  {
    name: "interactive-brokers-pro",
    archetype: "dashboard",
    description: `Interactive Brokers (IBKR TWS + GlobalTrader + IBKR Mobile, 2025-2026). Эталон professional-grade инвестиционного софта. 150+ рынков, любые инструменты.

Два разных уровня продукта:
- TWS (Trader Workstation) — desktop-приложение для pro-trader'ов, сотни окон, keyboard shortcuts, algorithmic orders.
- IBKR Mobile / GlobalTrader — упрощённый mobile UI для retail.

Главная IBKR Mobile:
- Top: account dropdown (поддержка multi-account — IRA, individual, joint, trust, margin, cash, paper).
- Portfolio summary: net liquidation value, available funds, excess liquidity, SMA (для margin), leverage.
- Performance line chart с period switcher.
- Watchlists carousel: пользователь создаёт bespoke watchlists.

Поиск инструмента:
- Search-by-ticker с disambiguation: "AAPL" → US stock / ADR / options chain / warrants / bonds / structured / CFDs (разные биржи).
- Фильтры: asset class, exchange, currency, sector.

Карточка инструмента (instrument detail):
- Hero: ticker + name + exchange + price + дневная change + bid/ask с size + volume + high/low.
- Chart: line / candlestick / Renko / Heikin Ashi / Point & Figure; period от 1m до 5y; technical indicators (SMA, EMA, RSI, MACD, Bollinger, Fibonacci).
- Fundamentals: P/E, EPS, dividend, market cap, 52W high/low, beta, revenue, operating margin.
- Analyst estimates: consensus rating + price target (Refinitiv / Zacks data).
- News stream (real-time feed).
- Options chain: grid calls × puts × strike × expiration с IV / delta / gamma / theta / vega / rho / open interest / volume per cell.
- Primary CTA: "Buy" / "Sell" / "Trade Options" / "Trade Forex".

Order Ticket:
- Action: Buy / Sell / Short / Cover.
- Order type: Market / Limit / Stop / Stop-Limit / Trail / Trail-Limit / MOC / LOC / MOO / LOO / Relative / VWAP / TWAP / Iceberg / Adaptive / Accumulate-Distribute / Bracket / OCO.
- Time-in-force: Day / GTC / IOC / FOK / GTD / OPG.
- Algo selection: IBKR Algo (VWAP / TWAP / ArrivalPrice / Adaptive / ClosePx).
- Routing: SMART / direct to exchange (ISLAND / ARCA / BATS / NYSE / ...).
- Destination: direct access или dark pool.
- Review: estimated commission (tiered / fixed), regulatory fees, short locate fee, max loss (для options).

Portfolio:
- Positions table: 20+ columns (symbol / position / avg cost / mkt price / mkt value / unrealized P&L / % change / % of NLV / margin req / daily P&L / vol / expiration / delta / rho).
- Grouping: по account / currency / asset class / sector.
- Sort / filter / export CSV.
- Tax lots с harvest-opportunity helper.

Margin и risk:
- Real-time margin requirements per-position.
- Value at Risk (VaR) — portfolio risk score.
- Stress tests: "если SPX упадёт на 10%, ваш портфель потеряет Y".
- Margin call preview — что произойдёт при движении рынка.

Алерты:
- Price, chart-pattern, Greek-based (для options), news-based, fundamental-based (earnings beat / miss).
- Multi-condition: "if AAPL > 200 AND RSI > 70".

Algo trading / API:
- IBKR API (Python / Java / C++ / REST): автоматизация заявок.
- TWS с DDE / ActiveX для Excel.

Client Portal (web):
- Тот же account, полный портфель, reports, statements, tax docs, funding, позиции.

ImpactApp (ESG):
- Отдельное приложение для values-based investing: screen out weapons / fossil fuels / animal testing.
- ImpactScore per-holding.

Роли: individual investor, advisor (RIA — управляет счетами клиентов), master-sub (институциональный аллокатор), IBKR (broker с clearing).

Ключевые intent'ы: place_order (20+ order types), route_to_exchange, run_algo, set_multi_condition_alert, view_options_chain, build_options_spread, view_margin_details, run_stress_test, fund_transfer, open_joint_account, request_margin_loan, view_tax_lots, export_statement, call_api (REST / TWS), launch_desk_tws.

Эталон. 20+ типов заявок. SMART-routing + direct-to-exchange. Options chain grid с full Greeks per cell. Multi-account (individual / joint / trust / IRA / paper) в одном UI. Algo-orders (VWAP / TWAP / Adaptive) как first-class. Real-time margin + stress tests. Full API как first-class distribution (TWS / REST).`,
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
  console.log(`Uncovered-Domains Pattern Batch — ${new Date().toISOString()}`);
  console.log(`Targets: booking (Calendly, Cal.com, YClients) · messenger (WhatsApp, Telegram, Slack) · invest (Robinhood, Tinkoff, IBKR)`);
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
