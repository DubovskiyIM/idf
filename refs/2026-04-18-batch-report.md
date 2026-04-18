# Pattern Bank Batch Report — 2026-04-18

Elapsed: 25.6 min, 7 sources, 51 candidates.

## Sources processed

- ✓ `linear-triage-view`
- ✓ `linear-issue-keyboard-flow`
- ✓ `stripe-payments-observer-export`
- ✓ `stripe-subscriptions-preapproval`
- ✓ `notion-database-views-schema`
- ✓ `height-phase-board`
- ✓ `superhuman-inbox-keyboard`

## Extractions

### `height-kanban-board`

- Entities: Task, SubTask, Project, Workflow, Phase, Label, User, Assignment
- Intents: change_task_status, start_task, mark_task_done, reopen_task, block_task, send_to_review, create_task, edit_task_title, assign_user, unassign_user, add_label, remove_label, set_due_date, add_subtask, bulk_move_to_phase, bulk_assign, delete_task, archive_task, group_by_assignee, group_by_label, open_command_palette
- Roles: owner, viewer
- Observations:
  - Kanban columns = workflow phases; drag-drop between columns performs replace on task.status
  - Phase-aware primary CTA in detail view: button label and action derived from current status (Start / Mark done / Reopen)
  - Only valid next-phase transitions rendered as buttons — workflow is directed graph, not all→all
  - Task card composite: title + assignee avatars + label pills + progress bar + due-date chip (red if overdue)
  - Time-in-phase badge on card signals stagnation — derivable metric, not stored field
  - Bulk selection via checkboxes opens action bar with Move to Phase / Assign to User
  - Swimlanes = horizontal grouping by assignee or label — view-level grouping, orthogonal to column-phase
  - Command palette (⌘K) as universal intent entry point; J/K for card navigation
  - Sub-task progress shown as inline progress indicator on parent card
  - Workflow phases declared per-project; phase count and transitions are configurable
  - Overdue state is derived from dueDate vs now, rendered as color-signal on chip

### `linear-issue-detail`

- Entities: Issue, SubIssue, Comment, Label, Cycle, Project, User
- Intents: edit_title, edit_description, change_status, change_priority, assign_user, set_labels, set_estimate, set_due_date, set_cycle, set_project, set_parent, create_label, add_subissue, add_comment, reply_to_comment, edit_comment, delete_comment, archive_issue, delete_issue, duplicate_issue, open_command_palette
- Roles: owner, viewer
- Observations:
  - Every sidebar property has single-letter hotkey opening inline popover with fuzzy-searchable options
  - Property pickers are type-specific: calendar for date, ordered workflow list for status, multi-select with create-new for labels
  - Property changes use optimistic update — select → Enter applies immediately, no confirmation step, undo toast available
  - Command palette (⌘K) exposes every action globally — keyboard is primary navigation, mouse is optional
  - Comments render inline as sub-stream under description; R replies in-thread, C creates new top-level comment
  - Sub-issues created inline via Ctrl+T, hierarchy visible as nested collapsible section within detail
  - Sidebar property rows are dual-modal: clickable AND keyboard-addressable through identical popover mechanism
  - Shift-modifier hotkeys (shift-P project, shift-M parent) disambiguate namespace collisions with single-letter primaries
  - Rich-text description edits inline in place rather than via modal — title and body are editable atoms of the detail view
  - Destructive actions (archive, delete issue) confirmed via separate modal/dialog, while reversible mutations skip confirmation entirely

### `linear-triage`

- Entities: Issue, TriageQueue, Source, Submitter, Project, User
- Intents: take_issue, accept_to_backlog, assign_issue, convert_to_project, decline_issue, discard_issue, set_priority, add_label, create_triage_filter, bulk_take, bulk_decline, navigate_next_issue
- Roles: owner, viewer, observer
- Observations:
  - Flat reverse-chronological feed of unassigned issues (newest first)
  - Each card shows source icon (email/Slack/widget), submitter, title, excerpt — source provenance is first-class
  - Keyboard-first single-key hotkeys (T/P/D/X) for primary triage decisions without mouse
  - Actions cause immediate removal from feed — item leaves queue and reappears in destination context
  - Left sidebar filters act as saved triage-queue views (by source / label / priority)
  - Bulk selection via Shift+click with actions applied to entire range
  - Bottom status bar reveals hotkey cheat-sheet contextually on selection
  - Triage is a discrete lifecycle state before backlog — issues are gated, not auto-admitted
  - Decline and discard are irreversible-high actions but executed with single keystroke (no modal), relying on undo toast pattern
  - Convert-to-project is an escalation path: single issue promoted to higher-order Project entity

### `notion-database-multi-view`

