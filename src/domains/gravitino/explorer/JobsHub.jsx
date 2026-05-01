/**
 * JobsHub — canvas root для jobs_hub projection (U7 — A8 закрытие).
 * Tabs: Jobs (runs) / Templates. Click row job → JobDetailDrawer.
 * Cancel running job → optimistic status="cancelled".
 */
import { useMemo, useState } from "react";
import Tabs from "./Tabs.jsx";
import JobStatusBadge from "./JobStatusBadge.jsx";
import JobDetailDrawer from "./JobDetailDrawer.jsx";

const TABS = [
  { key: "jobs", label: "Jobs" },
  { key: "templates", label: "Templates" },
];

export default function JobsHub({ world = {} }) {
  const [active, setActive] = useState("jobs");
  const [drawerJobId, setDrawerJobId] = useState(null);
  const [cancelledIds, setCancelledIds] = useState(new Set());

  const baseJobs = world.jobs || [];
  const templates = world.job_templates || [];
  const templatesById = useMemo(() => Object.fromEntries(templates.map(t => [t.id, t])), [templates]);

  const jobs = useMemo(() => baseJobs.map(j => cancelledIds.has(j.id) ? { ...j, status: "cancelled" } : j), [baseJobs, cancelledIds]);

  const drawerJob = jobs.find(j => j.id === drawerJobId);
  const drawerTemplate = drawerJob ? templatesById[drawerJob.templateId] : null;

  const onCancel = (jobId) => {
    setCancelledIds(prev => new Set(prev).add(jobId));
    setDrawerJobId(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Header title="Jobs & Templates" subtitle="Job runs и зарегистрированные templates" />
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
    </div>
  );
}

function Header({ title, subtitle }) {
  return (
    <div style={{
      padding: "14px 18px",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      background: "var(--idf-card, #fff)",
    }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>{title}</h2>
      {subtitle && <div style={{ fontSize: 12, color: "var(--idf-text-muted)", marginTop: 2 }}>{subtitle}</div>}
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
