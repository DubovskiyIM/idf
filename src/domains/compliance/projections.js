/**
 * Compliance projections — SOX ICFR (13-й полевой тест).
 *
 * 18 проекций по 6 ролям. Первый домен, задействующий все 5 behavioral
 * patterns signal-classifier'а:
 *   monitoring:    controlowner_dashboard, cfo_cycle_overview, control_coverage
 *   triage:        approval_queue, review_queue
 *   execution:     cycle_signoff, attestation_form, create_je_wizard
 *   exploration:   audit_log, findings_catalog, evidence_browser, sod_matrix
 *   configuration: controls_admin, cycles_admin
 */
export const PROJECTIONS = {
  // ═══ Preparer ════════════════════════════════════════════════════════════

  preparer_dashboard: {
    name: "Dashboard (preparer)",
    kind: "dashboard",
    mainEntity: "JournalEntry",
    entities: ["JournalEntry"],
    witnesses: ["title", "amount", "status", "period", "createdAt"],
  },

  my_journal_entries: {
    name: "Мои JE",
    kind: "catalog",
    mainEntity: "JournalEntry",
    entities: ["JournalEntry"],
    filter: "item.preparerId === viewer.id",
    sort: "createdAt:desc",
    witnesses: ["title", "amount", "period", "status", "departmentId"],
    onItemClick: {
      action: "navigate",
      to: "journal_entry_detail_preparer",
      params: { entryId: "item.id" },
    },
  },

  journal_entry_detail_preparer: {
    name: "JE (preparer)",
    kind: "detail",
    mainEntity: "JournalEntry",
    entities: ["JournalEntry", "Approval", "Evidence"],
    idParam: "entryId",
    witnesses: [
      "title", "amount", "period", "departmentId", "status",
      "description", "rejectionReason", "createdAt",
    ],
    subCollections: [
      { entity: "Approval", foreignKey: "entryId", title: "Approvals" },
      { entity: "Evidence", foreignKey: "attachedByEntryId", title: "Evidence",
        addable: true, addIntent: "attach_evidence_to_je" },
    ],
  },

  // ═══ Reviewer ════════════════════════════════════════════════════════════

  review_queue: {
    name: "Ревью queue",
    kind: "catalog",
    mainEntity: "JournalEntry",
    entities: ["JournalEntry"],
    filter: "item.status === 'submitted' && item.preparerId !== viewer.id",
    sort: "createdAt:asc",
    witnesses: ["title", "amount", "period", "preparerId", "departmentId"],
    onItemClick: {
      action: "navigate",
      to: "journal_entry_detail_reviewer",
      params: { entryId: "item.id" },
    },
  },

  journal_entry_detail_reviewer: {
    name: "JE (reviewer)",
    kind: "detail",
    mainEntity: "JournalEntry",
    entities: ["JournalEntry", "Approval", "Evidence"],
    idParam: "entryId",
    witnesses: [
      "title", "amount", "period", "departmentId", "preparerId",
      "description", "status", "createdAt",
    ],
    subCollections: [
      { entity: "Approval", foreignKey: "entryId", title: "Approvals",
        addable: true, addIntent: "review_je" },
      { entity: "Evidence", foreignKey: "attachedByEntryId", title: "Evidence" },
    ],
  },

  // ═══ Approver ════════════════════════════════════════════════════════════

  approval_queue: {
    name: "Approval queue",
    kind: "catalog",
    mainEntity: "JournalEntry",
    entities: ["JournalEntry"],
    filter: "item.status === 'under_review' && item.preparerId !== viewer.id",
    sort: "amount:desc",
    witnesses: ["title", "amount", "period", "preparerId", "departmentId"],
    onItemClick: {
      action: "navigate",
      to: "journal_entry_detail_approver",
      params: { entryId: "item.id" },
    },
  },

  journal_entry_detail_approver: {
    name: "JE (approver)",
    kind: "detail",
    mainEntity: "JournalEntry",
    entities: ["JournalEntry", "Approval", "Evidence"],
    idParam: "entryId",
    witnesses: [
      "title", "amount", "period", "departmentId", "preparerId",
      "description", "status", "createdAt",
    ],
    subCollections: [
      { entity: "Approval", foreignKey: "entryId", title: "Approvals",
        addable: true, addIntent: "approve_journal_entry" },
      { entity: "Evidence", foreignKey: "attachedByEntryId", title: "Evidence" },
    ],
  },

  // ═══ ControlOwner ════════════════════════════════════════════════════════

  controlowner_dashboard: {
    name: "Dashboard (control owner)",
    kind: "dashboard",
    mainEntity: "Attestation",
    entities: ["Attestation", "Control", "AttestationCycle", "Finding"],
    witnesses: ["status", "effectiveness", "cycleId", "controlId"],
  },

  my_controls: {
    name: "Мои controls",
    kind: "catalog",
    mainEntity: "Control",
    entities: ["Control"],
    filter: "item.controlOwnerId === viewer.id",
    sort: "title:asc",
    witnesses: ["title", "category", "riskFlag", "framework"],
    onItemClick: {
      action: "navigate",
      to: "control_detail",
      params: { controlId: "item.id" },
    },
  },

  control_detail: {
    name: "Control",
    kind: "detail",
    mainEntity: "Control",
    entities: ["Control", "Attestation", "Finding"],
    idParam: "controlId",
    witnesses: ["title", "description", "category", "framework", "riskFlag"],
    subCollections: [
      { entity: "Attestation", foreignKey: "controlId", title: "Attestations" },
      { entity: "Finding", foreignKey: "relatedAttestationId", title: "Findings" },
    ],
  },

  attestation_form: {
    name: "Новый attestation",
    kind: "form",
    mainEntity: "Attestation",
    entities: ["Attestation"],
    intent: "draft_attestation",
  },

  attestation_detail: {
    name: "Attestation",
    kind: "detail",
    mainEntity: "Attestation",
    entities: ["Attestation", "Evidence", "Amendment", "Finding"],
    idParam: "attestationId",
    witnesses: ["status", "effectiveness", "narrative", "cycleId", "controlId", "createdAt"],
    subCollections: [
      { entity: "Evidence", foreignKey: "attachedByAttestationId", title: "Evidence",
        addable: true, addIntent: "attach_evidence_to_attestation" },
      { entity: "Amendment", foreignKey: "originalId", title: "Amendments" },
      { entity: "Finding", foreignKey: "relatedAttestationId", title: "Findings" },
    ],
  },

  // ═══ Auditor ═════════════════════════════════════════════════════════════

  audit_log: {
    name: "Audit log",
    kind: "catalog",
    mainEntity: "$effect",
    entities: [],
    materializer: "auditLog",
    shape: "timeline",
    witnesses: ["timestamp", "actor", "type", "entityKind", "entityId", "ruleIds"],
  },

  findings_catalog: {
    name: "Findings",
    kind: "catalog",
    mainEntity: "Finding",
    entities: ["Finding"],
    sort: "createdAt:desc",
    witnesses: ["title", "severity", "status", "relatedAttestationId", "createdAt"],
  },

  sod_matrix_canvas: {
    name: "SoD matrix",
    kind: "canvas",
    mainEntity: "User",
    entities: ["User", "Approval", "JournalEntry"],
    canvasId: "sodMatrix",
  },

  evidence_browser: {
    name: "Evidence browser",
    kind: "catalog",
    mainEntity: "Evidence",
    entities: ["Evidence"],
    sort: "createdAt:desc",
    witnesses: ["type", "filename", "sha256", "attachedById", "createdAt"],
  },

  control_coverage_dashboard: {
    name: "Control coverage",
    kind: "dashboard",
    mainEntity: "Control",
    entities: ["Control", "Attestation", "AttestationCycle"],
    witnesses: ["title", "riskFlag"],
  },

  // ═══ CFO ═════════════════════════════════════════════════════════════════

  cfo_cycle_overview: {
    name: "Cycle overview (CFO)",
    kind: "dashboard",
    mainEntity: "AttestationCycle",
    entities: ["AttestationCycle", "Attestation", "Finding"],
    witnesses: ["title", "status", "periodEnd", "requiresCfoReview"],
  },

  cycle_signoff: {
    name: "404 signoff",
    kind: "form",
    mainEntity: "AttestationCycle",
    entities: ["AttestationCycle"],
    intent: "sign_off_cycle_404",
  },

  // ═══ Admin ═══════════════════════════════════════════════════════════════

  controls_admin: {
    name: "Controls (admin)",
    kind: "catalog",
    mainEntity: "Control",
    entities: ["Control"],
    sort: "title:asc",
    witnesses: ["title", "category", "controlOwnerId", "framework"],
  },

  cycles_admin: {
    name: "Cycles (admin)",
    kind: "catalog",
    mainEntity: "AttestationCycle",
    entities: ["AttestationCycle"],
    sort: "periodEnd:desc",
    witnesses: ["title", "status", "periodStart", "periodEnd", "framework"],
  },

  // ═══ Shared ══════════════════════════════════════════════════════════════

  my_activity: {
    name: "Моя активность",
    kind: "catalog",
    mainEntity: "$effect",
    entities: [],
    materializer: "auditLog",
    filter: "item.actor === viewer.id",
    shape: "timeline",
    witnesses: ["timestamp", "type", "entityKind", "entityId"],
  },
};

export const ROOT_PROJECTIONS = [
  "preparer_dashboard", "my_journal_entries",
  "review_queue",
  "approval_queue",
  "controlowner_dashboard", "my_controls",
  "cfo_cycle_overview", "cycle_signoff",
  "audit_log", "findings_catalog", "sod_matrix_canvas",
  "evidence_browser", "control_coverage_dashboard",
  "controls_admin", "cycles_admin",
  "my_activity",
];
