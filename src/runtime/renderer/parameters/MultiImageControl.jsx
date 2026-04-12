import { useState, useEffect } from "react";

export default function MultiImageControl({ spec, value, onChange, error }) {
  const [images, setImages] = useState(() => {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value) return [value];
    return [];
  });

  useEffect(() => {
    if (Array.isArray(value)) setImages(value);
    else if (typeof value === "string" && value) setImages([value]);
  }, [value]);

  const onFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    let loaded = 0;
    const results = [];
    for (const file of files) {
      const reader = new FileReader();
      reader.onload = () => {
        results.push(reader.result);
        loaded++;
        if (loaded === files.length) {
          const next = [...images, ...results];
          setImages(next);
          onChange(next);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAt = (idx) => {
    const next = images.filter((_, i) => i !== idx);
    setImages(next);
    onChange(next.length > 0 ? next : "");
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--mantine-color-text)", marginBottom: 6 }}>
        {spec.label || spec.name}{spec.required && <span style={{ color: "#ef4444" }}> *</span>}
      </div>

      {images.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          {images.map((src, i) => (
            <div key={i} style={{ position: "relative" }}>
              <img
                src={src}
                alt=""
                style={{
                  width: 80, height: 80, borderRadius: 8,
                  objectFit: "cover",
                  border: "1px solid var(--mantine-color-default-border)",
                }}
              />
              <button
                onClick={() => removeAt(i)}
                style={{
                  position: "absolute", top: -6, right: -6,
                  width: 20, height: 20, borderRadius: "50%",
                  background: "var(--mantine-color-body)",
                  border: "1px solid var(--mantine-color-default-border)",
                  color: "var(--mantine-color-dimmed)",
                  fontSize: 11, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  lineHeight: 1, padding: 0,
                }}
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <label style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 6,
        border: `1px solid ${error ? "#ef4444" : "var(--mantine-color-default-border)"}`,
        background: "var(--mantine-color-default)",
        cursor: "pointer", fontSize: 12,
        color: "var(--mantine-color-text)",
      }}>
        📷 Добавить фото
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={onFileChange}
          style={{ display: "none" }}
        />
      </label>

      {error && <div style={{ fontSize: 11, color: "#ef4444", marginTop: 4 }}>{error}</div>}
    </div>
  );
}
