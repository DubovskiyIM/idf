/**
 * VisionBoardCanvas — доска визуализации / коллаж мечты.
 * 12 сфер жизни, каждая — секция с сеткой изображений.
 * Apple visionOS стиль.
 */
import { useState, useRef, useMemo, useCallback } from "react";
import { seededRotation, apple } from "../utils.js";

const font = apple.font;

/* ── Карточка изображения ── */
function ImageCard({ item, exec }) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.caption || "");
  const inputRef = useRef(null);
  const rotation = useMemo(() => seededRotation(item.id), [item.id]);

  const saveCaption = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== (item.caption || "")) {
      exec("edit_vision_caption", { id: item.id, caption: trimmed });
    }
  }, [draft, item.id, item.caption, exec]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") { e.preventDefault(); saveCaption(); }
      else if (e.key === "Escape") { setEditing(false); setDraft(item.caption || ""); }
    },
    [saveCaption, item.caption]
  );

  const startEdit = useCallback(() => {
    setEditing(true);
    setDraft(item.caption || "");
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [item.caption]);

  return (
    <div
      style={{
        position: "relative",
        background: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(40px) saturate(180%)",
        WebkitBackdropFilter: "blur(40px) saturate(180%)",
        border: "0.5px solid rgba(60, 60, 67, 0.06)",
        borderRadius: 12,
        padding: 6,
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
        transform: `rotate(${rotation}deg)`,
        transition: "all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1)",
        cursor: "default",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Кнопка удаления */}
      <button
        style={{
          position: "absolute", top: -6, right: -6,
          width: 24, height: 24, borderRadius: "50%",
          border: "none",
          background: "var(--color-apple-danger, #ff3b30)",
          color: "#fff", fontSize: 12, fontWeight: 700,
          cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.2s",
          zIndex: 2,
          boxShadow: "0 2px 8px rgba(255,59,48,0.3)",
        }}
        onClick={() => exec("delete_vision_item", { id: item.id })}
        title="Удалить"
      >
        ×
      </button>

      {/* Изображение */}
      <img
        src={item.imageUrl}
        alt={item.caption || "Изображение"}
        style={{
          width: "100%", aspectRatio: "1",
          objectFit: "cover", borderRadius: 8,
          display: "block",
          background: "rgba(120, 120, 128, 0.08)",
        }}
      />

      {/* Подпись */}
      {editing ? (
        <input
          ref={inputRef}
          style={{
            width: "100%", marginTop: 6, fontSize: 13,
            fontFamily: font, textAlign: "center",
            border: "0.5px solid var(--color-apple-divider, rgba(60,60,67,0.12))",
            borderRadius: 6, padding: "4px 6px",
            outline: "none",
            background: "rgba(120, 120, 128, 0.08)",
            color: "var(--color-apple-text, #1c1c1e)",
            boxSizing: "border-box",
            letterSpacing: "-0.08px",
          }}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveCaption}
          onKeyDown={handleKeyDown}
          placeholder="Подпись..."
        />
      ) : (
        <div
          onClick={startEdit}
          title="Нажмите, чтобы изменить подпись"
          style={{
            marginTop: 6, fontSize: 13, textAlign: "center",
            color: item.caption
              ? "var(--color-apple-text, #1c1c1e)"
              : "var(--color-apple-text-tertiary, #aeaeb2)",
            fontFamily: font, cursor: "pointer",
            minHeight: 18, wordBreak: "break-word",
            letterSpacing: "-0.08px",
          }}
        >
          {item.caption || "Без подписи"}
        </div>
      )}
    </div>
  );
}

/* ── Секция сферы жизни ── */
function SphereSection({ sphere, items, exec }) {
  const fileRef = useRef(null);

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        exec("add_vision_image", {
          sphereId: sphere.id,
          imageUrl: reader.result,
          caption: "",
        });
      };
      reader.readAsDataURL(file);
      e.target.value = "";
    },
    [sphere.id, exec]
  );

  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        marginBottom: 12, fontSize: 17, fontWeight: 600,
        color: "var(--color-apple-text, #1c1c1e)",
        fontFamily: font,
        letterSpacing: "-0.41px",
        borderBottom: "0.5px solid var(--color-apple-separator, rgba(60,60,67,0.06))",
        paddingBottom: 8,
      }}>
        <span style={{ fontSize: 20 }}>{sphere.icon || "🔵"}</span>
        <span>{sphere.name}</span>
        <span style={{
          marginLeft: "auto", fontSize: 13,
          color: "var(--color-apple-text-tertiary, #aeaeb2)",
        }}>
          {items.length}
        </span>
      </div>

      {items.length > 0 ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 14,
        }}>
          {items.map((item) => (
            <ImageCard key={item.id} item={item} exec={exec} />
          ))}
        </div>
      ) : (
        <div style={{
          fontSize: 15, color: "var(--color-apple-text-tertiary, #aeaeb2)",
          fontStyle: "italic", padding: "8px 0", fontFamily: font,
          letterSpacing: "-0.24px",
        }}>
          Нет изображений
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <button
        onClick={() => fileRef.current?.click()}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 16px", marginTop: 10,
          border: "0.5px solid var(--color-apple-divider, rgba(60,60,67,0.12))",
          borderRadius: 10,
          background: "rgba(120, 120, 128, 0.06)",
          color: "var(--color-apple-accent, #007aff)",
          fontSize: 15, fontWeight: 500,
          cursor: "pointer", fontFamily: font,
          letterSpacing: "-0.24px",
          transition: "background 0.2s",
        }}
      >
        <span>+</span>
        <span>Добавить</span>
      </button>
    </section>
  );
}

/* ── Главный компонент ── */
export default function VisionBoardCanvas({ world, viewer, exec }) {
  const spheres = useMemo(
    () => [...(world.spheres || [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [world.spheres]
  );

  const myItems = useMemo(
    () => (world.visionItems || []).filter((it) => it.userId === viewer.id),
    [world.visionItems, viewer.id]
  );

  const groupedBySphere = useMemo(() => {
    const map = {};
    for (const item of myItems) {
      if (!map[item.sphereId]) map[item.sphereId] = [];
      map[item.sphereId].push(item);
    }
    return map;
  }, [myItems]);

  return (
    <div style={{
      padding: 16, fontFamily: font, maxWidth: 1200, margin: "0 auto",
      color: "var(--color-apple-text, #1c1c1e)",
    }}>
      <div style={{
        fontSize: 28, fontWeight: 700, letterSpacing: "0.36px",
        marginBottom: 20, textAlign: "center",
      }}>
        Карта желаний
      </div>
      {spheres.map((sphere) => (
        <SphereSection
          key={sphere.id}
          sphere={sphere}
          items={groupedBySphere[sphere.id] || []}
          exec={exec}
        />
      ))}
      {spheres.length === 0 && (
        <div style={{
          fontSize: 15, color: "var(--color-apple-text-tertiary, #aeaeb2)",
          fontStyle: "italic", padding: "24px 0", textAlign: "center",
        }}>
          Сферы жизни не определены.
        </div>
      )}
    </div>
  );
}