- Entities: Database, Schema, Property, View, Entry, Relation
- Intents: switch_view, add_view, rename_view, change_view_archetype, set_view_filter, set_view_sort, set_view_groupby, toggle_property_visibility, delete_view, add_property, change_property_type, rename_property, delete_property, create_entry, edit_entry_field, change_entry_status, set_entry_date, drag_entry_between_columns, drag_entry_on_timeline, link_relation, unlink_relation, open_entry_detail, delete_entry
- Roles: owner, viewer
- Observations:
  - Single ontology, runtime-switched archetype: table / board / list / calendar / gallery / timeline
  - Top tab-bar lists saved views; '+ Add view' opens template picker (archetype choice)
  - Left sidebar exposes filters / sorts / groupBy as per-view controls, not per-database
  - Schema-driven rendering: field type → control (select → pill, date → calendar popover, relation → linked chip, checkbox → toggle, url → link, email → mailto)
  - Board archetype groups entries by a select-property (status or priority); drag between columns writes status
  - Calendar archetype positions entries by date-field; drag changes date
  - Timeline archetype renders Gantt-style bars over a date-range field; drag edges re-schedule
  - Gallery archetype renders cards with image/cover preview; cardSize configurable
  - Table archetype supports inline-edit per cell; every property visible as column
  - Row click opens full-page entity edit modal regardless of archetype
  - Multi-select relations materialize as chip-stack with linked-entity titles
  - Polymorphic entries via discriminator field (Type: Task / Milestone / Doc); rendering differs per type
  - Schema edit ('... / Edit property') affects all views simultaneously — one ontology, many projections
  - Changing property type is irreversible / lossy — warrants confirmation
  - 'Add view' is form-based (pick archetype + name); rename is inline enter-to-commit
  - Pattern: view-multi-archetype — same projection spec, archetype chosen by author-config or auto-detected from ontology signals

### `stripe-dashboard-payment-detail-observer`

- Entities: Payment, PaymentEvent, ComplianceCheck, CustomerSnapshot, Dispute, ExportToken
- Intents: export_pdf_receipt, export_csv, export_audit_log_pdf, export_compliance_report, open_dispute
- Roles: observer, owner, agent
- Observations:
  - Observer-scoped detail view — read-only surface with a single high-irreversibility escape (Dispute)
  - Export dropdown top-right generates server-rendered artifacts via document-materialization, viewer-scope
  - Share-link export uses limited-time token, not JWT session — ExportToken as first-class entity with expiresAt
  - Timeline as causal chain (PaymentEvent.causedById) shown chronologically, not just flat list
  - Automated ComplianceCheck rendered as pass/fail badge grid, not free text
  - CustomerSnapshot is immutable point-in-time capture, distinct from current Customer state
  - Metadata shown as read-only JSON key-value block
  - Raw Events section as devs-oriented API payload list, separate from human timeline
  - Dispute CTA at bottom as irreversible primary action with type-to-confirm (type 'DISPUTE')

### `stripe-billing-create-subscription`

- Entities: Customer, Product, Price, Subscription, Coupon, Invoice, SubscriptionPreapproval, AuditLogEntry
- Intents: select_customer, select_price, set_trial_period, set_collection_method, attach_coupon, set_metadata, save_draft_subscription, create_subscription, schedule_cancel_at_period_end, cancel_subscription_immediate
- Roles: owner, viewer, agent, observer
- Observations:
  - Linear multi-step wizard with back-navigation and save-as-draft
  - Customer picker uses live email search with typeahead results
  - Price picker groups prices under parent Product with recurring interval badge
  - Trial period is optional dropdown (days) with visible computed trialEnd date
  - Collection method surfaced as radio: automatic (requires saved card) vs send_invoice
  - Preapproval parameters (maxAmountPerCycle, maxCycles, endDate, allowedPaymentMethods) captured at creation and become immutable after activation
  - Metadata step uses JSON editor with schema validation before continue
  - Review step renders read-only summary before irreversible Create button
  - Billing cycle charge is gated by preapproval check — failure leaves invoice open and emails customer rather than retrying silently
  - Cancellation is two-branch: schedule at period end (soft) vs immediate (irreversible high)
  - All subscription mutations write AuditLogEntry with before/after diff for compliance
  - Post-activation edits require separate update_subscription intent rather than inline field edits

### `superhuman-inbox`

- Entities: Conversation, Message, Draft, Folder, SplitInbox, Snippet, UndoableAction
- Intents: archive_conversation, mark_read_unread, read_later, snooze_conversation, reply_message, reply_all, forward_message, send_message, save_draft, undo_last_action, search_conversations, navigate_next, navigate_prev, goto_folder, expand_snippet, switch_split_inbox
- Roles: owner, viewer
- Observations:
  - Feed archetype with two-pane layout: list left, thread right, single-selection driven by J/K
  - All mutating actions go through keyboard shortcuts, never modals — composer is inline in the thread pane
  - Every destructive or state-changing action produces an undo toast with ~3s expiry; Cmd+Z/U reverts
  - Snooze is a replace on conversation.snoozedUntil with preset options (1h / tomorrow / custom date)
  - Split Inbox is a saved filtered feed — folder-like but derived from sender category, not a physical location
  - Command bar ⌘K is a single entry-point for search + navigation + command execution
  - Combo-key navigation (G then I/D/S) indicates hierarchical hotkey namespace, not flat shortcuts
  - Composer uses Tab-cycle between To/Subject/Body instead of focus-on-click, reinforcing keyboard-first model
  - Snippet expansion (;abc → text) is a replace on draft.body triggered by typing pattern, not explicit command
  - Perceived latency ≤80ms implies optimistic local mutation with background sync — undo-toast is the reconciliation UI


## Candidates

### `bulk-action-toolbar`

