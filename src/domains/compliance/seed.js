import { v4 as uuid } from "uuid";

/**
 * Seed compliance-домена (SOX ICFR, 13-й полевой тест) для dev-режима.
 *
 * 1 company: "Hypothetical Bank Co.".
 * 5 departments (Operations / Finance / Executive / IT / HR).
 * 10 users: 1 CFO, 1 auditor, 2 preparer (ops+fin), 2 reviewer, 2 approver,
 *           2 controlOwner.
 * 10 controls (SOX-ICFR framework).
 * 3 cycles: Q2-2026 closed, Q3-2026 closed_with_findings, Q4-2026 opening.
 * ~20 JEs в разных статусах (mostly historical approved, few pending).
 * ~15 attestations (Q2+Q3 mostly closed, Q4 mostly pending).
 * 3 findings.
 * 10 evidence files.
 */
export function getSeedEffects() {
  const now = Date.now();
  const effects = [];
  const ef = (props) => effects.push({
    id: uuid(), intent_id: "_seed", alpha: "add", scope: "account",
    parent_id: null, status: "confirmed", ttl: null,
    created_at: now, resolved_at: now, ...props,
  });

  // ── Departments
  const DEPARTMENTS = [
    { id: "dept-ops",  name: "Operations" },
    { id: "dept-fin",  name: "Finance" },
    { id: "dept-exec", name: "Executive" },
    { id: "dept-it",   name: "IT" },
    { id: "dept-hr",   name: "HR" },
  ];
  DEPARTMENTS.forEach(d => ef({ target: "departments", context: d }));

  // ── Users
  const USERS = [
    { id: "alice",  name: "Alice Smith",       email: "alice@bank.local",
      departmentId: "dept-ops", approvalTier: 0, roleTypes: '["preparer"]' },
    { id: "fiona",  name: "Fiona Jones",       email: "fiona@bank.local",
      departmentId: "dept-fin", approvalTier: 0, roleTypes: '["preparer"]' },
    { id: "bob",    name: "Bob Reviewer",      email: "bob@bank.local",
      departmentId: "dept-ops", approvalTier: 0, roleTypes: '["reviewer"]' },
    { id: "rachel", name: "Rachel Reviewer",   email: "rachel@bank.local",
      departmentId: "dept-fin", approvalTier: 0, roleTypes: '["reviewer"]' },
    { id: "dan",    name: "Dan Approver",      email: "dan@bank.local",
      departmentId: "dept-ops", approvalTier: 2, roleTypes: '["approver"]' },
    { id: "ana",    name: "Ana Approver",      email: "ana@bank.local",
      departmentId: "dept-fin", approvalTier: 2, roleTypes: '["approver"]' },
    { id: "oliver", name: "Oliver Owner",      email: "oliver@bank.local",
      departmentId: "dept-fin", approvalTier: 0, roleTypes: '["controlOwner"]' },
    { id: "olga",   name: "Olga Owner",        email: "olga@bank.local",
      departmentId: "dept-it",  approvalTier: 0, roleTypes: '["controlOwner"]' },
    { id: "carol",  name: "Carol CFO",         email: "carol@bank.local",
      departmentId: "dept-exec", approvalTier: 3, roleTypes: '["cfo"]' },
    { id: "eve",    name: "Eve Auditor (PwC)", email: "eve@pwc.local",
      departmentId: null, approvalTier: 0, roleTypes: '["auditor"]' },
  ];
  USERS.forEach(u => ef({ target: "users", context: { ...u, createdAt: now } }));

  // ── Controls (SOX-ICFR)
  const CONTROLS = [
    { id: "ctrl-01", title: "Monthly Balance Sheet Reconciliation",
      category: "financial-reporting", framework: "SOX-ICFR", controlOwnerId: "oliver",
      description: "Ежемесячная сверка остатков по балансу и детальной аналитике" },
    { id: "ctrl-02", title: "Vendor Master Data Change Approval",
      category: "financial-reporting", framework: "SOX-ICFR", controlOwnerId: "oliver",
      description: "Изменения в справочнике поставщиков требуют 4-eyes подтверждения" },
    { id: "ctrl-03", title: "Quarterly Revenue Recognition Review",
      category: "financial-reporting", framework: "SOX-ICFR", controlOwnerId: "oliver",
      description: "Ревью применения ASC 606 на новых контрактах", riskFlag: "elevated" },
    { id: "ctrl-04", title: "User Access Recertification",
      category: "access", framework: "SOX-ICFR", controlOwnerId: "olga",
      description: "Квартальная ревизия прав доступа в финансовых системах" },
    { id: "ctrl-05", title: "Privileged Access Logging",
      category: "access", framework: "SOX-ICFR", controlOwnerId: "olga",
      description: "Логирование действий admin-ролей в ERP" },
    { id: "ctrl-06", title: "Change Management — Financial Systems",
      category: "change-mgmt", framework: "SOX-ICFR", controlOwnerId: "olga",
      description: "Approval всех изменений в GL/Reporting-модулях" },
    { id: "ctrl-07", title: "Payroll Journal Entry Review",
      category: "operations", framework: "SOX-ICFR", controlOwnerId: "oliver",
      description: "Ревью payroll-JE > $500k" },
    { id: "ctrl-08", title: "Fixed Asset Depreciation Recalculation",
      category: "financial-reporting", framework: "SOX-ICFR", controlOwnerId: "oliver",
      description: "Проверка корректности начисленной амортизации" },
    { id: "ctrl-09", title: "Inventory Count Reconciliation",
      category: "operations", framework: "SOX-ICFR", controlOwnerId: "oliver",
      description: "Сверка физ. инвентаризации с balance", riskFlag: "high" },
    { id: "ctrl-10", title: "Backup & Recovery Testing",
      category: "change-mgmt", framework: "SOX-ICFR", controlOwnerId: "olga",
      description: "Ежеквартальный тест восстановления бэкапов фин. систем" },
  ];
  CONTROLS.forEach(c => ef({ target: "controls",
    context: { riskFlag: "none", createdAt: now, ...c } }));

  // ── Attestation cycles
  const CYCLES = [
    { id: "cy-q2-2026", title: "Q2 2026 ICFR", framework: "SOX-ICFR",
      periodStart: "2026-04-01T00:00:00Z", periodEnd: "2026-06-30T23:59:59Z",
      status: "closed", requiresCfoReview: false },
    { id: "cy-q3-2026", title: "Q3 2026 ICFR", framework: "SOX-ICFR",
      periodStart: "2026-07-01T00:00:00Z", periodEnd: "2026-09-30T23:59:59Z",
      status: "closed_with_findings", requiresCfoReview: false },
    { id: "cy-q4-2026", title: "Q4 2026 ICFR", framework: "SOX-ICFR",
      periodStart: "2026-10-01T00:00:00Z", periodEnd: "2026-12-31T23:59:59Z",
      status: "opening", requiresCfoReview: false },
  ];
  CYCLES.forEach(c => ef({ target: "attestationcycles",
    context: { createdAt: now, ...c } }));

  // ── Attestations: для cy-q2 все confirmed; cy-q3 — 8 confirmed + 2 findings_raised;
  //    cy-q4 — pending (опен период).
  const ATTESTATIONS = [];
  function mkAtt(cycleId, controlId, status, effectiveness) {
    const c = CONTROLS.find(x => x.id === controlId);
    ATTESTATIONS.push({
      id: `att-${cycleId}-${controlId}`,
      cycleId, controlId, controlOwnerId: c.controlOwnerId,
      status, effectiveness: effectiveness || null,
      narrative: effectiveness ? `${c.title}: ${effectiveness}` : "",
      createdAt: now,
    });
  }
  CONTROLS.forEach(c => mkAtt("cy-q2-2026", c.id, "confirmed", "effective"));
  CONTROLS.forEach((c, i) => {
    if (i < 8) mkAtt("cy-q3-2026", c.id, "confirmed", "effective");
    else mkAtt("cy-q3-2026", c.id, "findings_raised", "ineffective_with_remediation");
  });
  CONTROLS.forEach((c, i) => {
    if (i < 3) mkAtt("cy-q4-2026", c.id, "pending", null);
    // остальные 7 — пока не созданы (будут при start of cycle)
  });
  ATTESTATIONS.forEach(a => ef({ target: "attestations", context: a }));

  // ── Journal entries: history в Q2/Q3 (approved), несколько pending в Q4.
  const JE_TEMPLATES = [
    { amount: 5200,    dep: "dept-ops", title: "Office supplies reclass" },
    { amount: 18400,   dep: "dept-fin", title: "Accrued vendor expense" },
    { amount: 42000,   dep: "dept-ops", title: "Equipment depreciation adj." },
    { amount: 78500,   dep: "dept-fin", title: "Revenue recognition — Acme Corp" },
    { amount: 125000,  dep: "dept-fin", title: "Goodwill impairment test" },
    { amount: 7200,    dep: "dept-it",  title: "SaaS subscription true-up" },
    { amount: 65000,   dep: "dept-fin", title: "Intercompany settlement" },
    { amount: 9500,    dep: "dept-hr",  title: "Severance accrual" },
    { amount: 210000,  dep: "dept-fin", title: "Major litigation reserve" },
    { amount: 3400,    dep: "dept-ops", title: "Petty cash reclass" },
  ];
  const JES = [];
  JE_TEMPLATES.forEach((tpl, i) => {
    JES.push({
      id: `je-q2-${i+1}`, title: tpl.title, amount: tpl.amount, period: "2026-Q2",
      departmentId: tpl.dep, preparerId: tpl.dep === "dept-fin" ? "fiona" : "alice",
      status: "approved", description: "",
    });
  });
  JE_TEMPLATES.slice(0, 6).forEach((tpl, i) => {
    JES.push({
      id: `je-q3-${i+1}`, title: tpl.title, amount: tpl.amount, period: "2026-Q3",
      departmentId: tpl.dep, preparerId: tpl.dep === "dept-fin" ? "fiona" : "alice",
      status: "approved", description: "",
    });
  });
  // Q4 — open drafts / submitted
  JES.push({ id: "je-q4-1", title: "October payroll accrual", amount: 48000,
    period: "2026-Q4", departmentId: "dept-hr", preparerId: "alice",
    status: "submitted", description: "" });
  JES.push({ id: "je-q4-2", title: "Q4 AR write-off", amount: 12500,
    period: "2026-Q4", departmentId: "dept-fin", preparerId: "fiona",
    status: "draft", description: "" });
  JES.push({ id: "je-q4-3", title: "Cloud infra capitalization", amount: 85000,
    period: "2026-Q4", departmentId: "dept-it", preparerId: "alice",
    status: "under_review", description: "" });
  JES.forEach(j => ef({ target: "journalentries", context: { createdAt: now, ...j } }));

  // ── Approvals для approved JEs
  let apCnt = 0;
  JES.filter(j => j.status === "approved").forEach(j => {
    const amount = j.amount;
    // reviewer
    ef({ target: "approvals", context: {
      id: `ap-${++apCnt}`, entryId: j.id, role: "reviewer",
      reviewerId: j.departmentId === "dept-fin" ? "rachel" : "bob",
      verdict: "approved", createdAt: now,
    }});
    // approver (если amount ≥ 10k)
    if (amount >= 10000) {
      ef({ target: "approvals", context: {
        id: `ap-${++apCnt}`, entryId: j.id, role: "approver",
        approverId: j.departmentId === "dept-fin" ? "ana" : "dan",
        verdict: "approved", createdAt: now,
      }});
    }
    // CFO sign-off (≥ 100k)
    if (amount >= 100000) {
      ef({ target: "approvals", context: {
        id: `ap-${++apCnt}`, entryId: j.id, role: "cfo",
        approverId: "carol", verdict: "approved", createdAt: now,
      }});
    }
  });

  // ── Findings
  const FINDINGS = [
    { id: "find-1", title: "Q3: Inventory reconciliation variance > threshold",
      severity: "significant_deficiency",
      relatedAttestationId: "att-cy-q3-2026-ctrl-09",
      openedById: "eve", status: "open",
      note: "Variance 2.3% exceeds 1% threshold; remediation plan by Q4" },
    { id: "find-2", title: "Q3: Backup recovery test failed for financials DB",
      severity: "significant_deficiency",
      relatedAttestationId: "att-cy-q3-2026-ctrl-10",
      openedById: "eve", status: "remediating",
      note: "Vendor patched; retest scheduled" },
    { id: "find-3", title: "Q2: Unapproved vendor master data change",
      severity: "deficiency",
      relatedAttestationId: null, relatedEntryId: "je-q2-4",
      openedById: "eve", status: "closed",
      note: "Process retrained; closed as remediated" },
  ];
  FINDINGS.forEach(f => ef({ target: "findings", context: { createdAt: now, ...f } }));

  // ── Evidence (≈10 файлов привязанных к attestations)
  const ATT_IDS = ATTESTATIONS.filter(a => a.status === "confirmed").slice(0, 10).map(a => a.id);
  ATT_IDS.forEach((aid, i) => {
    ef({ target: "evidences", context: {
      id: `ev-${i+1}`, type: i % 2 ? "screenshot" : "report_extract",
      filename: `attestation-${i+1}.pdf`,
      sha256: `sha256:${"0".repeat(56)}${(i+1).toString(16).padStart(8, "0")}`,
      attachedByAttestationId: aid, attachedById: "oliver",
      createdAt: now,
    }});
  });

  return effects;
}
