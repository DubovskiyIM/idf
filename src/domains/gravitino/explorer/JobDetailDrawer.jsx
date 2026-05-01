/**
 * JobDetailDrawer — right-side drawer с деталями job run (U7).
 * Sections: Status / Timeline / Template / Details (JSON). Cancel button
 * для running jobs (optimistic — реальный intent cancelJob в U7.5).
 */
import JobStatusBadge from "./JobStatusBadge.jsx";

export default function JobDetailDrawer({
  visible, job, template,
  onClose = () => {}, onCancel = () => {},
}) {
  if (!visible || !job) return null;

  const isRunning = job.status === "running" || job.status === "queued";

  const fmtTime = (iso) => iso ? new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "medium" }) : "—";
  const duration = job.startTime
    ? (() => {
        const start = new Date(job.startTime).getTime();
        const end = job.endTime ? new Date(job.endTime).getTime() : Date.now();
        const ms = end - start;
        if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
        if (ms < 3600_000) return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
        return `${Math.floor(ms / 3600_000)}h ${Math.round((ms % 3600_000) / 60_000)}m`;
      })()
    : "—";

  return (
    <div
      role="dialog"
      aria-label={`Job ${job.jobId}`}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        display: "flex", justifyContent: "flex-end",
        background: "rgba(0,0,0,0.4)",
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: 520, height: "100%", overflow: "auto",
          background: "var(--idf-card, #fff)", color: "var(--idf-text)",
          borderLeft: "1px solid var(--idf-border, #e5e7eb)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{
          padding: "14px 18px", display: "flex", alignItems: "center", gap: 10,
          borderBottom: "1px solid var(--idf-border, #e5e7eb)",
          background: "var(--idf-card, #fff)",
        }}>
          <div style={{ flex: 1, fontSize: 14, fontWeight: 600, fontFamily: "monospace" }}>{job.jobId}</div>
          <JobStatusBadge status={job.status} />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: 18, color: "var(--idf-text-muted)", padding: "0 4px",
            }}
          >✕</button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18, flex: 1 }}>
          <Row label="Template" value={template?.name ?? job.templateId ?? "—"} />
          <Row label="Started" value={fmtTime(job.startTime)} />
          <Row label="Finished" value={fmtTime(job.endTime)} />
          <Row label="Duration" value={duration} />

          <Section title="Details">
            {job.details ? (
              <pre style={{
                background: "var(--idf-bg-subtle, #f9fafb)", padding: 12, borderRadius: 4,
                fontSize: 11, lineHeight: 1.5, overflow: "auto", margin: 0,
                color: "var(--idf-text)", border: "1px solid var(--idf-border-subtle, #f3f4f6)",
              }}>{JSON.stringify(job.details, null, 2)}</pre>
            ) : (
              <div style={{ fontSize: 12, color: "var(--idf-text-muted)" }}>Нет деталей</div>
            )}
          </Section>
        </div>

        {isRunning && (
          <div style={{
            padding: "12px 18px", borderTop: "1px solid var(--idf-border, #e5e7eb)",
            display: "flex", justifyContent: "flex-end",
          }}>
            <button
              type="button"
              onClick={() => onCancel(job.id)}
              style={{
                padding: "6px 16px", fontSize: 12, fontWeight: 600,
                border: "1px solid #FF3E1D", background: "transparent", color: "#FF3E1D",
                borderRadius: 4, cursor: "pointer",
              }}
            >Cancel Job</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
      <span style={{ width: 90, fontSize: 11, color: "var(--idf-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
      <span style={{ flex: 1, color: "var(--idf-text)" }}>{value}</span>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div>
      <h4 style={{
        margin: "0 0 8px", fontSize: 11, textTransform: "uppercase",
        letterSpacing: "0.05em", color: "var(--idf-text-muted)",
      }}>{title}</h4>
      {children}
    </div>
  );
}
