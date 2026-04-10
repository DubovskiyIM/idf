/*
 * Кристаллизованная проекция: service_catalog
 * Домен: booking · 14 намерений · 5 сущностей
 * Намерения: select_service, add_service, leave_review, delete_review
 */

import { useState, useMemo } from "react";
import { getStyles } from "./theme.js";

export default function ServiceCatalogProjection({ world, exec, drafts, theme = "light", variant = "clean" }) {
  const s = getStyles(theme, variant);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(60);
  const [price, setPrice] = useState(1000);

  const specialist = (world.specialists || [])[0];
  const services = (world.services || []).filter(svc => svc.active);
  const reviews = world.reviews || [];
  const hasDraft = (drafts || []).length > 0;

  const avgRating = useMemo(() => {
    if (reviews.length === 0) return null;
    return (reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length).toFixed(1);
  }, [reviews]);

  return (
    <div style={s.container}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: s.v.gap * 2 }}>
        <div>
          <h2 style={s.heading("h1")}>
            {specialist?.name || "Специалист"}
            {avgRating && <span style={{ fontSize: s.v.fontSize.body, fontWeight: 400, color: s.t.warning, marginLeft: 8 }}>★ {avgRating}</span>}
          </h2>
          <div style={s.text("small")}>{specialist?.specialization} · {services.length} услуг · {reviews.length} отзывов</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={s.buttonOutline()}>{showAdd ? "Отмена" : "+ Услуга"}</button>
      </div>

      {showAdd && (
        <div style={{ ...s.card, border: `1px dashed ${s.t.border}`, marginBottom: s.v.gap * 2 }}>
          <div style={{ display: "flex", gap: s.v.gap, marginBottom: s.v.gap }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Название"
              style={{ flex: 1, padding: s.v.padding / 2, borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.small, fontFamily: s.v.font, background: s.t.surface, color: s.t.text, outline: "none" }} />
          </div>
          <div style={{ display: "flex", gap: s.v.gap, marginBottom: s.v.gap }}>
            <div style={{ flex: 1 }}>
              <div style={{ ...s.text("tiny"), marginBottom: 4 }}>Длительность (мин)</div>
              <input type="number" value={duration} onChange={e => setDuration(+e.target.value)}
                style={{ width: "100%", padding: s.v.padding / 2, borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.small, background: s.t.surface, color: s.t.text, outline: "none" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ ...s.text("tiny"), marginBottom: 4 }}>Цена (₽)</div>
              <input type="number" value={price} onChange={e => setPrice(+e.target.value)}
                style={{ width: "100%", padding: s.v.padding / 2, borderRadius: s.v.radius / 2, border: `1px solid ${s.t.border}`, fontSize: s.v.fontSize.small, background: s.t.surface, color: s.t.text, outline: "none" }} />
            </div>
          </div>
          <button onClick={() => { exec("add_service", { name, duration, price }); setName(""); setShowAdd(false); }}
            disabled={!name.trim()} style={s.button()}>Добавить</button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: s.v.gap }}>
        {services.map(svc => (
          <div key={svc.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: s.v.gap }}>
            <div style={{ flex: 1 }}>
              <div style={s.heading("h2")}>{svc.name}</div>
              <div style={s.text("small")}>{svc.duration} мин {svc.duration > 60 ? `(${Math.ceil(svc.duration/60)} слота)` : ""}</div>
            </div>
            <div style={{ fontSize: s.v.fontSize.h2, fontWeight: 700, color: s.t.accent, fontFamily: s.v.font }}>{svc.price} ₽</div>
            <button onClick={() => exec("select_service", { serviceId: svc.id })}
              disabled={hasDraft} style={hasDraft ? { ...s.button("muted"), cursor: "default" } : s.button()}>Выбрать</button>
          </div>
        ))}
      </div>

      {hasDraft && <div style={{ ...s.text("small"), color: s.t.warning, marginTop: s.v.gap }}>Черновик Δ активен</div>}

      {reviews.length > 0 && (
        <>
          <div style={{ ...s.text("tiny"), textTransform: "uppercase", letterSpacing: "0.05em", marginTop: s.v.gap * 3, marginBottom: s.v.gap }}>Отзывы ({reviews.length})</div>
          {reviews.sort((a, b) => b.createdAt - a.createdAt).map(r => (
            <div key={r.id} style={{ ...s.card, display: "flex", alignItems: "center", gap: s.v.gap, marginBottom: s.v.gap / 2 }}>
              <span style={{ color: s.t.warning, fontSize: s.v.fontSize.body, minWidth: 50 }}>{"★".repeat(r.rating)}</span>
              <div style={{ flex: 1 }}>
                <div style={s.text("small")}>{r.serviceName}</div>
                {r.text && <div style={s.text("tiny")}>{r.text}</div>}
              </div>
              <button onClick={() => exec("delete_review", { id: r.id })}
                style={{ background: "none", border: "none", cursor: "pointer", color: s.t.textMuted, fontSize: 14 }}>×</button>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
