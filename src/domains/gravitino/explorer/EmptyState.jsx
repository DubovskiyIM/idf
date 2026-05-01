/**
 * EmptyState — переиспользуемый empty-state с inline-SVG иллюстрацией (D10).
 *
 * Использование: каждый detail-pane / list рендерит EmptyState когда нет данных.
 * 4 icon kind: catalogs / files / versions / jobs (+ generic fallback).
 */
const ICONS = {
  catalogs: (
    <svg viewBox="0 0 64 64" width={56} height={56} aria-label="empty catalogs illustration">
      <rect x="10" y="20" width="44" height="34" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <rect x="10" y="14" width="20" height="10" rx="2" fill="currentColor" opacity="0.4" />
      <line x1="18" y1="34" x2="46" y2="34" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="18" y1="40" x2="38" y2="40" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </svg>
  ),
  files: (
    <svg viewBox="0 0 64 64" width={56} height={56} aria-label="empty files illustration">
      <path d="M14 10 h26 l10 10 v34 a3 3 0 0 1 -3 3 h-33 a3 3 0 0 1 -3 -3 v-41 a3 3 0 0 1 3 -3 z"
            fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M40 10 v10 h10" fill="none" stroke="currentColor" strokeWidth="2" />
      <line x1="20" y1="32" x2="44" y2="32" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="20" y1="38" x2="44" y2="38" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="20" y1="44" x2="36" y2="44" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </svg>
  ),
  versions: (
    <svg viewBox="0 0 64 64" width={56} height={56} aria-label="empty versions illustration">
      <circle cx="20" cy="20" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="20" cy="44" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="44" cy="32" r="6" fill="currentColor" opacity="0.3" />
      <line x1="20" y1="26" x2="20" y2="38" stroke="currentColor" strokeWidth="2" />
      <line x1="26" y1="20" x2="38" y2="32" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <line x1="26" y1="44" x2="38" y2="32" stroke="currentColor" strokeWidth="2" opacity="0.5" />
    </svg>
  ),
  jobs: (
    <svg viewBox="0 0 64 64" width={56} height={56} aria-label="empty jobs illustration">
      <circle cx="32" cy="32" r="20" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M32 18 v14 l10 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="32" r="3" fill="currentColor" />
    </svg>
  ),
};

export default function EmptyState({ icon, title, description, actionLabel, onAction }) {
  return (
    <div style={{
      padding: 48, textAlign: "center", color: "var(--idf-text-muted)",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
    }}>
      <div style={{ color: "var(--idf-text-muted)", opacity: 0.55 }}>
        {ICONS[icon] || ICONS.catalogs}
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, color: "var(--idf-text)" }}>{title}</div>
      {description && (
        <div style={{ fontSize: 12, color: "var(--idf-text-muted)", maxWidth: 320, lineHeight: 1.5 }}>
          {description}
        </div>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 4, padding: "6px 16px", fontSize: 12, fontWeight: 600,
            border: "1px solid var(--idf-primary, #6478f7)",
            background: "var(--idf-primary, #6478f7)", color: "white",
            borderRadius: 4, cursor: "pointer",
          }}
        >{actionLabel}</button>
      )}
    </div>
  );
}
