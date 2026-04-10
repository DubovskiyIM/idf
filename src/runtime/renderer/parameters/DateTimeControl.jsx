export default function DateTimeControl({ spec, value, onChange, error }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
        {spec.label || spec.name}{spec.required && <span style={{ color: "#ef4444" }}> *</span>}
      </span>
      <input
        type="datetime-local"
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: "8px 12px", borderRadius: 6,
          border: `1px solid ${error ? "#ef4444" : "#d1d5db"}`,
          fontSize: 14, outline: "none",
        }}
      />
      {error && <span style={{ fontSize: 11, color: "#ef4444" }}>{error}</span>}
    </label>
  );
}
