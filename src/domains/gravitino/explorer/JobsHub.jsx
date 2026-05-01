/**
 * JobsHub — canvas root для jobs_hub projection (U7 — A8 закрытие).
 * Tabs: Jobs (runs) / Templates. Click row job → JobDetailDrawer.
 *
 * U-backend-exec: runJob / registerJobTemplate через реальный exec.
 * Generic effect handler применяет particles.effects (Run/Template
 * op=replace) — fold обновляет world.jobs / world.job_templates.
 *
 * U-backend-exec-2: cancelJob через exec — custom buildEffects в
 * gravitino/domain.js собирает full-entity overwrite (α:'add' с тем же
 * id) на jobs коллекции c status=cancelled, endTime=now. Локальный
 * cancelledIds Set удалён — display прямо из world.jobs.
 */
import { useMemo, useState } from "react";
import Tabs from "./Tabs.jsx";
import JobStatusBadge from "./JobStatusBadge.jsx";
import JobDetailDrawer from "./JobDetailDrawer.jsx";
import RunJobDialog from "./RunJobDialog.jsx";
import RegisterJobTemplateDialog from "./RegisterJobTemplateDialog.jsx";

const TABS = [
  { key: "jobs", label: "Jobs" },
  { key: "templates", label: "Templates" },
];

export default function JobsHub({ world = {}, exec = () => {}, viewer }) {
  const [active, setActive] = useState("jobs");
  const [drawerJobId, setDrawerJobId] = useState(null);
  const [runJobOpen, setRunJobOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const metalakeName = (world.metalakes || [])[0]?.name || "default";

  const jobs = world.jobs || [];
  const templates = world.job_templates || [];
  const templatesById = useMemo(() => Object.fromEntries(templates.map(t => [t.id, t])), [templates]);

  const drawerJob = jobs.find(j => j.id === drawerJobId);
  const drawerTemplate = drawerJob ? templatesById[drawerJob.templateId] : null;

  const onCancel = (jobId) => {
    const j = jobs.find(x => x.id === jobId);
    if (!j) { setDrawerJobId(null); return; }
    // U-fix-exec-signature: exec(intentId, flatCtx).
    exec("cancelJob", { entity: j, metalake: metalakeName, jobId: j.jobId });
    setDrawerJobId(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Jobs & Templates" subtitle="Job runs и зарегистрированные templates" actionLabel="+ Run Job" onAction={() => setRunJobOpen(true)} />
      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs tabs={TABS} active={active} onChange={setActive}>
          {active === "jobs"      && <JobsTable jobs={jobs} templatesById={templatesById} onRowClick={(j) => setDrawerJobId(j.id)} />}
          {active === "templates" && <TemplatesTable templates={templates} />}
        </Tabs>
      </div>
      <JobDetailDrawer
        visible={!!drawerJob}
        job={drawerJob}
        template={drawerTemplate}
        onClose={() => setDrawerJobId(null)}
        onCancel={onCancel}
      />
      <RunJobDialog
        visible={runJobOpen}
        templates={templates}
        onClose={() => setRunJobOpen(false)}
        onRegisterTemplate={() => { setRunJobOpen(false); setRegisterOpen(true); }}
        onSubmit={({ templateId, templateName, config }) => {
          exec("runJob", {
            templateId,
            templateName,
            metalake: metalakeName,
            jobId: `${templateName}-${new Date().toISOString().slice(0, 16).replace(/[:T-]/g, "")}`,
            status: "queued",
            startTime: new Date().toISOString(),
            endTime: null,
            config,
            details: { triggeredBy: viewer?.name || "UI" },
          });
          setRunJobOpen(false);
        }}
      />
      <RegisterJobTemplateDialog
        visible={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSubmit={(tpl) => {
          exec("registerJobTemplate", {
            ...tpl,
            metalake: metalakeName,
            audit: { creator: viewer?.name || "ui", createTime: new Date().toISOString() },
          });
          setRegisterOpen(false);
        }}
      />
    </div>
  );
}

function Header({ title, subtitle, actionLabel, onAction }) {
  return (
    <div style={{
      padding: "14px 18px",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fff)",
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12,
    }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{title}</h2>
        {subtitle && <div style={{ fontSize: 12, color: "var(--idf-text-muted)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {actionLabel && (
        <button type="button" onClick={onAction}
          style={{ padding: "7px 14px", fontSize: 12, fontWeight: 600, border: "1px solid var(--idf-primary, #6478f7)", background: "var(--idf-primary, #6478f7)", color: "white", borderRadius: 4, cursor: "pointer" }}>{actionLabel}</button>
      )}
    </div>
  );
}

function JobsTable({ jobs, templatesById, onRowClick }) {
  if (jobs.length === 0) return <Empty>Нет jobs</Empty>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
      <thead>
        <tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
          <th style={cellStyle}>Job ID</th>
          <th style={cellStyle}>Template</th>
          <th style={cellStyle}>Status</th>
          <th style={cellStyle}>Started</th>
          <th style={cellStyle}>Duration</th>
        </tr>
      </thead>
      <tbody>
        {jobs.map(j => (
          <tr
            key={j.id}
            onClick={() => onRowClick(j)}
            style={{ cursor: "pointer", borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}
          >
            <td style={{ ...cellStyle, fontFamily: "monospace", fontSize: 12 }}>{j.jobId}</td>
            <td style={cellStyle}>{templatesById[j.templateId]?.name || "—"}</td>
            <td style={cellStyle}><JobStatusBadge status={j.status} /></td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)", fontSize: 12 }}>{fmtTime(j.startTime)}</td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)", fontSize: 12 }}>{fmtDuration(j)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TemplatesTable({ templates }) {
  if (templates.length === 0) return <Empty>Нет templates</Empty>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, color: "var(--idf-text)" }}>
      <thead>
        <tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
          <th style={cellStyle}>Name</th>
          <th style={cellStyle}>Description</th>
          <th style={cellStyle}>Kind</th>
        </tr>
      </thead>
      <tbody>
        {templates.map(t => (
          <tr key={t.id} style={{ borderBottom: "1px solid var(--idf-border, #e5e7eb)" }}>
            <td style={{ ...cellStyle, fontWeight: 500 }}>{t.name}</td>
            <td style={{ ...cellStyle, color: "var(--idf-text-muted)" }}>{t.description || "—"}</td>
            <td style={{ ...cellStyle, fontFamily: "monospace", fontSize: 12 }}>{t.config?.kind || "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Empty({ children }) {
  return <div style={{ padding: 24, textAlign: "center", fontSize: 12, color: "var(--idf-text-muted)" }}>{children}</div>;
}

function fmtTime(iso) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}
function fmtDuration(j) {
  if (!j.startTime) return "—";
  const start = new Date(j.startTime).getTime();
  const end = j.endTime ? new Date(j.endTime).getTime() : Date.now();
  const ms = end - start;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600_000) return `${Math.round(ms / 60_000)}m`;
  return `${Math.floor(ms / 3600_000)}h ${Math.round((ms % 3600_000) / 60_000)}m`;
}

const cellStyle = { padding: "10px 14px", textAlign: "left" };
