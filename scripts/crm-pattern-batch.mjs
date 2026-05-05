#!/usr/bin/env node
/**
 * Pattern Bank batch для CRM-систем.
 *
 * Охват: 3 эталонных приложения:
 *   Salesforce Sales Cloud — enterprise CRM (object-graph, AppExchange, Flow Builder)
 *   HubSpot CRM           — SMB CRM, marketing-sales-service alignment
 *   Pipedrive             — pipeline-first sales CRM, kanban opportunities
 *
 * Использует pattern-researcher.mjs (Phase 1-2-3). По аналогии с
 * uncovered-domains-pattern-batch.mjs.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESEARCHER = join(__dirname, "pattern-researcher.mjs");

const SOURCES = [
  {
    name: "salesforce-sales-cloud",
    archetype: "dashboard",
    description: `Salesforce Sales Cloud (Lightning Experience web + mobile, 2025-2026). Эталон enterprise CRM. Доминирует enterprise сегмент. Object-graph модель + декларативная customization.

Концептуальная модель:
- Standard objects: Account (компания-клиент), Contact (человек в компании), Lead (квалификационный кандидат), Opportunity (сделка), Case (тикет поддержки), Campaign, Task, Event, Quote, Order, Product, Price Book.
- Custom objects — пользователи / админы создают свои __c-объекты с custom fields.
- Relationships: lookup (loose FK), master-detail (cascade), hierarchical, junction (M:N).
- Person Account (B2C режим — Account и Contact объединены).

App Launcher:
- Grid стандартных + custom apps. Apps определяют subset of objects + tabs + utility bar.
- Sales / Service / Marketing — три core clouds.

Tab Bar (Lightning):
- Home / Accounts / Contacts / Leads / Opportunities / Reports / Dashboards / Forecasts / Tasks + custom tabs.
- Каждый tab — список objects данного типа.

Object List View:
- Per-user saved views: "My Open Opportunities", "Recently Viewed", "All Customers > $1M".
- Filter logic: AND/OR с группировкой.
- Inline edit прямо в списке (admin может включить).
- Mass actions: change owner, change status, send email, add to campaign, delete.
- Kanban view (для objects с picklist) — drag-drop между stages.
- Split view — pane слева список, справа detail.

Account Detail (главный «360-view»):
- Header: account name + owner + ownership icon + ratings/score.
- Highlights panel: AnnualRevenue, NumberOfEmployees, Industry, Type, account team.
- Activity timeline tab: Tasks / Events / Calls / Emails / Logged Notes — chronological.
- Related lists: Contacts, Opportunities, Cases, Quotes, Orders, Files, Notes & Attachments, Campaign Members.
- Path component (visual progress — для objects с stages): visual stepper "Prospecting → Discovery → Proposal → Negotiation → Closed".
- Chatter feed — embedded social: post, mention @user, comment, like.
- Tabs: Details / Activity / Chatter / News / Related.

Opportunity (deal):
- Stages: Prospecting / Qualification / Needs Analysis / Proposal / Negotiation / Closed Won / Closed Lost.
- Path с visual stepper + "Mark Stage Complete" CTA + per-stage guidance ("Key Fields", "Guidance for Success").
- Forecast Category: Pipeline / Best Case / Commit / Closed.
- Amount, Close Date, Probability % (auto-derived from stage, override-able).
- Products line items с PriceBook entries.
- Stage history (audit).

Lead (pre-qualified prospect):
- Status: Open – Not Contacted / Working / Qualified / Unqualified.
- Lead Conversion: button → создаёт Account + Contact + (optional) Opportunity, переносит данные.
- Lead source, rating (Hot/Warm/Cold).
- Auto-assignment rules.

Case (Service Cloud):
- Status: New / Working / Escalated / Closed.
- Priority (P1-P4), Severity, SLA timer.
- Auto-routing к queue по rules.
- Knowledge article suggestions.

Reports & Dashboards:
- Report Builder: drag-drop columns, group by, summary functions, filters, charts.
- Cross-object reports через relationships (Account → Opportunities → Products).
- Dashboard — collection of charts с filters.
- Subscriptions — auto-deliver email weekly.

Forecasts:
- Hierarchy: rep → manager → VP rollup.
- Per-quarter forecast values (commit / best case / pipeline) per category.
- Manager edits override and submits to leadership.

Flow Builder (no-code automation):
- Process Builder (legacy) → Flow (modern).
- Triggers: record-triggered (after insert / before update), schedule-triggered, screen flow, autolaunched.
- Elements: assignment, decision, loop, action, screen, get/create/update/delete records, subflow.
- Pause / wait conditions.
- Approval flow с stage-based approvers.

AppExchange (apps marketplace):
- Managed packages — third-party apps installable into org.
- Custom developments через Apex code (server-side Java-like).
- Lightning Web Components — frontend.

Permissions:
- Profiles (один per user, defines base CRUD + field-level security).
- Permission Sets (additive, can stack).
- Sharing rules (criteria-based / owner-based) — automatic record sharing.
- Manual sharing (record owner shares with user/group).
- Role hierarchy — manager sees what reports see (one-way).
- Field-level security per profile / permission set.

Einstein (AI):
- Lead scoring, opportunity scoring (predicted to close).
- Email response prediction (best time, suggested replies).
- Forecasting (predictive forecast).
- Conversation Insights (call recordings analyzed for keywords).
- Einstein Copilot — natural-language conversational assistant над всеми данными.

Activity capture:
- Auto-sync emails из Gmail/Outlook → Salesforce Activity.
- Auto-sync calendar events.
- Auto-log calls.

Mobile app:
- Same data, optimized layouts, voice-search, offline edit, mobile cards.
- Today screen — meetings + tasks + suggested follow-ups.

Communities / Experience Cloud:
- Branded portals для customers / partners / employees over same Salesforce data.

Роли: sales rep (owner of Leads/Opportunities), sales manager (manages team rollup), service agent (Cases), account manager (Account-level), executive (dashboards), admin (configures org), developer (Apex / LWC), partner (limited Community access).

Ключевые intent'ы: create_lead, convert_lead, create_opportunity, advance_stage, mark_won, mark_lost, log_call, log_email, send_email, schedule_event, assign_owner, transfer_account, add_contact_role, build_quote, lock_quote, generate_pdf, submit_for_approval, approve_record, recall_approval, run_report, subscribe_dashboard, run_flow, configure_picklist, install_appexchange_package, share_record_manually.

Эталон. Object-graph (Standard + Custom) с field-level security. Lightning Path stepper для guided stages. Activity timeline (Tasks/Events/Calls/Emails) как universal cross-object panel. Lead Conversion (Lead → Account+Contact+Opportunity) как первоклассный intent. Forecast hierarchy (rep ↔ manager ↔ VP) с category buckets. Flow Builder (declarative automation) + Apex (code) — gradient kasta no-code → pro-code. Profiles + Permission Sets + Sharing Rules — multi-axis ACL.`,
  },
  {
    name: "hubspot-crm",
    archetype: "dashboard",
    description: `HubSpot CRM (web + mobile, 2025-2026). Эталон unified marketing/sales/service платформы для SMB. Free CRM tier + paid Hubs (Marketing / Sales / Service / CMS / Operations / Commerce).

Концептуальная модель:
- Объекты: Contact, Company, Deal, Ticket, Product, Quote, Custom Objects.
- Activities: Email, Call, Meeting, Note, Task — same Activity API across objects.
- Lists — dynamic (criteria-based) или static (manual).
- Workflows — automation across all hubs.

Top Nav:
- CRM (Contacts / Companies / Deals / Tickets / Lists / Inbox)
- Marketing (Email / Forms / Campaigns / Ads / Landing Pages / Social)
- Content (Pages / Blog / Knowledge Base / Podcast)
- Commerce (Products / Quotes / Invoices / Subscriptions / Payments)
- Automation (Workflows / Sequences / Chatflows)
- Reports (Dashboards / Reports / Analytics Tools / Funnels)
- Library (Files / Templates / Snippets / Documents / Meetings / Calling / Playbooks)
- Service Hub (Tickets / Customer Portal / Feedback Surveys / Knowledge Base)

Contact Detail page (canonical 360-view):
- Left sidebar: avatar, name, job title, company link, lifecycle stage, lead status, owner, contact-status timeline.
- Center: Activity timeline — emails sent/received (bidirectional), calls, meetings, notes, tasks, form submissions, page views, lifecycle changes.
- Right sidebar: associated Companies / Deals / Tickets / Conversations + Communication Subscriptions.
- Compose actions inline: Note / Email / Call / Task / Meeting / Log activity / Schedule.
- Properties section: groups (Contact / Email / Conversion / Recent activity / Buying role / Custom).
- Activity filters: by activity type, by user.

Deal pipeline (Sales):
- Kanban board: stages → cards.
- Drag-drop между stages — fires automation (e.g., "Move to Closed Won" → email contact, create invoice).
- Card preview: deal name + amount + close date + owner + days in stage.
- Multiple pipelines (e.g., New Business / Renewals / Upsell).
- Probability per stage (auto + override).

Sales Hub specifics:
- Sequences — automated multi-step email + task cadences (per-contact enrollment).
- Templates — saved emails inserted via "/" in composer.
- Snippets — short reusable blocks.
- Documents — sharable PDFs с view tracking.
- Meetings link — booking page (Calendly-like) с round-robin для team.
- Playbooks — guided card overlays during calls / meetings ("ask discovery questions").
- Calling — VoIP from browser, auto-log, transcription.

Marketing Hub:
- Email tool — drag-drop builder, A/B testing, personalization tokens.
- Forms — embedded на website, captured into CRM.
- Workflows — visual automation:
  - Triggers: form submission, list membership, property change, page view, anniversary.
  - Branches: if/then / value comparison / random.
  - Actions: send email, set property, enrol in sequence, send Slack, webhook, create task.
- Lists: contact-list / company-list, dynamic by criteria или static.
- Campaigns — group assets (emails, ads, pages) под одну кампанию для атрибуции.
- Ads — Facebook/Google/LinkedIn integration, attribution.
- Landing pages + Blog (CMS).

Service Hub:
- Tickets pipeline (kanban) — Status: New / Open / Waiting on Contact / Waiting on Us / Closed.
- Knowledge Base — articles с ratings и search.
- Customer Portal — авторизованный self-service.
- Feedback surveys (NPS / CSAT / CES).
- SLA настройки на pipelines.

Reporting:
- Dashboards — drag-drop виджеты.
- Custom Report Builder — across objects.
- Funnels — multi-stage conversion tracking.
- Attribution reports — first-touch / last-touch / multi-touch / U-shaped.

Inbox (unified communication):
- Conversations — email threads + chat + Facebook Messenger + WhatsApp + forms.
- Assigned to user / team.
- Reply with snippets, mark as closed.
- Auto-routing rules.

Forecast:
- Per-pipeline forecast.
- Categories: Best Case / Commit / Most Likely / Closed.
- Manager submission rollup.

Sequences (cadences):
- 5-10 step series of emails + tasks.
- Triggered manually or by enrol-criteria.
- Auto-pause при reply.
- A/B variants per step.

Workflow Editor:
- Visual graph: trigger → branches → actions.
- Re-enrollment rules.
- Webhook actions.
- AI actions (summarize note, generate email).

Properties:
- Standard + custom (text / number / date / dropdown / checkbox / calculation / score).
- Property groups для UI.
- Calculation properties — formulas across object props.
- Score properties — rules-based (form submission +5, page view +1).

Lifecycle stages (built-in):
- Subscriber / Lead / MQL (Marketing Qualified) / SQL (Sales Qualified) / Opportunity / Customer / Evangelist / Other.
- Automatically advanced by workflow + manual override.

App Marketplace:
- 1500+ apps — Slack, Gmail, Outlook, Zoom, QuickBooks, Stripe, Zapier integrations.

Roles & Permissions:
- Per-user roles (admin / super admin / standard).
- Custom permission sets.
- Teams — group users for routing/reporting.

Mobile app:
- Today: tasks + meetings + recent activity.
- Quick log: call / note / meeting via voice.
- Browse contacts/companies/deals.
- Push для @mentions, task due, deal close.

AI features (Breeze AI):
- Email composition assistant.
- Note summarization.
- Predictive lead scoring.
- Conversation intelligence (call transcription + topics).
- Forecast suggestions.

Roles: sales rep, sales manager, marketer, service rep, customer support agent, customer success manager, account exec, BDR/SDR, admin, developer (API access), customer (Portal).

Ключевые intent'ы: create_contact, associate_company, create_deal, advance_pipeline_stage, log_call, send_one_to_one_email, enrol_in_sequence, create_meeting_link, accept_meeting, create_workflow, trigger_workflow_test, create_form, embed_form, create_list, recompute_list, send_marketing_email, run_ab_test, create_campaign, view_attribution_report, create_ticket, escalate_ticket, run_chatbot, install_app, set_lifecycle_stage, score_lead.

Эталон. Free baseline CRM с upsell-через-Hubs (modular). Activity timeline universal (same composer на Contact/Company/Deal/Ticket). Workflow editor с triggers + branches + AI actions — single visual canvas для всех hubs. Lifecycle stages как universal funnel state. Sequences (cadences) с auto-pause-on-reply. Meetings link / Calling / Documents — sales-tool primitives. Inbox unified (email + chat + WhatsApp + Messenger + forms).`,
  },
  {
    name: "pipedrive-pipeline",
    archetype: "dashboard",
    description: `Pipedrive (web + mobile, 2025-2026). Эталон pipeline-first sales CRM для SMB / mid-market. Дизайн-философия: salespeople не управляют data, они продвигают deals. UI крутится вокруг pipeline view.

Концептуальная модель:
- Deal (центральный) — opportunity / sale-in-progress.
- Person — contact (один человек).
- Organization — компания.
- Lead — pre-deal lightweight record (не загромождает pipeline).
- Activity — Call / Meeting / Email / Task / Custom типы.
- Product — line items в Deal.
- Project (Projects add-on) — post-sale delivery management.
- Custom fields на deals/persons/orgs.

Top Nav:
- Deals (главный) / Activities / Contacts / Leads Inbox / Insights / Mail / Projects / Documents / Campaigns / Marketplace.

Pipeline View (главный экран — defining feature):
- Kanban board: stages в columns (Qualified / Contact Made / Demo Scheduled / Proposal Made / Negotiations Started / Won / Lost).
- Каждая column — deals как карточки.
- Карточка: Title + amount + days-in-stage + activity icons (calls/emails/tasks scheduled или overdue) + person/org pic.
- Drag-drop между stages.
- Прозрачная цветовая система:
  - 🟢 — recent activity, on track.
  - 🟡 — warning (next activity coming up).
  - 🔴 — rotting (overdue activity или no activity X days).
  - 🟣 — completed activity.
- Stage totals summary внизу column: total amount, weighted amount, deal count.
- Multiple pipelines: New Business / Renewals / Service.

Deal Detail page:
- Hero: title + amount + currency + stage + close date + owner.
- Tabs sidebar: Notes / Activities / Email / Files / Calls / Documents / Products.
- Activities tab — schedule next activity (Call / Meeting / Email / Task / Lunch / Custom).
- "Activity-based selling" принцип — deal без scheduled next-activity подсвечивается красным.
- Files / docs sharing.
- Linked person + organization (Pipedrive автоматически suggest based on email).

Leads Inbox:
- Pre-qualification holding area.
- Card view: Lead title + value + status + source.
- "Convert to Deal" — кнопка превращает Lead в Deal с attached person/org.
- Useful чтобы pipeline не загроможден unqualified Leads.

Activities timeline:
- Centralized list across all deals.
- Filter: by user, type, status (overdue / today / this week / future).
- Calendar sync (Google / Outlook / Office365) с two-way sync.
- Inbox view: due today / overdue.

Mail integration:
- Email connector (Gmail / Outlook / IMAP) — emails auto-link to deals/persons.
- Smart Bcc — bcc на специальный адрес → email logged automatically.
- Templates с merge fields.
- Email tracking: open + link clicks.
- Group emails (mass mail).

Insights (analytics):
- Forecast view: weighted amount per stage / per user / per period.
- Conversion rates: stage-to-stage funnel.
- Goal tracking: set target → progress bar.
- Deal duration: average days in stage.
- Activity reports: calls per rep, demos per rep.
- Custom dashboards.

Workflow Automation:
- Trigger-based: deal moved → action.
- Templates: "When deal moves to Proposal, schedule call in 3 days" / "When deal won, create project".
- Webhook + Zapier.
- AI Sales Assistant — recommendations: "Deal X has no activity for 7 days, schedule one".

Smart Docs:
- Templates с merge fields — generate PDF с deal data.
- Embedded e-signature (Pipedrive Sign).
- Sharable links (view tracking).

Campaigns (lite-marketing):
- Email blasts to person lists.
- Templates, A/B, schedules.

Projects (post-sale):
- Project board (kanban или Gantt).
- Phases / tasks / milestones.
- Created from won Deals.

Lead Booster (lite-marketing):
- Web Forms.
- Chatbot.
- Live Chat.
- Prospector (database lookup).

Marketplace:
- Apps: Asana, Trello, Slack, Mailchimp, Twilio, etc.
- Public API + OAuth.

Roles & Permissions:
- Custom permission sets.
- Visibility groups (deal-level: own / team / everyone).

Goals:
- Set personal / team / company-wide.
- Tracked in real-time на dashboard.

Mobile app:
- Pipeline view (swipeable columns).
- Quick activity logging.
- Voice notes attached to deals.
- Caller ID — incoming call recognized → quick-log.

LeadFinder / Smart Contact Data:
- Auto-enrich person/org с public data (LinkedIn-equivalent, web-scraping).

Workflow templates:
- Pre-built playbooks: SaaS sales / agency / real estate / consulting.

Активити-driven philosophy:
- Дашборд показывает "что сделать дальше", не "что произошло".
- Каждый deal без next-activity — красный.
- Salesperson утром открывает Activities → progress through list.

Роли: sales rep (owner of deals), sales manager (visibility on team), admin (configures pipelines + automation), API user (developer), customer (no portal — limited).

Ключевые intent'ы: create_lead, convert_lead_to_deal, advance_pipeline_stage, schedule_activity, complete_activity, log_call, send_template_email, enrich_contact, generate_smart_doc, request_e_signature, set_goal, create_project_from_won_deal, run_automation, attach_product, weighted_forecast.

Эталон. Pipeline kanban — primary surface (не tab, а startup screen). Activity-based selling — color-code rotting deals. Leads Inbox separate from Pipeline (unqualified не загромождают). "Schedule next activity" — coercive constraint (deal без next activity подсвечивается). Smart Bcc для email logging. Goals visible везде. Smart Docs (templates → PDF + e-sign) intrinsic.`,
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
  console.log(`CRM Pattern Batch — ${new Date().toISOString()}`);
  console.log(`Targets: CRM systems — Salesforce Sales Cloud · HubSpot CRM · Pipedrive`);
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
