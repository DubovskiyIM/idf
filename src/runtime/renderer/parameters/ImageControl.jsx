import { useState, useEffect } from "react";

/**
 * Image control: file picker для изображений + конвертация в data URL
 * через FileReader. Выбранное изображение показывается превью.
 *
 * Value — строка (data URL), сериализуется в JSON для batch-эффектов.
 * Для маленьких аватаров это приемлемо; большие изображения потребуют
 * upload на сервер (M4+).
 */
export default function ImageControl({ spec, value, onChange, error }) {
  const [preview, setPreview] = useState(typeof value === "string" ? value : "");

  useEffect(() => {
    if (typeof value === "string") setPreview(value);
  }, [value]);

  const onFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      setPreview(dataUrl);
      onChange(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>
        {spec.label || spec.name}{spec.required && <span style={{ color: "#ef4444" }}> *</span>}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {preview ? (
          <img
            src={preview}
            alt="preview"
            style={{
              width: 64, height: 64, borderRadius: "50%",
              objectFit: "cover", border: "1px solid #e5e7eb",
            }}
          />
        ) : (
          <div style={{
            width: 64, height: 64, borderRadius: "50%",
            background: "#f3f4f6", border: "1px solid #e5e7eb",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#9ca3af", fontSize: 24,
          }}>?</div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={onFileChange}
          style={{
            padding: "6px 8px", borderRadius: 6,
            border: `1px solid ${error ? "#ef4444" : "#d1d5db"}`,
            fontSize: 12,
          }}
        />
      </div>
      {error && <span style={{ fontSize: 11, color: "#ef4444" }}>{error}</span>}
    </label>
  );
}