- Archetype: catalog
- Status: candidate
- Trigger: `[{"kind":"intent-count","filter":{"idPrefix":"bulk_"},"minCount":2}]`
- Slot: toolbar
- Hypothesis: Bulk-intents в онтологии — явный signal, что domain ожидает операций-по-множеству. Без dedicated bar пользователю придётся исполнять один и тот же intent N раз подряд (дорогой loop), либо open-каждый-detail → contract нарушен. Toolbar'овый bar — каноничный fit: активируется по selection, исчезает при 0, не конкурирует с per-card actions.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-height-phase-board-bulk-action-toolbar.json`

### `kanban-phase-column-board`

- Archetype: catalog
- Status: candidate
- Trigger: `[{"kind":"entity-kind","value":"mainEntity"},{"kind":"entity-field","field":"status","enumMinValues":3},{"kind":"intent-effect","α":"replace","target":"<mainEntity>.status","confirmation":"click","minCount":1}]`
- Slot: body
- Hypothesis: Когда entity фактически живёт на state-machine с одним dominantным полем статуса и главное намерение — двигать сущность по фазам, пространственное расположение колонок кодирует сам workflow: позиция карточки = её фаза. Это устраняет необходимость открывать detail для смены статуса и делает загрузку каждой фазы визуально считываемой (количество, стагнации, балансы).
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-height-phase-board-kanban-phase-column-board.json`

### `multi-facet-catalog-card`

- Archetype: catalog
- Status: candidate
- Trigger: `[{"kind":"entity-kind","value":"mainEntity"},{"kind":"field-role-present","anyOf":["person-reference","label","progress","date","tag"],"minDistinctRoles":3}]`
- Slot: body
- Hypothesis: grid-card-layout сегодня требует image или money/percentage; task-like entity без картинок, но с богатым набором fieldRole выпадает в плоский list-row и теряет scannability. Card с зонами под семантику (people/progress/time) — natural fit для операционных сущностей (tasks, issues, tickets).
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-height-phase-board-multi-facet-catalog-card.json`

### `sub-entity-progress-rollup`

- Archetype: catalog
- Status: candidate
- Trigger: `[{"kind":"sub-entity-exists","withField":"status"},{"kind":"entity-field","entity":"<subEntity>","field":"status","hasValue":"done"}]`
- Slot: body
- Hypothesis: subcollections даёт expanded-список child'ов в detail-view — но в catalog'е разворачивать весь child-list на каждой карточке бесмысленно. Aggregated progress bar — compact compression: parent-card показывает статус своих детей одним визуальным символом. Паттерн читабелен только если у sub-entity есть терминальный status (done/complete), из которого можно посчитать ratio.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-height-phase-board-sub-entity-progress-rollup.json`

### `temporal-field-visual-signal`

- Archetype: —
- Status: candidate
- Trigger: `[{"kind":"field-role-present","role":"date","semanticHint":["due","deadline","scheduledAt","phaseEnteredAt"]}]`
- Slot: body
- Hypothesis: Abs-timestamp ('2026-04-18 17:00') требует ментальной арифметики — пользователь должен вычитать now. Relative-color-signal делает операционно важное свойство (просрочено / зависло) константно-видимым. Правило decidable: стандартные семантические роли (due/scheduledAt) → canonical-трансформация, адаптеру передаётся только tone.
- Falsification matches: 3 should / 2 shouldn't
- Source file: `2026-04-18-height-phase-board-temporal-field-visual-signal.json`

### `universal-command-palette`

- Archetype: —
- Status: candidate
- Trigger: `[{"kind":"intent-count","filter":{"all":true},"minCount":15}]`
- Slot: overlay
- Hypothesis: При intent-count > ~15 button-layout становится overwhelming: кнопки мигрируют в меню, меню вложенные, скорость исполнения падает. Command palette — плоский keyboard-first вход: O(1) доступ к любому intent по имени. Паттерн не заменяет archetype-specific UI — работает поверх любого projection'а как универсальный keyboard layer.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-height-phase-board-universal-command-palette.json`

### `view-swimlane-regrouping`

- Archetype: catalog
- Status: candidate
- Trigger: `[{"kind":"intent-effect","α":"replace","target":"view.swimlane","minCount":2}]`
- Slot: body
- Hypothesis: View-level группировка, выраженная как intent на view.*, — явный контракт 'клиент может перегруппировать без мутации Φ'. Это не настоящая мутация world — это проекционная трансформация. Паттерн признаёт ортогональность: status остаётся колонками, swimlane становится строками → одна и та же Φ, три layout'а.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-height-phase-board-view-swimlane-regrouping.json`

### `workflow-graph-constrained-cta`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"sub-entity-exists","entity":"Phase","field":"allowedNextPhases"},{"kind":"entity-field","field":"status","referencesEntity":"Phase"},{"kind":"intent-effect","α":"replace","target":"<mainEntity>.status","minCount":2}]`
- Slot: primaryCTA
- Hypothesis: Static enum status даёт фиксированный набор transitions; workflow-graph с allowedNextPhases кодирует business-constraints (нельзя done → in_progress без reopen). Рендер всех n→n переходов нарушит эти constraints либо заставит валидатор гасить уже показанные кнопки, что плохой UX. Фильтрация по графу = single-source-of-truth рендеринг.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-height-phase-board-workflow-graph-constrained-cta.json`

### `global-command-palette`

- Archetype: —
- Status: candidate
- Trigger: `[{"kind":"intent-count","min":15},{"kind":"has-role","value":"owner"}]`
- Slot: overlay
- Hypothesis: Когда intent-поверхность разрастается (≥15 intents, множество projections), navigation через menu-trees становится O(depth) и теряет discoverability; palette даёт O(1) доступ через name-matching, снимает cognitive load по запоминанию иерархии.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-linear-issue-keyboard-flow-global-command-palette.json`

