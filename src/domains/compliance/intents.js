/**
 * Compliance intents — SOX ICFR (13-й полевой тест).
 *
 * ~38 intents по 6 ролям: preparer (5), reviewer (4), approver (3),
 * controlOwner (6), auditor (7), cfo (3), admin (5 — configure-path),
 * shared/system (5). 4 intent'а с irreversibility:"high":
 *   - approve_journal_entry
 *   - submit_attestation
 *   - sign_off_cycle_404
 *   - file_amendment (+ amend_attestation — domain shorthand)
 */
export const INTENTS = {
  // ═══ Admin (configure-path, 5) ═══════════════════════════════════════════

  configure_control: {
    name: "Добавить control",
    description: "SOX control: title + category + framework + owner",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "title", type: "text", required: true },
        { name: "category", type: "text", required: true },
        { name: "controlOwnerId", type: "entityRef", required: true },
        { name: "description", type: "text" },
      ],
      effects: [{ α: "add", target: "controls", σ: "control" }],
    },
    creates: "Control",
    confirmation: "auto",
  },

  update_control: {
    name: "Обновить control",
    description: "Правка полей существующего control'а",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "title", type: "text" },
        { name: "description", type: "text" },
      ],
      effects: [{ α: "replace", target: "control" }],
    },
    confirmation: "auto",
  },

  deactivate_control: {
    name: "Деактивировать control",
    description: "Снять риск-флаг и вывести из активных",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [{ name: "id", type: "id", required: true }],
      effects: [{ α: "replace", target: "control.riskFlag", value: "none" }],
    },
    confirmation: "manual",
  },

  open_cycle: {
    name: "Открыть attestation cycle",
    description: "Квартальный cycle: framework + period + статус opening",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "title", type: "text", required: true },
        { name: "periodStart", type: "datetime", required: true },
        { name: "periodEnd", type: "datetime", required: true },
        { name: "framework", type: "text" },
      ],
      effects: [{ α: "add", target: "attestationcycles", σ: "cycle" }],
    },
    creates: "AttestationCycle",
    confirmation: "manual",
  },

  cancel_cycle: {
    name: "Отменить cycle",
    description: "Kill-switch: останавливает все pending schedule-таймеры",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "reason", type: "text", required: true },
      ],
      effects: [{ α: "replace", target: "attestationcycle.status", value: "closed" }],
    },
    confirmation: "manual",
  },

  // ═══ Preparer (5) ════════════════════════════════════════════════════════

  create_journal_entry_draft: {
    name: "Создать JE (черновик)",
    description: "Новый journal entry; status=draft, preparerId=viewer",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "title", type: "text", required: true },
        { name: "amount", type: "number", required: true },
        { name: "period", type: "text", required: true },
        { name: "departmentId", type: "entityRef", required: true },
        { name: "description", type: "text" },
      ],
      effects: [{ α: "add", target: "journalentries", σ: "je" }],
    },
    creates: "JournalEntry",
    confirmation: "auto",
  },

  edit_journal_entry_draft: {
    name: "Редактировать JE draft",
    description: "Только пока status=draft",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "title", type: "text" },
        { name: "amount", type: "number" },
        { name: "description", type: "text" },
      ],
      effects: [{ α: "replace", target: "journalentry" }],
    },
    confirmation: "auto",
  },

  submit_je_for_review: {
    name: "Отправить JE на ревью",
    description: "draft → submitted (reviewer queue)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [{ name: "id", type: "id", required: true }],
      effects: [{ α: "replace", target: "journalentry.status", value: "submitted" }],
    },
    confirmation: "manual",
  },

  withdraw_je_draft: {
    name: "Удалить JE draft",
    description: "Только из draft-состояния",
    α: "remove",
    irreversibility: "low",
    particles: {
      parameters: [{ name: "id", type: "id", required: true }],
      effects: [{ α: "remove", target: "journalentry" }],
    },
    confirmation: "manual",
  },

  attach_evidence_to_je: {
    name: "Прикрепить evidence к JE",
    description: "Файл-улика (screenshot / report / etc.) с SHA-256",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "attachedByEntryId", type: "entityRef", required: true },
        { name: "type", type: "text", required: true },
        { name: "filename", type: "text", required: true },
        { name: "sha256", type: "text", required: true },
      ],
      effects: [{ α: "add", target: "evidences", σ: "evidence" }],
    },
    creates: "Evidence",
    confirmation: "auto",
  },

  // ═══ Reviewer (4) ════════════════════════════════════════════════════════

  take_review_ticket: {
    name: "Взять в ревью",
    description: "submitted → under_review",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [{ name: "entryId", type: "id", required: true }],
      effects: [{ α: "replace", target: "journalentry.status", value: "under_review" }],
    },
    confirmation: "auto",
  },

  review_je: {
    name: "Рассмотреть JE (reviewer)",
    description: "Approval-запись с role=reviewer + verdict",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "entryId", type: "id", required: true },
        { name: "verdict", type: "text", required: true },
        { name: "comment", type: "text" },
      ],
      effects: [{ α: "add", target: "approvals", σ: "approval" }],
    },
    creates: "Approval",
    confirmation: "manual",
  },

  request_changes: {
    name: "Запросить правки",
    description: "under_review → changes_requested",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "entryId", type: "id", required: true },
        { name: "comment", type: "text", required: true },
      ],
      effects: [{ α: "replace", target: "journalentry.status", value: "changes_requested" }],
    },
    confirmation: "manual",
  },

  reject_je: {
    name: "Отклонить JE (reviewer)",
    description: "under_review → rejected",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "entryId", type: "id", required: true },
        { name: "rejectionReason", type: "text", required: true },
      ],
      effects: [{ α: "replace", target: "journalentry.status", value: "rejected" }],
    },
    confirmation: "manual",
  },

  // ═══ Approver (3) ════════════════════════════════════════════════════════

  approve_journal_entry: {
    name: "Approve JE",
    description: "Финальное approve: Approval(role=approver) + JE.status=approved; __irr:high (ledger-committed per GAAP)",
    α: "replace",
    irreversibility: "high",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "entryId", type: "id", required: true },
      ],
      effects: [
        { α: "add", target: "approvals", σ: "approval" },
        { α: "replace", target: "journalentry.status", value: "approved" },
      ],
    },
    confirmation: "manual",
  },

  reject_je_at_approval: {
    name: "Отклонить JE (approver)",
    description: "under_review → rejected (approver-level rejection)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "entryId", type: "id", required: true },
        { name: "rejectionReason", type: "text", required: true },
      ],
      effects: [
        { α: "add", target: "approvals", σ: "approval" },
        { α: "replace", target: "journalentry.status", value: "rejected" },
      ],
    },
    confirmation: "manual",
  },

  delegate_approval: {
    name: "Делегировать approval",
    description: "Назначить другого approver'а на JE",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "entryId", type: "id", required: true },
        { name: "approverId", type: "entityRef", required: true },
      ],
      effects: [{ α: "add", target: "approvals", σ: "approval" }],
    },
    confirmation: "manual",
  },

  // ═══ ControlOwner (6) ════════════════════════════════════════════════════

  view_my_pending_attestations: {
    name: "Мои pending attestations",
    description: "Session-scope view",
    α: "replace",
    irreversibility: "low",
    particles: { parameters: [], effects: [] },
    confirmation: "auto",
  },

  draft_attestation: {
    name: "Черновик attestation",
    description: "Создать attestation-row для cycle+control",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "cycleId", type: "entityRef", required: true },
        { name: "controlId", type: "entityRef", required: true },
      ],
      effects: [{ α: "add", target: "attestations", σ: "attestation" }],
    },
    creates: "Attestation",
    confirmation: "auto",
  },

  edit_attestation_draft: {
    name: "Править attestation draft",
    description: "Только в pending-state",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "narrative", type: "text" },
        { name: "effectiveness", type: "text" },
      ],
      effects: [{ α: "replace", target: "attestation" }],
    },
    confirmation: "auto",
  },

  attach_evidence_to_attestation: {
    name: "Evidence к attestation",
    description: "Файл-подтверждение effectiveness",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "attachedByAttestationId", type: "entityRef", required: true },
        { name: "type", type: "text", required: true },
        { name: "filename", type: "text", required: true },
        { name: "sha256", type: "text", required: true },
      ],
      effects: [{ α: "add", target: "evidences", σ: "evidence" }],
    },
    creates: "Evidence",
    confirmation: "auto",
  },

  submit_attestation: {
    name: "Submit attestation",
    description: "pending → submitted; __irr:high (evidence locked per SOX §404)",
    α: "replace",
    irreversibility: "high",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "effectiveness", type: "text", required: true },
        { name: "narrative", type: "text", required: true },
      ],
      effects: [{ α: "replace", target: "attestation.status", value: "submitted" }],
    },
    confirmation: "manual",
  },

  amend_attestation: {
    name: "Amendment к attestation",
    description: "Forward-correction через Amendment-record; оригинал preserved",
    α: "add",
    irreversibility: "high",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "originalId", type: "entityRef", required: true },
        { name: "reason", type: "text", required: true },
        { name: "fieldChanges", type: "text", required: true },
      ],
      effects: [{ α: "add", target: "amendments", σ: "amendment" }],
    },
    creates: "Amendment",
    confirmation: "manual",
  },

  // ═══ CFO (3) ═════════════════════════════════════════════════════════════

  view_cycle_summary: {
    name: "Cycle summary (CFO view)",
    description: "High-level по всем активным cycles",
    α: "replace",
    irreversibility: "low",
    particles: { parameters: [], effects: [] },
    confirmation: "auto",
  },

  sign_off_cycle_404: {
    name: "Подписать 404 (CFO)",
    description: "Финальный SOX §404 signoff; __irr:high (§302 personal accountability)",
    α: "replace",
    irreversibility: "high",
    particles: {
      parameters: [{ name: "cycleId", type: "id", required: true }],
      effects: [{ α: "replace", target: "attestationcycle.status", value: "closed" }],
    },
    confirmation: "manual",
  },

  reject_cycle_at_signoff: {
    name: "Отклонить cycle на signoff",
    description: "cycle → closed_with_findings (открытые deficiencies)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "cycleId", type: "id", required: true },
        { name: "reason", type: "text", required: true },
      ],
      effects: [{ α: "replace", target: "attestationcycle.status", value: "closed_with_findings" }],
    },
    confirmation: "manual",
  },

  // ═══ Auditor (7) ═════════════════════════════════════════════════════════

  view_audit_log: {
    name: "Audit log",
    description: "Derived view над Φ (materializeAuditLog)",
    α: "replace",
    irreversibility: "low",
    particles: { parameters: [], effects: [] },
    confirmation: "auto",
  },

  filter_audit_log: {
    name: "Фильтр audit log",
    description: "Session-scope: actorId / timeRange / intentTypes",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "actorId", type: "text" },
        { name: "from", type: "datetime" },
        { name: "to", type: "datetime" },
        { name: "intentTypes", type: "text" },
      ],
      effects: [],
    },
    confirmation: "auto",
  },

  flag_finding: {
    name: "Поднять Finding",
    description: "Auditor flag: deficiency / significant_deficiency / material_weakness",
    α: "add",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "title", type: "text", required: true },
        { name: "severity", type: "text", required: true },
        { name: "relatedAttestationId", type: "entityRef" },
        { name: "relatedEntryId", type: "entityRef" },
        { name: "note", type: "text" },
      ],
      effects: [{ α: "add", target: "findings", σ: "finding" }],
    },
    creates: "Finding",
    confirmation: "manual",
  },

  add_finding_note: {
    name: "Note к finding",
    description: "Append заметки (replace note)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "note", type: "text", required: true },
      ],
      effects: [{ α: "replace", target: "finding.note" }],
    },
    confirmation: "auto",
  },

  update_finding_status: {
    name: "Статус finding",
    description: "open → remediating → closed",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "status", type: "text", required: true },
      ],
      effects: [{ α: "replace", target: "finding.status" }],
    },
    confirmation: "manual",
  },

  view_sod_matrix: {
    name: "SoD matrix",
    description: "Canvas: preparer × approver × department с highlight conflicts",
    α: "replace",
    irreversibility: "low",
    particles: { parameters: [], effects: [] },
    confirmation: "auto",
  },

  export_audit_report: {
    name: "Export audit report",
    description: "PDF-like документ поверх documentMaterializer (quarterly 10-Q exhibit)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [{ name: "cycleId", type: "id" }],
      effects: [],
    },
    confirmation: "auto",
  },

  // ═══ Shared / cross-role (5) ═════════════════════════════════════════════

  view_own_activity: {
    name: "Моя активность",
    description: "Self-scoped audit_log (actor=viewer)",
    α: "replace",
    irreversibility: "low",
    particles: { parameters: [], effects: [] },
    confirmation: "auto",
  },

  view_evidence: {
    name: "Evidence viewer",
    description: "Просмотр файла по id (viewer-scoped через role.visibleFields)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [{ name: "id", type: "id", required: true }],
      effects: [],
    },
    confirmation: "auto",
  },

  view_control_test_history: {
    name: "История attestations control'а",
    description: "Аудиторский drill-down за последние N cycles",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [{ name: "controlId", type: "id", required: true }],
      effects: [],
    },
    confirmation: "auto",
  },

  file_amendment: {
    name: "File amendment (generic)",
    description: "Forward-correction для JE или Attestation; __irr:high (SOX evidence-preservation)",
    α: "add",
    irreversibility: "high",
    particles: {
      parameters: [
        { name: "id", type: "id", required: true },
        { name: "originalKind", type: "text", required: true },
        { name: "originalId", type: "entityRef", required: true },
        { name: "reason", type: "text", required: true },
        { name: "fieldChanges", type: "text", required: true },
      ],
      effects: [{ α: "add", target: "amendments", σ: "amendment" }],
    },
    creates: "Amendment",
    confirmation: "manual",
  },

  download_evidence_file: {
    name: "Скачать evidence",
    description: "Blob по sha256 (placeholder в MVP)",
    α: "replace",
    irreversibility: "low",
    particles: {
      parameters: [{ name: "id", type: "id", required: true }],
      effects: [],
    },
    confirmation: "auto",
  },
};
