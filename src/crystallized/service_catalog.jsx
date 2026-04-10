/*
 * Кристаллизованная проекция: service_catalog
 * Источник: PROJECTIONS.service_catalog
 * Свидетельства: name, duration, price, specialist.name
 *
 * Намерения (3): select_service, add_service, (delete_review — косвенно через reviews)
 * Сущности: Service (internal), Specialist (internal), Review (internal)
 * Кристаллизовано из 14 намерений · 5 сущностей
 */

import { useState, useMemo } from "react";

export default function ServiceCatalogProjection({ world, exec, drafts, effects }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDuration, setNewDuration] = useState(60);
  const [newPrice, setNewPrice] = useState(1000);

  const specialist = (world.specialists || [])[0];
  const services = (world.services || []).filter(s => s.active);
  const reviews = world.reviews || [];
  const hasDraft = (drafts || []).length > 0;

  // Средний рейтинг специалиста
  const avgRating = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((a, r) => a + (r.rating || 0), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, fontFamily: "system-ui, sans-serif", margin: 0, color: "#1a1a2e" }}>
            {specialist?.name || "Специалист"}
            {avgRating && <span style={{ fontSize: 14, fontWeight: 400, color: "#f59e0b", marginLeft: 8 }}>★ {avgRating}</span>}
          </h2>
          <div style={{ fontSize: 13, color: "#6b7280", fontFamily: "system-ui, sans-serif", marginTop: 2 }}>
            {specialist?.specialization || ""} · {services.length} услуг · {reviews.length} отзывов
          </div>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)}
          style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#6b7280", fontSize: 12, fontFamily: "system-ui, sans-serif", cursor: "pointer" }}>
          {showAddForm ? "Отмена" : "+ Добавить услугу"}
        </button>
      </div>

      {/* Намерение: add_service — creates: Service */}
      {showAddForm && (
        <div style={{ background: "#f9fafb", borderRadius: 8, padding: 16, border: "1px dashed #d1d5db", marginBottom: 16, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Название услуги"
              style={{ flex: 1, padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Длительность (мин)</label>
              <input type="number" value={newDuration} onChange={e => setNewDuration(+e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 4 }}>Цена (₽)</label>
              <input type="number" value={newPrice} onChange={e => setNewPrice(+e.target.value)}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }} />
            </div>
          </div>
          <button onClick={() => {
            exec("add_service", { name: newName, duration: newDuration, price: newPrice });
            setNewName(""); setNewDuration(60); setNewPrice(1000); setShowAddForm(false);
          }}
            disabled={!newName.trim()}
            style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: newName.trim() ? "#6366f1" : "#d1d5db", color: "#fff", fontSize: 13, fontFamily: "system-ui, sans-serif", cursor: newName.trim() ? "pointer" : "default", fontWeight: 600 }}>
            Добавить
          </button>
        </div>
      )}

      {/* Каталог услуг */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {services.map(service => (
          <div key={service.id} style={{
            display: "flex", alignItems: "center", gap: 12, background: "#fff", borderRadius: 8,
            padding: "14px 16px", border: "1px solid #e5e7eb", boxShadow: "0 1px 3px #0001",
          }}>
            <div style={{ flex: 1, fontFamily: "system-ui, sans-serif" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a2e" }}>{service.name}</div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>{service.duration} мин</div>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#6366f1", fontFamily: "system-ui, sans-serif", marginRight: 12 }}>
              {service.price} ₽
            </div>
            <button onClick={() => exec("select_service", { serviceId: service.id })}
              disabled={hasDraft}
              style={{
                padding: "8px 16px", borderRadius: 6, border: "none",
                background: hasDraft ? "#d1d5db" : "#6366f1", color: "#fff",
                fontSize: 13, fontFamily: "system-ui, sans-serif",
                cursor: hasDraft ? "default" : "pointer", fontWeight: 600
              }}>
              Выбрать
            </button>
          </div>
        ))}
      </div>

      {hasDraft && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#f59e0b", fontFamily: "system-ui, sans-serif" }}>
          У вас есть незавершённый черновик Δ. Завершите или отмените его.
        </div>
      )}

      {/* Отзывы */}
      {reviews.length > 0 && (
        <>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8, fontFamily: "system-ui, sans-serif" }}>
            Отзывы ({reviews.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {reviews.sort((a, b) => b.createdAt - a.createdAt).map(review => (
              <div key={review.id} style={{
                background: "#fff", borderRadius: 8, padding: "10px 14px",
                border: "1px solid #e5e7eb", fontFamily: "system-ui, sans-serif",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{ fontSize: 16, color: "#f59e0b", minWidth: 40 }}>{"★".repeat(review.rating)}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#1a1a2e" }}>{review.serviceName}</div>
                  {review.text && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{review.text}</div>}
                </div>
                {/* Намерение: delete_review — irreversibility: medium */}
                <button onClick={() => exec("delete_review", { id: review.id })}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 14 }}
                  onMouseEnter={e => e.target.style.color = "#ef4444"} onMouseLeave={e => e.target.style.color = "#d1d5db"}>
                  ×
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