### `hotkey-namespace-shift-modifier`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"intent-count","effect":"replace","min":6,"targetPrefix":"mainEntity"},{"kind":"intent-confirmation","value":"click","min":6}]`
- Slot: sections
- Hypothesis: Hotkey-namespace — conflict-prone shared resource. Без систематических правил назначения collisions создают memorability-долг и убивают keyboard-mastery; shift-modifier — canonical convention для «secondary namespace» (capital letters как shifted primary).
- Falsification matches: 1 should / 2 shouldn't
- Source file: `2026-04-18-linear-issue-keyboard-flow-hotkey-namespace-shift-modifier.json`

### `inline-editable-hero`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"intent-effect","value":"replace","target":"mainEntity.title"},{"kind":"intent-effect","value":"replace","target":"mainEntity.description"},{"kind":"intent-confirmation","value":"enter"}]`
- Slot: hero
- Hypothesis: Edit-modal для hero-полей скрывает context (siblings, sub-entities, siblings' state), а inline-edit сохраняет его и сокращает путь «open modal → edit → save → close». Для identity-defining fields (title/body) контекст ценнее изоляции edit-поверхности.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-linear-issue-keyboard-flow-inline-editable-hero.json`

### `keyboard-property-popover`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"intent-count","effect":"replace","min":4,"targetPrefix":"mainEntity"},{"kind":"intent-confirmation","value":"click","min":4},{"kind":"field-role-present","roles":["status","reference"]}]`
- Slot: sections
- Hypothesis: Когда detail-entity имеет ≥4 scalar/reference свойств с replace-intent, модальные editors создают trip-to-modal friction и ломают context; sidebar+hotkey+inline-popover даёт keyboard-first power-users и click-first casual-users общий surface contract.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-linear-issue-keyboard-flow-keyboard-property-popover.json`

### `optimistic-replace-with-undo`

- Archetype: —
- Status: candidate
- Trigger: `[{"kind":"intent-effect","value":"replace"},{"kind":"intent-confirmation","value":"click"},{"kind":"intent-count","effect":"replace","min":3}]`
- Slot: overlay
- Hypothesis: Confirmation на каждый property-change порождает modal-fatigue и тормозит power-user путь; для reversible операций дешевле скрыть подтверждение и предоставить undo, потому что latency ценнее accuracy. Этот паттерн — дуал к irreversible-confirm.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-linear-issue-keyboard-flow-optimistic-replace-with-undo.json`

### `threaded-comment-stream`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"sub-entity-exists","name":"Comment"},{"kind":"entity-field","entity":"Comment","field":"parentCommentId"},{"kind":"intent-creates","value":"Comment"}]`
- Slot: sections
- Hypothesis: Flat comment-list теряет causality между вопросом и ответом; для sub-entity с self-reference (tree-структура) UI обязан отразить эту структуру, иначе обсуждение деградирует в несвязный feed и теряется context reply-цепочки.
- Falsification matches: 1 should / 2 shouldn't
- Source file: `2026-04-18-linear-issue-keyboard-flow-threaded-comment-stream.json`

### `bulk-selection-toolbar`

- Archetype: feed
- Status: candidate
- Trigger: `[{"kind":"intent-count","min":1,"where":{"idPrefix":"bulk_"}}]`
- Slot: toolbar
- Hypothesis: Если bulk_* intent'ы присутствуют в namespace, это явное заявление, что пользователь обрабатывает items атомарно группой. UX должен поднять selection до first-class, не прятать в contextual menu.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-linear-triage-view-bulk-selection-toolbar.json`

### `entity-promotion`

- Archetype: feed
- Status: candidate
- Trigger: `[{"kind":"intent-creates","entity":"!mainEntity","description":"intent создаёт entity отличную от feed-entity"},{"kind":"intent-confirmation","value":"form"}]`
- Slot: primaryCTA
- Hypothesis: Промоция (issue→project, lead→deal, story→epic) — универсальный lifecycle в продуктах с иерархией сущностей. Это не create-from-scratch (hero-create), а conversion: UX должен отражать continuity (pre-filled form, link back), а не открывать пустую форму.
- Falsification matches: 1 should / 2 shouldn't
- Source file: `2026-04-18-linear-triage-view-entity-promotion.json`

### `keyboard-hotkey-triage`

- Archetype: feed
- Status: candidate
- Trigger: `[{"kind":"intent-count","min":3,"where":{"confirmation":"click","target":"mainEntity"}},{"kind":"has-role","base":"owner"}]`
- Slot: toolbar
- Hypothesis: Когда пользователь обрабатывает десятки items за сессию, keyboard >> mouse. Hotkeys окупаются только при ≥3 click-intentов на item-тип и повторяющемся use-case (inbox/triage).
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-linear-triage-view-keyboard-hotkey-triage.json`

### `saved-query-sidebar`

- Archetype: feed
- Status: candidate
- Trigger: `[{"kind":"sub-entity-exists","hasFilterFields":true,"description":"вспомогательная entity с *Filter полями, описывающая сохранённый запрос к mainEntity"},{"kind":"intent-creates","entity":"<filter-entity>"}]`
- Slot: sections
- Hypothesis: Пользовательские queries — не ad-hoc, они повторяются. Если пользователь явно создаёт Filter/Queue/View entity, это сигнал persistence; такие запросы должны быть one-click доступны в sidebar, а не скрыты в dropdown-inside-dropdown.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-linear-triage-view-saved-query-sidebar.json`

### `source-provenance-card`

- Archetype: feed
- Status: candidate
- Trigger: `[{"kind":"entity-field","entity":"mainEntity","field":"source"},{"kind":"sub-entity-exists","entity":"Source","withDiscriminator":"kind"},{"kind":"field-role-present","role":"icon","onEntity":"Source"}]`
- Slot: body
- Hypothesis: Когда items приходят из разных каналов (email/Slack/widget/API), source — ключевой сигнал для triage-решения (доверие, приоритет, контекст). Прятать его в metadata-строку — терять cognitive-load benefit.
- Falsification matches: 1 should / 2 shouldn't
- Source file: `2026-04-18-linear-triage-view-source-provenance-card.json`

### `undo-toast-irreversible`

- Archetype: feed
- Status: candidate
- Trigger: `[{"kind":"intent-count","min":1,"where":{"irreversibility":"high","confirmation":"click"}},{"kind":"intent-count","min":3,"where":{"confirmation":"click"},"description":"high-throughput контекст"}]`
- Slot: overlay
- Hypothesis: В high-throughput feed (triage, inbox) modal-confirm на каждый destructive — friction killer. Если отменяемо optimistically И item не имеет external side-effect, undo-toast строго лучше modal.
- Falsification matches: 1 should / 2 shouldn't
- Source file: `2026-04-18-linear-triage-view-undo-toast-irreversible.json`

### `board-group-drag-write`

- Archetype: catalog
- Status: candidate
- Trigger: `[{"kind":"entity-field","entity":"Entry","field":"status","fieldType":"select"},{"kind":"intent-effect","α":"replace","target":"entry.status"},{"kind":"intent-confirmation","confirmation":"click"}]`
- Slot: body
- Hypothesis: Kanban сводит status-transition к single-gesture (drag) вместо two-step (open → field-select → save). Визуальное 'где' автоматически несёт семантическое 'какой статус' — zero extra UI.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-notion-database-views-schema-board-group-drag-write.json`

### `calendar-drag-reschedule`

- Archetype: catalog
- Status: candidate
- Trigger: `[{"kind":"field-role-present","entity":"Entry","role":"date"},{"kind":"intent-effect","α":"replace","target":"entry.dueDate"}]`
- Slot: body
- Hypothesis: Календарь единственный архетип, где геометрия ячейки прямо кодирует целевое значение. Drag вместо modal'а сворачивает rescheduling в один жест, альтернатива (open → date-picker → save) требует ≥3 кликов.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-notion-database-views-schema-calendar-drag-reschedule.json`

### `inline-rename-on-enter`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"intent-effect","α":"replace","target":"*.name"},{"kind":"intent-confirmation","confirmation":"enter"}]`
- Slot: header
- Hypothesis: Rename — наиболее частая mutation над именем (view, document, project, goal). Modal для single-field — overkill. Inline-edit сохраняет focus и keyboard-первенство, коммит через Enter — conventional expectation.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-notion-database-views-schema-inline-rename-on-enter.json`

### `multi-archetype-view`

- Archetype: catalog
- Status: candidate
- Trigger: `[{"kind":"entity-field","entity":"View","field":"archetype"},{"kind":"intent-effect","α":"replace","target":"view.archetype"},{"kind":"intent-creates","creates":"View"}]`
- Slot: header
- Hypothesis: Разные задачи требуют разных проекций одних и тех же данных (due-tracking → календарь, prioritization → board, bulk-edit → table). Жёсткая связь archetype↔projection заставляет пользователя дублировать данные или принимать субоптимальный вид.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-notion-database-views-schema-multi-archetype-view.json`

### `open-detail-on-row-click`

- Archetype: catalog
- Status: candidate
- Trigger: `[{"kind":"intent-effect","α":"replace","target":"ui.openEntryId"},{"kind":"intent-confirmation","confirmation":"click"}]`
- Slot: body
- Hypothesis: Catalog-view даёт summary, detail нужен для long-form content, multi-field orchestration, related-entities. Разделение explorative-click ↔ inline-refine сохраняет information-density в catalog и глубину в detail.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-notion-database-views-schema-open-detail-on-row-click.json`

### `per-view-query-state`

- Archetype: catalog
- Status: candidate
- Trigger: `[{"kind":"entity-field","entity":"View","field":"filters"},{"kind":"entity-field","entity":"View","field":"sorts"},{"kind":"intent-effect","α":"replace","target":"view.filters"},{"kind":"intent-effect","α":"replace","target":"view.sorts"}]`
- Slot: toolbar
- Hypothesis: Query-state (scope, order, grouping) — свойство намерения смотрящего, не данных. Персистентные именованные query экономят reconfiguration cost и дают команде shared vocabulary ('Sprint board', 'My inbox').
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-notion-database-views-schema-per-view-query-state.json`

### `polymorphic-rendering-by-discriminator`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"entity-field","entity":"Entry","field":"type","fieldType":"select"},{"kind":"intent-count","predicate":"α:add creates:Entry","min":2}]`
- Slot: body
- Hypothesis: Родственные сущности делят storage + queries + views, но отличаются в одном-двух полях. Discriminator избегает schema-fork'а при сохранении per-type specialization. Union-like polymorphism без type-explosion.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-notion-database-views-schema-polymorphic-rendering-by-discriminator.json`

### `relation-chip-stack`

- Archetype: —
- Status: candidate
- Trigger: `[{"kind":"sub-entity-exists","entity":"Relation","foreignKey":"fromEntryId"},{"kind":"entity-field","entity":"Entry","field":"relations","multivalue":true},{"kind":"intent-creates","creates":"Relation"}]`
- Slot: body
- Hypothesis: Показать title связанной сущности в месте ссылки — zero-navigation context. Chip-stack компактен, поддерживает direct-manipulation remove, деградирует gracefully при количестве. Альтернатива (список-таблица relations) избыточна для small-cardinality.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-notion-database-views-schema-relation-chip-stack.json`

### `table-cell-inline-edit`

- Archetype: catalog
- Status: candidate
- Trigger: `[{"kind":"intent-count","predicate":"α:replace target:entry.* confirmation:enter","min":3},{"kind":"internal"}]`
- Slot: body
- Hypothesis: Bulk-editing требует массово менять одно поле across rows. Modal-per-row prohibitively slow. Inline cell-edit воспроизводит spreadsheet-idiom: keyboard-first, fast tabbing, zero per-row context switch.
- Falsification matches: 1 should / 2 shouldn't
- Source file: `2026-04-18-notion-database-views-schema-table-cell-inline-edit.json`

### `timeline-range-drag`

- Archetype: catalog
- Status: candidate
- Trigger: `[{"kind":"entity-field","entity":"Entry","field":"dateRange"},{"kind":"intent-effect","α":"replace","target":"entry.dateRange"}]`
- Slot: body
- Hypothesis: Project-задачи имеют длительность, не момент. Gantt раскрывает overlap'ы и dependencies, недоступные в calendar (point-in-time). Drag-edges — прямой маппинг геометрии bar на значения start/end.
- Falsification matches: 1 should / 2 shouldn't
- Source file: `2026-04-18-notion-database-views-schema-timeline-range-drag.json`

### `binary-check-badge-grid`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"sub-entity-exists","foreignKey":"mainEntity"},{"kind":"entity-field","entity":"<sub>","field":"kind"},{"kind":"entity-field","entity":"<sub>","field":"result"},{"kind":"entity-kind","entity":"<sub>","statusValuesBinary":["pass","fail"]}]`
- Slot: sections
- Hypothesis: Binary-статус + discriminator (`kind`) — максимально плотный информационный формат. Badge-grid использует pre-attentive processing (цвет+иконка), освобождая когнитивный bandwidth для аномалий. Text-list теряет scan-ability при n > 5.
- Falsification matches: 1 should / 2 shouldn't
- Source file: `2026-04-18-stripe-payments-observer-export-binary-check-badge-grid.json`

### `causal-chain-timeline`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"sub-entity-exists","foreignKey":"mainEntity"},{"kind":"entity-field","entity":"<sub>","field":"causedById","selfReference":true},{"kind":"entity-field","entity":"<sub>","field":"timestamp"}]`
- Slot: sections
- Hypothesis: Self-referential causality несёт информацию, которая теряется при flat-рендере. User нужно видеть что `refunded` возник из-за `disputed`, а не независимо. Причинно-следственная связь — first-class структура, не декоративный attribute.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-stripe-payments-observer-export-causal-chain-timeline.json`

### `export-format-group`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"intent-count","predicate":"creates-same-entity","min":2},{"kind":"entity-field","entity":"<created>","field":"format"},{"kind":"entity-field","entity":"<created>","field":"expiresAt"}]`
- Slot: toolbar
- Hypothesis: Когда 3+ intent'а отличаются только форматом результата, рендер каждого как top-level CTA перегружает visual hierarchy. Группировка в dropdown сохраняет discoverability при низкой визуальной стоимости. Наличие `expiresAt` на created entity — сигнал что это materialization-токен (не transactional side-effect).
- Falsification matches: 1 should / 2 shouldn't
- Source file: `2026-04-18-stripe-payments-observer-export-export-format-group.json`

### `immutable-snapshot-sidecar`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"sub-entity-exists","foreignKey":"mainEntity"},{"kind":"entity-field","entity":"<sub>","field":"capturedAt"},{"kind":"mirror","entity":"<sub>"}]`
- Slot: sections
- Hypothesis: Snapshot vs live-Customer — принципиально разные сущности (правовой статус платежа привязан к state on capture, не current). Рендер как просто ещё один section теряет эту семантику и провоцирует ошибки («customer сменил email, почему в receipt старый?»). Визуальное отличие snapshot-card — компенсация семантики в UI.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-stripe-payments-observer-export-immutable-snapshot-sidecar.json`

### `metadata-kv-readonly`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"entity-field","field":"metadata","semanticType":"json"},{"kind":"field-role-present","role":"user-defined-key-value"}]`
- Slot: sections
- Hypothesis: Metadata — escape-hatch для интеграций, её keys заранее неизвестны и не semantic. Inline-рендер рядом с типизированными полями ломает visual hierarchy (пользователь не отличает системное поле от custom). Отдельная секция с monospace сигналит «это технический контракт, не human-content».
- Falsification matches: 1 should / 2 shouldn't
- Source file: `2026-04-18-stripe-payments-observer-export-metadata-kv-readonly.json`

### `observer-readonly-escape`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"has-role","base":"observer"},{"kind":"intent-count","scope":"role:observer","predicate":"creates-entity","max":1},{"kind":"intent-effect","scope":"role:observer","irreversibility":"high"}]`
- Slot: primaryCTA
- Hypothesis: Observer-роль не совершает транзакционных действий, но иногда нужен escape для компаенса / правового отклика. Единственный CTA снижает когнитивную нагрузку и делает terminal-действие очевидным (vs запрятанным в меню).
- Falsification matches: 1 should / 2 shouldn't
- Source file: `2026-04-18-stripe-payments-observer-export-observer-readonly-escape.json`

### `raw-payload-developer-section`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"sub-entity-exists","foreignKey":"mainEntity"},{"kind":"entity-field","entity":"<sub>","field":"payload","semanticType":"json"},{"kind":"entity-field","entity":"<sub>","field":"type"}]`
- Slot: sections
- Hypothesis: Observer'у с dev-background нужен raw payload для debug / webhook-reconciliation, но human-user не должен тонуть в JSON. Дублирование проекций одного dataset'а закрывает оба запроса без context-switching в другой tool (Postman / API explorer).
- Falsification matches: 1 should / 2 shouldn't
- Source file: `2026-04-18-stripe-payments-observer-export-raw-payload-developer-section.json`

### `computed-preview-setter`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"intent-effect","α":"replace","target":"mainEntity.durationField"},{"kind":"field-role-present","roles":["duration","date"],"minCount":2},{"kind":"entity-field","entity":"mainEntity","fields":["trialEnd","endDate","expiresAt"],"anyOf":true}]`
- Slot: body
- Hypothesis: Relative-input (количество дней) скрывает concrete outcome; показывая computed absolute date рядом с вводом, UI превращает implicit temporal contract в explicit.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-stripe-subscriptions-preapproval-computed-preview-setter.json`

### `grouped-reference-picker`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"intent-effect","α":"replace","targetMatches":".*\\.[a-z]+Id$"},{"kind":"reference","entity":"targetReference"},{"kind":"sub-entity-exists","childOf":"targetReference","viaForeignKey":true}]`
- Slot: body
- Hypothesis: Когда выбираемая сущность имеет FK на parent (Price→Product, Variant→Product, Option→Poll), плоский список теряет контекст; группировка по parent даёт семантическую иерархию и ускоряет поиск.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-stripe-subscriptions-preapproval-grouped-reference-picker.json`

### `lifecycle-locked-parameters`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"sub-entity-exists","childOf":"mainEntity","nameMatches":".*Preapproval$"},{"kind":"entity-field","entity":"mainEntity","field":"status","includes":"active"},{"kind":"intent-count","min":1,"filter":{"α":"replace","targetPrefix":"mainEntity."}}]`
- Slot: sections
- Hypothesis: Поля с lifecycle-contract (captured-at-create, immutable-after-activation) требуют двух режимов отображения: writable во время create-wizard, read-only с explainer после активации — иначе пользователь теряет visibility почему не может редактировать.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-stripe-subscriptions-preapproval-lifecycle-locked-parameters.json`

### `resumable-wizard-with-draft`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"intent-count","min":4,"filter":{"α":"replace","targetPrefix":"subscriptionDraft."}},{"kind":"intent-creates","entity":"mainEntity","confirmation":"form"},{"kind":"intent-effect","α":"add","creates":"mainEntity","idMatches":"save_draft_.*"},{"kind":"entity-field","entity":"mainEntity","field":"status","includes":"draft"}]`
- Slot: body
- Hypothesis: Когда создание сущности требует ≥4 независимых параметров и финальный commit необратим, линейный wizard с сохранением черновика снижает когнитивную нагрузку и риск потери данных по сравнению с одностраничной формой или hero-create модалкой.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-stripe-subscriptions-preapproval-resumable-wizard-with-draft.json`

### `review-summary-before-irreversible`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"intent-effect","α":"add","creates":"mainEntity","irreversibility":"high"},{"kind":"intent-confirmation","intentMatches":"create_.*","confirmation":"form"},{"kind":"intent-count","min":4,"filter":{"α":"replace","targetPrefix":"mainEntityDraft."}}]`
- Slot: primaryCTA
- Hypothesis: irreversible-confirm (single dialog) недостаточен когда собрано ≥4 параметров; read-only review снижает вероятность случайного commit неверного параметра, сохраняя возможность точечного исправления.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-stripe-subscriptions-preapproval-review-summary-before-irreversible.json`

### `soft-hard-termination-pair`

- Archetype: detail
- Status: candidate
- Trigger: `[{"kind":"intent-effect","α":"replace","targetMatches":"mainEntity\\.(cancelAt|endDate|scheduledTermination).*"},{"kind":"intent-effect","α":"remove","entity":"mainEntity","irreversibility":"high"},{"kind":"entity-field","entity":"mainEntity","field":"status","includes":"active"}]`
- Slot: footer
- Hypothesis: Когда сущность имеет lifecycle и прекращение имеет два режима (graceful vs immediate), представление их как связанной пары с явной иерархией снижает accidental-destruction и делает reversibility explicit.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-stripe-subscriptions-preapproval-soft-hard-termination-pair.json`

### `global-command-palette`

- Archetype: —
- Status: candidate
- Trigger: `[{"kind":"intent-count","minimum":10},{"kind":"intent-effect","alpha":"replace","target":"feed.query"},{"kind":"intent-effect","alpha":"replace","target":"feed.folderId"}]`
- Slot: overlay
- Hypothesis: Когда surface > ~15 интентов, плоский memorisation hotkey'ев не масштабируется. Единое fuzzy-поле с унифицированным ранжированием (recent/frecency) даёт O(1) стоимость обнаружения любого действия без запоминания конкретной клавиши.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-superhuman-inbox-keyboard-global-command-palette.json`

### `hierarchical-hotkey-namespace`

- Archetype: —
- Status: candidate
- Trigger: `[{"kind":"intent-count","minimum":20},{"kind":"intent-confirmation","value":"click","minimum":5}]`
- Slot: overlay
- Hypothesis: Плоский hotkey-space ограничен ~26 буквами и Modifier'ами, быстро достигает коллизий. Иерархические chord'ы (G→I) дают экспоненциальное пространство (26² = 676) при сохранении однозначного mnemonics через семантическую группировку ('G для Go').
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-superhuman-inbox-keyboard-hierarchical-hotkey-namespace.json`

### `inline-text-expansion`

- Archetype: —
- Status: candidate
- Trigger: `[{"kind":"entity-field","entity":"*","field":"trigger"},{"kind":"intent-effect","alpha":"replace","target":"*.body"}]`
- Slot: composer
- Hypothesis: Частый reusable-текст (шаблоны ответов, подписи) — низкоэнтропийный ввод. Template-picker требует сменить поле, выбрать, подтвердить — 3 действия. Pattern-typing делает expansion нулевым по стоимости переключения: пользователь не 'выбирает шаблон', он 'пишет быстрее'.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-superhuman-inbox-keyboard-inline-text-expansion.json`

### `master-detail-split-pane`

- Archetype: feed
- Status: candidate
- Trigger: `[{"kind":"sub-entity-exists","parent":"mainEntity","foreignKey":"required"},{"kind":"intent-effect","alpha":"replace","target":"feed.selection"},{"kind":"intent-count","filter":{"target":"feed.selection"},"minimum":2}]`
- Slot: body
- Hypothesis: Когда mainEntity имеет плотный sub-entity граф (Message, комментарии), разделённая панель сохраняет контекст списка и снижает стоимость быстрой навигации — в отличие от drill-in, где каждая сущность — отдельная страница.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-superhuman-inbox-keyboard-master-detail-split-pane.json`

### `optimistic-replace-with-undo`

- Archetype: —
- Status: candidate
- Trigger: `[{"kind":"intent-effect","alpha":"replace","target":"*.status"},{"kind":"intent-confirmation","value":"click"}]`
- Slot: overlay
- Hypothesis: Для частых status-мутаций (archive, mark-read) модальное подтверждение ломает поток; toast с окном отмены даёт ту же защиту от ошибки при меньшем трении. Применим, когда irreversibility=high достигается не за счёт необратимости state, а за счёт объёма (inbox zero за минуты).
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-superhuman-inbox-keyboard-optimistic-replace-with-undo.json`

### `saved-filter-as-folder`

- Archetype: feed
- Status: candidate
- Trigger: `[{"kind":"entity-field","entity":"*","field":"filterRule"},{"kind":"reference"}]`
- Slot: header
- Hypothesis: Пользователю нужны разрезы одного корпуса сущностей, не коробки-для-хранения. Сохранённый фильтр как folder снимает mental-overhead 'куда я это положил' и даёт композируемые разрезы поверх одного источника истины.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-superhuman-inbox-keyboard-saved-filter-as-folder.json`

### `tab-cycle-composer-focus`

- Archetype: —
- Status: candidate
- Trigger: `[{"kind":"intent-creates","entity":"*"},{"kind":"intent-confirmation","value":"enter"},{"kind":"entity-field","entity":"*","minFields":3}]`
- Slot: composer
- Hypothesis: В keyboard-first среде переход 'руки → мышь → руки' съедает флоу. Tab-цикл даёт предсказуемый O(1) переход между полями без leaving home-row; composer ведёт себя как единое state-поле, не как набор виджетов.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-superhuman-inbox-keyboard-tab-cycle-composer-focus.json`

### `temporal-preset-picker`

- Archetype: —
- Status: candidate
- Trigger: `[{"kind":"intent-effect","alpha":"replace","target":"*.<temporal-field>"},{"kind":"field-role-present","role":"timestamp-future"}]`
- Slot: primaryCTA
- Hypothesis: Распределение значений для будущих временных полей сильно скошено к 3–5 типовым сценариям ('через час', 'завтра утром'). Пресеты экономят 2–3 клика в 80% случаев, datepicker остаётся для хвоста.
- Falsification matches: 2 should / 2 shouldn't
- Source file: `2026-04-18-superhuman-inbox-keyboard-temporal-preset-picker.json`
