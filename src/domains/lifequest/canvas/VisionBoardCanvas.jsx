/**
 * VisionBoardCanvas — доска визуализации / коллаж мечты.
 * 12 сфер жизни, каждая — секция с сеткой изображений.
 * Дудл-стиль: карточки-полароиды с лёгким наклоном и эффектом скотча.
 */
import { useState, useRef, useMemo, useCallback } from "react";

/* ── Хелпер: псевдослучайный поворот по id ── */
function seededRotation(id) {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) | 0;
  }
  return ((h % 700) / 100) - 3; // от -3° до +3°
}

/* ── Стили (inline + CSS-переменные) ── */
const styles = {
  root: {
    padding: "var(--spacing-doodle, 16px)",
    fontFamily: "var(--font-doodle, 'Segoe UI', sans-serif)",
    maxWidth: 1200,
    margin: "0 auto",
  },
  title: {
    fontSize: "1.6rem",
    fontWeight: 700,
    color: "var(--color-doodle-text, #2c2c2c)",
    marginBottom: "var(--spacing-doodle, 16px)",
    textAlign: "center",
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    fontSize: "1.15rem",
    fontWeight: 600,
    color: "var(--color-doodle-heading, #3a3a3a)",
    borderBottom: "2px dashed var(--color-doodle-border, #d4c9a8)",
    paddingBottom: 6,
  },
  sectionIcon: {
    fontSize: "1.3rem",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "var(--spacing-doodle, 16px)",
  },
  card: (rotation) => ({
    position: "relative",
    background: "var(--color-doodle-card-bg, #fffef7)",
    border: "1px solid var(--color-doodle-border, #d4c9a8)",
    borderRadius: "var(--radius-doodle, 4px)",
    padding: "8px 8px 10px",
    boxShadow: "2px 3px 8px rgba(0,0,0,0.12)",
    transform: `rotate(${rotation}deg)`,
    transition: "transform 0.2s ease",
    cursor: "default",
  }),
  tape: {
    position: "absolute",
    top: -6,
    left: "50%",
    transform: "translateX(-50%)",
    width: 40,
    height: 14,
    background: "var(--color-doodle-tape, rgba(255, 230, 150, 0.75))",
    borderRadius: 2,
    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
    zIndex: 1,
  },
  image: {
    width: "100%",
    aspectRatio: "1",
    objectFit: "cover",
    borderRadius: "var(--radius-doodle, 4px)",
    display: "block",
    background: "var(--color-doodle-placeholder, #eee)",
  },
  caption: {
    marginTop: 6,
    fontSize: "0.82rem",
    color: "var(--color-doodle-caption, #5a5243)",
    textAlign: "center",
    minHeight: 20,
    cursor: "pointer",
    wordBreak: "break-word",
  },
  captionInput: {
    width: "100%",
    fontSize: "0.82rem",
    fontFamily: "var(--font-doodle, 'Segoe UI', sans-serif)",
    border: "1px solid var(--color-doodle-border, #d4c9a8)",
    borderRadius: "var(--radius-doodle, 4px)",
    padding: "2px 4px",
    textAlign: "center",
    outline: "none",
    background: "var(--color-doodle-card-bg, #fffef7)",
    color: "var(--color-doodle-caption, #5a5243)",
  },
  deleteBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "none",
    background: "var(--color-doodle-delete-bg, rgba(200,60,60,0.85))",
    color: "#fff",
    fontSize: "0.75rem",
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
    transition: "opacity 0.15s ease",
    zIndex: 2,
  },
  addBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "10px 18px",
    marginTop: 8,
    border: "2px dashed var(--color-doodle-border, #d4c9a8)",
    borderRadius: "var(--radius-doodle, 4px)",
    background: "var(--color-doodle-add-bg, rgba(255,252,240,0.6))",
    color: "var(--color-doodle-text, #5a5243)",
    fontSize: "0.9rem",
    cursor: "pointer",
    fontFamily: "var(--font-doodle, 'Segoe UI', sans-serif)",
    transition: "background 0.15s ease",
  },
  empty: {
    fontSize: "0.85rem",
    color: "var(--color-doodle-muted, #a09880)",
    fontStyle: "italic",
    padding: "12px 0",
  },
};

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
      if (e.key === "Enter") {
        e.preventDefault();
        saveCaption();
      } else if (e.key === "Escape") {
        setEditing(false);
        setDraft(item.caption || "");
      }
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
      style={styles.card(rotation)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Эффект скотча */}
      <div style={styles.tape} />

      {/* Кнопка удаления */}
      <button
        style={{ ...styles.deleteBtn, opacity: hovered ? 1 : 0 }}
        onClick={() => exec("delete_vision_item", { id: item.id })}
        title="Удалить"
        aria-label="Удалить изображение"
      >
        ×
      </button>

      {/* Изображение */}
      <img src={item.imageUrl} alt={item.caption || "Изображение"} style={styles.image} />

      {/* Подпись */}
      {editing ? (
        <input
          ref={inputRef}
          style={styles.captionInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveCaption}
          onKeyDown={handleKeyDown}
          placeholder="Подпись..."
        />
      ) : (
        <div style={styles.caption} onClick={startEdit} title="Нажмите, чтобы изменить подпись">
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

      // Сбросить input для повторного выбора того же файла
      e.target.value = "";
    },
    [sphere.id, exec]
  );

  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionIcon}>{sphere.icon || "🔵"}</span>
        <span>{sphere.name}</span>
      </div>

      {items.length > 0 ? (
        <div style={styles.grid}>
          {items.map((item) => (
            <ImageCard key={item.id} item={item} exec={exec} />
          ))}
        </div>
      ) : (
        <div style={styles.empty}>Пока нет изображений. Добавьте первое!</div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      <button
        style={styles.addBtn}
        onClick={() => fileRef.current?.click()}
        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-doodle-add-hover, rgba(255,245,200,0.9))")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-doodle-add-bg, rgba(255,252,240,0.6))")}
      >
        <span>＋</span>
        <span>Добавить изображение</span>
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
    <div style={styles.root}>
      <div style={styles.title}>Доска визуализации</div>
      {spheres.map((sphere) => (
        <SphereSection
          key={sphere.id}
          sphere={sphere}
          items={groupedBySphere[sphere.id] || []}
          exec={exec}
        />
      ))}
      {spheres.length === 0 && (
        <div style={styles.empty}>Сферы жизни не определены.</div>
      )}
    </div>
  );
}
