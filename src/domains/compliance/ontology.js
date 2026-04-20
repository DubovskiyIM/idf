/**
 * Онтология compliance-домена — SOX ICFR provable-UI (13-й полевой тест).
 *
 * Trinity compliance-тезиса:
 *   - SoD (segregation-of-duties) через invariant.kind: "expression" — row-level
 *     предикаты с доступом к world/viewer/context (core@0.33+).
 *   - Evidence-lock через __irr:{high} + first-class Evidence + Amendment.
 *   - Attestation cycle через §4 v1.7 scheduler + transition-invariants.
 *
 * Framework-tag: "SOX-ICFR". Open для будущего overlay поверх 10 существующих
 * доменов (MiFID/HIPAA) — см. roadmap 6.1.
 */
import { RULES } from "./rules.js";

export const ONTOLOGY = {
  domain: "compliance",
  framework: "SOX-ICFR",
  rules: RULES,

  entities: {
    User: {
      ownerField: "id",
      fields: {
        id: { type: "text" },
        name: { type: "text", required: true, label: "Имя" },
        email: { type: "email", required: true },
        departmentId: { type: "entityRef", label: "Отдел" },
        approvalTier: {
          type: "select",
          options: [0, 1, 2, 3],
          label: "Approval tier",
        },
        roleTypes: { type: "text", label: "Роли (JSON)" },
        createdAt: { type: "datetime" },
      },
    },

    Department: {
      kind: "reference",
      fields: {
        id: { type: "text" },
        name: { type: "text", required: true, label: "Отдел" },
      },
    },

    Control: {
      ownerField: "controlOwnerId",
      fields: {
        id: { type: "text" },
        title: { type: "text", required: true, label: "Контроль" },
        description: { type: "text", label: "Описание" },
        category: {
          type: "select",
          options: ["financial-reporting", "access", "change-mgmt", "operations"],
          required: true,
          label: "Категория",
        },
        framework: { type: "text", label: "Framework" },
        controlOwnerId: { type: "entityRef", required: true, label: "Владелец" },
        riskFlag: {
          type: "select",
          options: ["none", "elevated", "high"],
          label: "Риск-флаг",
        },
        createdAt: { type: "datetime" },
      },
    },

    JournalEntry: {
      ownerField: "preparerId",
      fields: {
        id: { type: "text" },
        title: { type: "text", required: true, label: "Заголовок" },
        amount: { type: "number", fieldRole: "money", required: true, label: "Сумма, $" },
        period: { type: "text", required: true, label: "Период" },
        departmentId: { type: "entityRef", required: true, label: "Отдел" },
        preparerId: { type: "entityRef", required: true },
        description: { type: "text", label: "Описание" },
        status: {
          type: "select",
          options: [
            "draft", "submitted", "under_review",
            "changes_requested", "approved", "rejected",
          ],
          required: true,
          label: "Статус",
        },
        rejectionReason: { type: "text", label: "Причина отказа" },
        createdAt: { type: "datetime" },
      },
    },

    Approval: {
      fields: {
        id: { type: "text" },
        entryId: { type: "entityRef", required: true, label: "JE" },
        role: {
          type: "select",
          options: ["reviewer", "approver", "cfo"],
          required: true,
          label: "Роль",
        },
        reviewerId: { type: "entityRef", label: "Reviewer" },
        approverId: { type: "entityRef", label: "Approver" },
        verdict: {
          type: "select",
          options: ["approved", "rejected", "change-requested"],
          required: true,
          label: "Вердикт",
        },
        comment: { type: "text", label: "Комментарий" },
        createdAt: { type: "datetime" },
      },
    },

    AttestationCycle: {
      fields: {
        id: { type: "text" },
        title: { type: "text", required: true, label: "Cycle" },
        framework: { type: "text", label: "Framework" },
        periodStart: { type: "datetime", required: true, label: "Начало периода" },
        periodEnd: { type: "datetime", required: true, label: "Конец периода" },
        status: {
          type: "select",
          options: [
            "opening", "collecting", "reviewing",
            "closed", "closed_with_findings",
          ],
          required: true,
          label: "Статус",
        },
        requiresCfoReview: { type: "boolean", label: "Требует ревью CFO" },
        createdAt: { type: "datetime" },
      },
    },

    Attestation: {
      ownerField: "controlOwnerId",
      fields: {
        id: { type: "text" },
        cycleId: { type: "entityRef", required: true, label: "Cycle" },
        controlId: { type: "entityRef", required: true, label: "Control" },
        controlOwnerId: { type: "entityRef", required: true },
        status: {
          type: "select",
          options: ["pending", "submitted", "confirmed", "findings_raised"],
          required: true,
          label: "Статус",
        },
        effectiveness: {
          type: "select",
          options: ["effective", "ineffective_with_remediation", "ineffective"],
          label: "Эффективность",
        },
        narrative: { type: "text", label: "Обоснование" },
        createdAt: { type: "datetime" },
      },
    },

    Finding: {
      ownerField: "openedById",
      fields: {
        id: { type: "text" },
        title: { type: "text", required: true, label: "Finding" },
        severity: {
          type: "select",
          options: ["deficiency", "significant_deficiency", "material_weakness"],
          required: true,
          label: "Серьёзность",
        },
        relatedAttestationId: { type: "entityRef", label: "Связанная attestation" },
        relatedEntryId: { type: "entityRef", label: "Связанная JE" },
        openedById: { type: "entityRef", required: true },
        status: {
          type: "select",
          options: ["open", "remediating", "closed"],
          required: true,
          label: "Статус",
        },
        note: { type: "text", label: "Заметка" },
        createdAt: { type: "datetime" },
      },
    },

    Evidence: {
      ownerField: "attachedById",
      fields: {
        id: { type: "text" },
        type: {
          type: "select",
          options: ["screenshot", "report_extract", "signed_email", "log_extract", "other"],
          required: true,
          label: "Тип",
        },
        filename: { type: "text", required: true, label: "Файл" },
        sha256: { type: "text", required: true, label: "SHA-256" },
        attachedByEntryId: { type: "entityRef", label: "JE" },
        attachedByAttestationId: { type: "entityRef", label: "Attestation" },
        attachedByControlId: { type: "entityRef", label: "Control" },
        attachedById: { type: "entityRef", required: true },
        createdAt: { type: "datetime" },
      },
    },

    Amendment: {
      ownerField: "authorId",
      fields: {
        id: { type: "text" },
        originalKind: {
          type: "select",
          options: ["JournalEntry", "Attestation"],
          required: true,
          label: "Оригинал (kind)",
        },
        originalId: { type: "entityRef", required: true, label: "Оригинал (id)" },
        authorId: { type: "entityRef", required: true },
        reason: { type: "text", required: true, label: "Причина" },
        fieldChanges: { type: "text", label: "Изменения (JSON)" },
        newEvidenceIds: { type: "text", label: "Новые evidence ids (JSON)" },
        createdAt: { type: "datetime" },
      },
    },
  },

  roles: {
    preparer: {
      base: "owner",
      label: "Preparer",
      canExecute: [
        "create_journal_entry_draft", "edit_journal_entry_draft",
        "submit_je_for_review", "withdraw_je_draft", "attach_evidence_to_je",
        "view_own_activity", "view_evidence",
      ],
      visibleFields: {
        User: "own",
        Department: "all",
        Control: ["id", "title", "category", "framework"],
        JournalEntry: "own",
        Approval: [
          "id", "entryId", "role", "reviewerId", "approverId",
          "verdict", "comment", "createdAt",
        ],
        Evidence: "own",
        Amendment: "own",
      },
    },

    reviewer: {
      base: "agent",
      label: "Reviewer",
      canExecute: [
        "take_review_ticket", "review_je", "request_changes", "reject_je",
        "view_own_activity", "view_evidence",
      ],
      visibleFields: {
        User: ["id", "name", "email", "departmentId"],
        Department: "all",
        JournalEntry: [
          "id", "title", "amount", "period", "departmentId", "preparerId",
          "description", "status", "createdAt",
        ],
        Approval: [
          "id", "entryId", "role", "reviewerId", "approverId",
          "verdict", "comment", "createdAt",
        ],
        Evidence: [
          "id", "type", "filename", "sha256", "attachedByEntryId",
          "attachedById", "createdAt",
        ],
      },
    },

    approver: {
      base: "agent",
      label: "Approver",
      canExecute: [
        "approve_journal_entry", "reject_je_at_approval", "delegate_approval",
        "view_own_activity", "view_evidence",
      ],
      visibleFields: {
        User: ["id", "name", "email", "departmentId", "approvalTier"],
        Department: "all",
        JournalEntry: [
          "id", "title", "amount", "period", "departmentId", "preparerId",
          "description", "status", "createdAt",
        ],
        Approval: [
          "id", "entryId", "role", "reviewerId", "approverId",
          "verdict", "comment", "createdAt",
        ],
        Evidence: [
          "id", "type", "filename", "sha256", "attachedByEntryId",
          "attachedById", "createdAt",
        ],
      },
    },

    controlOwner: {
      base: "owner",
      label: "Control Owner",
      canExecute: [
        "view_my_pending_attestations", "draft_attestation",
        "edit_attestation_draft", "attach_evidence_to_attestation",
        "submit_attestation", "amend_attestation",
        "view_own_activity", "view_evidence", "view_control_test_history",
      ],
      visibleFields: {
        User: "own",
        Control: "own",
        AttestationCycle: "all",
        Attestation: "own",
        Evidence: "own",
        Amendment: "own",
        Finding: [
          "id", "title", "severity", "relatedAttestationId", "relatedEntryId",
          "status", "note", "createdAt",
        ],
      },
    },

    auditor: {
      base: "observer",
      label: "Auditor (external)",
      canExecute: [
        "view_audit_log", "filter_audit_log",
        "flag_finding", "add_finding_note", "update_finding_status",
        "view_sod_matrix", "export_audit_report", "view_evidence",
        "view_own_activity",
      ],
      visibleFields: {
        // observer: read-all
        User: "all", Department: "all", Control: "all",
        JournalEntry: "all", Approval: "all",
        AttestationCycle: "all", Attestation: "all",
        Finding: "all", Evidence: "all", Amendment: "all",
      },
    },

    cfo: {
      base: "agent",
      label: "CFO",
      canExecute: [
        "view_cycle_summary", "sign_off_cycle_404", "reject_cycle_at_signoff",
        "view_own_activity", "view_evidence",
      ],
      visibleFields: {
        User: "all", Department: "all", Control: "all",
        JournalEntry: "all", Approval: "all",
        AttestationCycle: "all", Attestation: "all",
        Finding: "all", Evidence: "all", Amendment: "all",
      },
    },
  },

  invariants: [
    // ── 1-2. Role-capability: admin-action protected (нет `admin`-роли в MVP;
    //        проверяется что соответствующие intents есть в canExecute какой-либо роли
    //        через fallback — в MVP это документ намерения, а доменный admin будет
    //        введён когда authoring surface появится).
    {
      name: "cfo_can_sign_off",
      kind: "role-capability",
      role: "cfo",
      require: { canExecute: "non-empty" },
      severity: "error",
    },

    // ── 3. Auditor — read-only на core-сущности (no α:create/update/remove через UI).
    //      Expression — т.к. role-capability не покрывает block-mutation по alpha.
    {
      name: "auditor_read_only_je",
      kind: "expression",
      entity: "JournalEntry",
      predicate: (_row, _world, viewer, context) => {
        if (!context?.alpha || !viewer) return true;
        if (viewer.roleKey !== "auditor") return true;
        return !["create", "update", "remove"].includes(context.alpha);
      },
      message: "auditor не может мутировать JE",
      severity: "warning", // pass-through (валидатор применит только при viewer-context'е)
    },

    // ── 4. Referential: Approval.entryId → JournalEntry.
    {
      name: "approval_references_je",
      kind: "referential",
      from: "Approval.entryId",
      to: "JournalEntry.id",
      severity: "error",
    },

    // ── 5. Referential: Attestation.cycleId → AttestationCycle.
    {
      name: "attestation_references_cycle",
      kind: "referential",
      from: "Attestation.cycleId",
      to: "AttestationCycle.id",
      severity: "error",
    },

    // ── 5a. Referential: Attestation.controlId → Control.
    {
      name: "attestation_references_control",
      kind: "referential",
      from: "Attestation.controlId",
      to: "Control.id",
      severity: "error",
    },

    // ── 6. Transition: JE.status lifecycle.
    {
      name: "je_status_transition",
      kind: "transition",
      entity: "JournalEntry",
      field: "status",
      transitions: [
        ["draft", "submitted"],
        ["draft", "draft"],
        ["submitted", "under_review"],
        ["under_review", "changes_requested"],
        ["under_review", "approved"],
        ["under_review", "rejected"],
        ["changes_requested", "under_review"],
      ],
      severity: "warning",
    },

    // ── 7. Transition: AttestationCycle.status.
    {
      name: "cycle_status_transition",
      kind: "transition",
      entity: "AttestationCycle",
      field: "status",
      transitions: [
        ["opening", "collecting"],
        ["collecting", "reviewing"],
        ["reviewing", "closed"],
        ["reviewing", "closed_with_findings"],
      ],
      severity: "warning",
    },

    // ── 8. Transition: Attestation.status.
    {
      name: "attestation_status_transition",
      kind: "transition",
      entity: "Attestation",
      field: "status",
      transitions: [
        ["pending", "submitted"],
        ["submitted", "confirmed"],
        ["submitted", "findings_raised"],
      ],
      severity: "warning",
    },

    // ── 9. Cardinality: ≤1 active cycle per period (grouped by periodEnd).
    {
      name: "one_active_cycle_per_period",
      kind: "cardinality",
      entity: "AttestationCycle",
      where: { status: "collecting" },
      groupBy: "periodEnd",
      max: 1,
      severity: "error",
    },

    // ── 10. Cardinality: ≤1 Attestation per (cycleId, controlId) — composite.
    {
      name: "one_attestation_per_control_per_cycle",
      kind: "cardinality",
      entity: "Attestation",
      groupBy: ["cycleId", "controlId"],
      max: 1,
      severity: "error",
    },

    // ── 11. SoD — reviewer != preparer (expression, cross-entity via world).
    {
      name: "sod_reviewer_neq_preparer",
      kind: "expression",
      entity: "Approval",
      where: { role: "reviewer" },
      predicate: (row, world) => {
        const je = (world.journalentries || []).find((j) => j.id === row.entryId);
        return !je || row.reviewerId !== je.preparerId;
      },
      message: "SoD: reviewer === preparer",
      severity: "error",
    },

    // ── 12. SoD — approver != preparer AND approver != reviewer (на том же JE).
    {
      name: "sod_approver_distinct",
      kind: "expression",
      entity: "Approval",
      where: { role: "approver" },
      predicate: (row, world) => {
        const je = (world.journalentries || []).find((j) => j.id === row.entryId);
        if (!je) return true;
        if (row.approverId === je.preparerId) return false;
        const reviewerApproval = (world.approvals || []).find(
          (a) => a.entryId === row.entryId && a.role === "reviewer",
        );
        return !reviewerApproval || row.approverId !== reviewerApproval.reviewerId;
      },
      message: "SoD: approver === preparer или approver === reviewer",
      severity: "error",
    },

    // ── 13. SoD — CFO signer != preparer of any JE in the cycle's scope.
    //      Здесь упрощение MVP: проверка на уровне каждого Approval с role=cfo
    //      (CFO не подписывает JE, где он preparer). Cycle-level агрегат
    //      (CFO не подписывает cycle, содержащий его JE) — roadmap 6.x.
    {
      name: "sod_cfo_neq_own_je_preparer",
      kind: "expression",
      entity: "Approval",
      where: { role: "cfo" },
      predicate: (row, world) => {
        const je = (world.journalentries || []).find((j) => j.id === row.entryId);
        return !je || row.approverId !== je.preparerId;
      },
      message: "SoD: CFO подписывает свой JE",
      severity: "error",
    },

    // ── 14. Dynamic threshold approvals: достаточность подписей зависит от amount.
    //      <$10k: 1 approver; <$100k: reviewer+approver; ≥$100k: reviewer+approver+CFO.
    {
      name: "threshold_approvals_required",
      kind: "expression",
      entity: "JournalEntry",
      where: { status: "approved" },
      predicate: (row, world) => {
        const approvals = (world.approvals || []).filter(
          (a) => a.entryId === row.id && a.verdict === "approved",
        );
        const amount = Number(row.amount || 0);
        const hasRole = (r) => approvals.some((a) => a.role === r);
        if (amount < 10000)  return hasRole("approver");
        if (amount < 100000) return hasRole("reviewer") && hasRole("approver");
        return hasRole("reviewer") && hasRole("approver") && hasRole("cfo");
      },
      message: "JE approved без достаточного числа подписей для amount-tier",
      severity: "error",
    },

    // ── 15. Aggregate: cycle.closed требует, чтобы все Attestations были ≥submitted.
    //      (Pending attestations блокируют закрытие cycle.)
    {
      name: "cycle_close_requires_no_pending_attestations",
      kind: "expression",
      entity: "AttestationCycle",
      where: { status: "closed" },
      predicate: (row, world) => {
        const pending = (world.attestations || []).filter(
          (a) => a.cycleId === row.id && a.status === "pending",
        );
        return pending.length === 0;
      },
      message: "Cycle в 'closed', но остались pending attestations",
      severity: "error",
    },
  ],
};
