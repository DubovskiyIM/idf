#!/usr/bin/env node
/**
 * Pattern Bank batch для doc-editor / wiki / knowledge-base продуктов.
 * 18-й полевой тест IDF — Notion-style domain.
 *
 * Цель — извлечь UX-паттерны из 5 эталонных продуктов до того, как
 * авторим ontology/intents/projections для домена `notion`. Это даёт нам:
 *  - falsification fixtures для архетипических паттернов «hierarchical-page-tree»,
 *    «block-canvas», «multi-view-database», «inline-comments»
 *  - снижает риск, что мы случайно изобретём паттерн, уже формализованный
 *    в одном из соседних продуктов
 *
 * 5 источников × 3 фазы researcher'а (extract → review → falsification).
 * Time budget: 15-30 мин.
 *
 * Usage:
 *   node scripts/notion-pattern-batch.mjs
 *   node scripts/notion-pattern-batch.mjs --dry-run
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESEARCHER = join(__dirname, "pattern-researcher.mjs");
const DRY_RUN = process.argv.includes("--dry-run");

const SOURCES = [
  // ══════════════════════════ NOTION ══════════════════════════
  {
    name: "notion-doc-editor",
    archetype: "feed",
    description: `Notion (web + desktop + mobile, 2025-2026). Эталон block-based knowledge management. Гибрид документа и базы данных, где каждый блок — first-class объект с типом и contentful-payload. Задаёт UX-стандарт для современного wiki / doc-editor.

Глобальная навигация:
- Sidebar (left, ~260px): иерархическое дерево страниц (Workspace → Teamspaces → Pages → Subpages). Каждая Page может содержать неограниченную глубину subpages. Drag-to-reparent. Pinned section сверху, Private section снизу.
- Quick Find (Cmd+P): fuzzy-search по всему workspace с превью совпадений и filter-chips ("type:page", "in:database", "by:user").
- Breadcrumb сверху страницы: Workspace > Teamspace > Parent > Current.

Page как блок-канвас:
- Hero header: cover image (collapsible, 1500x300 рекомендуется), emoji icon, title (h1, в-line editable), description.
- Body — список блоков. Каждый блок имеет тип: paragraph / heading_1/2/3 / bulleted_list / numbered_list / todo (с checkbox) / toggle (collapsible) / quote / callout (с emoji + bg-color) / code (с языком + syntax highlighting) / divider / image / video / file / bookmark / embed / table / column-layout (multi-column) / database-inline / database-linked / synced-block (cross-page mirror) / breadcrumb.
- Slash-command (/): на пустой строке открывает меню типов блоков с поиском. "/h1" → heading_1, "/img" → image, "/db" → inline database.
- Drag handle (⋮⋮) появляется hover слева от блока: drag-to-reorder, click → menu (Delete, Duplicate, Turn into, Color, Comment, Copy link).
- Indent/outdent (Tab/Shift+Tab) для list-блоков формирует tree.
- Markdown-shortcuts: "**" → bold, "# " → h1, "- " → bullet, "[]" → todo, "> " → quote.

Database — это специальная Page:
- Database является "container" для строк, каждая Row — сама по себе Page (можно открыть и заполнять как обычный doc).
- Свойства (Properties): text, number, select, multi-select, status (specialized), date, person, files, checkbox, url, email, phone, formula, relation, rollup, created/last-edited.
- Views: Table, Board (Kanban), Gallery, List, Calendar, Timeline. Все viewов имеют общие фильтры/sort, но каждый — свои настройки groupBy / show-properties / cover-image.
- Filter rules: "Status equals In Progress AND Due before next 7 days". Combinator AND/OR.
- Linked database (synced view) — отображает rows другого database на текущей странице.

Permissions:
- Workspace level: Owner / Member / Guest.
- Page level: Full access / Can edit / Can comment / Can view / No access. По умолчанию наследуется от parent.
- Public sharing: toggle "Share to web" → public read-only URL. Optional "Allow editing", "Allow commenting", "Search engine indexing".
- Guest access: invite по email только на конкретные pages (вне workspace billing).

Real-time collaboration:
- Multi-cursor (presence avatars сверху страницы), inline-cursor с цветом и именем.
- Conflict-free editing на block-level (CRDT под капотом).
- Comments: inline (на selection текста — pin к range), block-level (сбоку от блока), page-level (в footer).
- @-mentions: @person → notification, @page → backlink, @date → reminder, @database → linked.

AI (Notion AI):
- /ai в slash-меню или Cmd+J: prompt-bar над текущим контекстом.
- Capabilities: summarize, draft, translate, brainstorm, fix grammar, change tone.
- AI blocks: persistent AI-generated blocks с "regenerate" кнопкой.

Templates:
- Workspace templates (preset databases, page-structures): "Project tracker", "Meeting notes", "Roadmap".
- User templates: создаёшь свою и дублируешь как basis для новых.

Trash / Archive:
- Soft-delete: archived pages 30 дней восстановимы, потом hard-delete.
- Trash bin доступен Owner/Admin'ом.

Роли: workspaceOwner (full control + billing), member (default), guest (per-page invite), commenter, viewer.

Ключевые intent'ы: create_page, create_subpage, rename_page, change_page_icon, set_cover_image, archive_page, restore_page, add_block (slash-command), change_block_kind, drag_block, indent_block, delete_block, create_database, add_property, change_property_kind, create_view, set_filter, set_sort, set_group_by, add_database_row, set_property_value, share_page, change_permission_level, invite_guest, add_inline_comment, resolve_comment, mention_user, ai_summarize, ai_continue_writing, search_workspace.

Эталон. Block-based composition — каждый параграф/заголовок/список — отдельный объект с UUID, типом и payload. Slash-command как universal block-creator. Database = специальная page, row тоже page. Multi-view database с per-view filter/sort/groupBy. Permission inheritance от parent → page → block (block-level RBAC через restricted blocks).`,
  },
  // ══════════════════════════ CODA ══════════════════════════
  {
    name: "coda-table-document",
    archetype: "feed",
    description: `Coda (web + iOS + Android, 2025-2026). Гибрид document + spreadsheet + lightweight app-builder. Дифференциатор от Notion — first-class formulas + buttons + packs (intergrations).

Doc как первичная единица:
- Sidebar: список Doc'ов с папкой структурой (можно вложить).
- Каждый Doc состоит из Pages. Pages образуют tree но без отдельной database/page дихотомии — всё page'и, на pages могут быть tables.
- Table — first-class блок внутри page (не отдельная сущность как database в Notion). Можно вставить несколько tables на одну page.

Tables и formulas:
- Table = rows + columns + view-specific filters/sort.
- Cross-table formulas через "=Table.Column" синтаксис, по подобию Excel но с richer semantics.
- Column types: text / number / date / checkbox / select / lookup (FK to other table) / button / image / file / formula / canvas (rich-text внутри cell).
- Filter formulas: 'Filter(Tasks, [Status]="Active" AND [Owner]=User())'.
- Live preview formula: при наборе формулы Coda показывает результат тут же.

Buttons и automations:
- Button — column-type или standalone block. На клике запускает action (Add row, Modify row, Notify, Open URL, Run pack action).
- Automations: "When row added to Tasks, send Slack message". Trigger / Condition / Action в одном UI.
- Buttons можно условно показывать (visible if formula).

Views:
- Table view (default), Card view (gallery), Kanban (board by select-column), Calendar, Timeline (Gantt), Detail.
- В отличие от Notion, view может быть "controlled view" — preset filters не редактируются обычным viewer'ом.

Cross-doc:
- "Cross-doc" блок: импортирует table из другого Doc'а (one-way sync, refresh на расписании).
- Packs (integrations): Slack, Jira, Google Sheets, GitHub. Каждый Pack приносит свои tables (e.g., "Jira Issues") и actions.

Permissions:
- Doc-level: Editor / Commenter / Viewer.
- Page-level: можно скрыть страницу от non-editor'ов.
- Section locking: "Locked rows in Quotes" — даже editor'у нельзя менять.
- Public publish: с фильтрацией каких страниц публиковать.

Templates:
- Coda gallery: тысячи готовых docs (CRM, OKR, Sprint planner, Roadmap, Knowledge base).

AI (Coda AI):
- Inline prompt в любом блоке: "Summarize the table above".
- AI blocks с auto-update при изменении source.
- AI columns: column-formula, evaluating LLM per row.

Роли: docOwner, editor, commenter, viewer, packAdmin.

Ключевые intent'ы: create_doc, create_page, add_table, add_column, change_column_type, add_row, set_cell_value, write_formula, add_button, configure_button_action, create_view, switch_view_kind, lock_section, sync_cross_doc, install_pack, run_pack_action, publish_doc, share_doc, ai_generate_column, automate_on_change.

Эталон. Buttons как first-class action-блоки. Formula language с cross-table references. Tables embedded в pages (не отдельная сущность). Cross-doc sync. Packs как extensibility surface. Locked sections как more granular permission.`,
  },
  // ══════════════════════════ OBSIDIAN ══════════════════════════
  {
    name: "obsidian-graph-vault",
    archetype: "catalog",
    description: `Obsidian (desktop primary + iOS/Android, 2025-2026). Local-first knowledge base над plain markdown файлами. Дифференциатор — graph-view, backlinks, plugin-ecosystem, owner-data-первичный.

Vault model:
- Vault = локальная папка с .md файлами + .obsidian/ конфиг.
- Каждый .md файл = note. Подпапки = категории/MOC (Maps of Content).
- File explorer слева: tree of folders+files. Drag-to-reparent.
- Tabs сверху: open notes как tabs (Chrome-style), workspaces.

Editor:
- Live preview: гибрид markdown + WYSIWYG. Цитаты/код/headings рендерятся inline.
- Source mode: чистый markdown текст.
- Reading mode: только rendered (как preview).
- Wiki-links: [[Note Name]] создаёт link, при click — открывает или создаёт note. Auto-completion с fuzzy.
- Tags: #productivity #ml — можно nested через "#area/work".
- Aliases: в front-matter "aliases: [Name 2, alt-name]" — все эти строки тоже резолвятся в [[link]].

Backlinks panel (right sidebar):
- Список всех notes, которые ссылаются на текущую через [[wiki-link]].
- Контекст-snippet (parag) вокруг каждой ссылки.
- "Unlinked mentions" — упоминания title без [[]] (suggestion для linkify).

Graph view:
- Глобальный граф: nodes — notes, edges — links. Force-directed.
- Filter chips: tags, paths, orphans (nodes without edges), attachments.
- Color groups: по tag / folder / regex.
- Local graph (per-note): только note + 1-2 hops, для exploration.

Daily notes:
- Plugin (built-in): создаёт notes per date (yyyy-mm-dd.md), template-driven.
- Calendar plugin визуализирует daily notes в календарной сетке.

Plugins:
- Community plugins (1500+): Dataview (SQL-like queries over notes), Templater (advanced templating), Excalidraw (built-in drawing), Kanban (board из markdown), Tasks (todo aggregator).
- Settings → Community plugins → Browse → install. Каждый — пакет JS.
- Themes: 200+ тем CSS-переменных.

Search:
- Cmd+O: quick switcher (file by name).
- Cmd+Shift+F: full-text search across vault, regex/case sensitivity, scope (folder/tag/path).
- Search-in-search: complex queries "tag:#ml file:research".

Sync:
- Obsidian Sync (paid): E2EE между устройствами.
- Альтернативы: iCloud, Dropbox, Syncthing, Git (обычная папка).

Publish:
- Obsidian Publish: выбираешь notes → публикуются на yourname.obsidian.page как static site.
- Selective публикация (галочки на нужные notes).

Роли: ownerEverything (одиночный использует, нет multi-user; Sync — single-account).

Ключевые intent'ы: create_note, rename_note, move_to_folder, edit_in_source / live-preview / reading mode, insert_wikilink, insert_tag, switch_workspace, open_quick_switcher, run_full_text_search, view_local_graph, view_global_graph, install_community_plugin, write_dataview_query, create_daily_note, sync_to_cloud, publish_note.

Эталон. Local-first single-user (нет permission модели — всё owner-data). Markdown файлы как single source of truth. Wiki-links + backlinks + tags как 3 ортогональных navigation surface. Graph view как exploration UI. Plugin-ecosystem как user-extensible authoring stack. File-tree + folders как primary structure (не database/page как в Notion).`,
  },
  // ══════════════════════════ ROAM ══════════════════════════
  {
    name: "roam-bidirectional",
    archetype: "feed",
    description: `Roam Research (web, 2025-2026). Эталон bidirectional outliner-подхода к knowledge management. Каждый параграф (block) — first-class объект с UUID, можно ссылаться на конкретный block, не только на page. Сильно отличается от Notion granularity'ю и от Obsidian — non-hierarchical.

Block-as-first-class:
- Каждый bullet (block) — отдельный объект с UUID и timestamp.
- Block embed: ((uuid)) — встраивает любой блок другой страницы как live-mirror; при изменении источника обновляется везде.
- Block reference: при клике на block-bullet справа — sidepane показывает все references к этому конкретному блоку.

Outliner (zoomable):
- Все pages — это nested bullets (outliner). Cmd-Shift-Up/Down — move block. Tab/Shift-Tab — indent/outdent.
- Click на bullet → zoom-in: только этот block + descendants становится workspace ("breadcrumb" наверх).
- Multi-select: shift-click несколько blocks → group-action (move, copy ref, color).

Bi-directional links:
- [[Page Name]] — link to page. При создании страницы автоматически делается backlink.
- ((block-uuid)) — link to block.
- #tag — alias for [[tag]].
- Linked References (всегда внизу page): все pages, в которых упомянут текущий title или alias.
- Unlinked References: упоминания title без [[]].

Daily Notes (центральная фича):
- Главная страница Roam = today's daily note. Каждая дата — page yyyy-mm-dd.
- Free-flow journal: пишешь, что в голову пришло, ссылаешься через [[]] на projects/people/topics.
- Linked references на странице "Projects/Foo" автоматически собирает все упоминания за все дни.

Queries:
- {{[[query]]: {and: [[Tag1]] [[Tag2]]}}} — встраивает live-query в block.
- DSL: AND/OR/NOT/BETWEEN, фильтр по tag, page, block-attribute.
- TODO: {{[[TODO]]}} → checkbox; aggregated с {{[[query]]: {and: [[TODO]] [[Project]]}}}.

Attributes:
- "Status:: Active" внутри block — атрибут (KV). Aggregated across pages через query.
- Pages как рассыпуха attributes можно view как "table" в namespace "Attributes/Status".

Sidebar (right):
- Open page in sidebar (shift-click): держит несколько pages открытыми параллельно с main pane.
- "Stacked workspace": open many concurrent contexts.

Multi-player:
- Roam Multiplayer: real-time, presence, comments. Permission per-graph (Editor / Reader).
- Public graphs: read-only public graph с custom URL.

Search:
- Cmd-U: quick page open.
- Cmd-Shift-9: full-text + filters.
- Search by attribute: "Status:: Active" найдёт все blocks с этим attribute.

Keyboard-первый интерфейс:
- 90% актион через shortcut'ы (Roam известен learning curve).
- Cmd-Z: undo с глубокой историей.

Plugins:
- roam/css, roam/js — кастомизация через codeblocks в специальных pages.
- SmartBlocks — templating engine.

Роли: graphOwner, editor, reader, public-viewer.

Ключевые intent'ы: create_page, create_block, indent_block, embed_block ((ref)), reference_block, link_to_page, create_attribute, run_query, view_linked_refs, view_unlinked_refs, open_in_sidebar, zoom_into_block, navigate_today, navigate_to_date, mark_todo, aggregate_todos, search_full_text, search_by_attribute.

Эталон. Block-as-FK: ((uuid)) — single-level granularity для refs. Daily notes как primary entry point. Queries встроенные в блоки (DSL). Outliner zoom-in. Linked / Unlinked references как двойной footer. Attributes как KV-rows внутри prose.`,
  },
  // ══════════════════════════ CONFLUENCE ══════════════════════════
  {
    name: "confluence-space-wiki",
    archetype: "catalog",
    description: `Confluence (Atlassian, web + mobile, 2025-2026). Эталон enterprise wiki / team docs. Дифференциатор от Notion — space-centric, integrated с Jira, более formal permission model, page-versioning + approvals.

Spaces как первичный grouping:
- Space = top-level container (Engineering / Marketing / HR / Customer-X). Имеет свой permission scope, sidebar, dashboard.
- Space sidebar: Overview / Pages / Blog / Calendars / Questions.
- Page tree per space: hierarchical, drag-to-reparent.
- Spaces directory: глобальный список со фильтрами (favorited / recent / type).

Page editor:
- Block-based но более «document-like»: panels (Info / Note / Warning / Success), expand (collapsible), columns, divider, table (Excel-like inline).
- Macros (legacy + cloud): Jira issue list, Roadmap planner, Status, Decisions, Action items, ToC, Mention.
- Templates: 100+ enterprise templates (Project plan, Decision log, Meeting notes, How-to guide, Retrospective).
- Real-time co-editing (как Google Docs), inline comments, draft/publish.

Versioning:
- Каждый publish создаёт version. Page history sidebar: список versions со автором/датой/изменением.
- Compare versions: diff view (added/removed/changed).
- Restore previous: revert к произвольной версии.

Permissions:
- Space-level: Space admin / View / Edit / Comment / Restrict children.
- Page-level: restrict view / edit к конкретным группам/users (overrides space defaults).
- Anonymous access: per-space toggle (для public docs).

Approvals (Premium):
- Page approval workflow: автор → review by N persons → publish.
- Status badge на странице: Draft / In Review / Approved.

Comments + @mentions:
- Inline (на selection текста): pin к range, threaded reply.
- Page-level (footer): general comments.
- @-mention: notifies user, adds к Inbox.

Inbox:
- Personal Inbox: все @mentions, watched pages, comments на твоих pages.
- Watch toggle: subscribe к updates на page/space.

Search:
- Global search bar: type-ahead с filters (space, type, contributor, last modified).
- Advanced search (CQL): "type=page AND space=ENG AND lastModified > now('-7d')".

Calendars:
- Team Calendars: integrated с Jira sprints, leave requests, events.
- Per-space calendars (multiple per space).

Jira integration:
- Inline Jira issue list (live, filterable): macro в page.
- Smart Links: paste Jira URL → автоматически card с status/assignee.
- Two-way: Jira ticket auto-links обратно на referenced Confluence page.

Analytics (Premium):
- Page views, unique visitors, avg time, top contributors per space.
- Space activity feed.

Роли: siteAdmin, spaceAdmin, member (default), spaceContributor, viewer, anonymousReader.

Ключевые intent'ы: create_space, create_page, create_subpage, edit_page (collaborative draft), publish_page, restore_version, compare_versions, request_approval, approve_page, restrict_page_permission, add_inline_comment, resolve_comment, mention_user, watch_page, manage_inbox, run_advanced_search (CQL), insert_jira_issue_macro, create_template, install_template, archive_page, move_page_between_spaces, manage_space_permissions, configure_space_calendar.

Эталон. Space-centric grouping с per-space sidebar / permission / dashboard. Page-versioning с diff и restore. Approval workflow перед publish. Permission inheritance space → page (с override). Inbox для notifications. Macros как embedded live-data (Jira tickets). CQL как advanced search DSL.`,
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
    if (DRY_RUN) args.push("--dry-run");
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
  console.log(`Notion-style Pattern Batch — ${new Date().toISOString()}`);
  console.log(`Targets (5): Notion, Coda, Obsidian, Roam Research, Confluence`);
  console.log(`Sources: ${SOURCES.map(s => s.name).join(", ")}`);
  if (DRY_RUN) console.log("DRY RUN — без вызова Claude");

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
