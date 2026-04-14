/**
 * MoodMeterCanvas — 2D-вход для emotion diary.
 * Клик на 2D-плоскости (pleasantness × energy) → quick_checkin.
 * Кнопка «Подробнее...» → detail-форма с эмоциями/заметкой/активностями.
 * Apple visionOS-glass styling.
 */
import { useState, useMemo } from "react";
import {
  EMOTIONS_BY_QUADRANT, ALL_EMOTIONS, EMOTION_BY_ID,
  QUADRANT_COLORS, QUADRANT_LABELS,
  computeQuadrant, defaultEmotionForQuadrant,
} from "../emotions.js";

const EASE = "cubic-bezier(0.25,0.1,0.25,1)";
const GLASS = {
  background: "rgba(255,255,255,0.7)",
  backdropFilter: "blur(40px) saturate(180%)",
  WebkitBackdropFilter: "blur(40px) saturate(180%)",
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 18,
  boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
};

const SIZE = 320;
const HALF = SIZE / 2;
const SCALE = 0.45 * SIZE; // full extent for value 5

function coordsForValue(p, e) {
  // p ∈ [-5..5], e ∈ [-5..5]
  const cx = HALF + (p / 5) * SCALE;
  const cy = HALF - (e / 5) * SCALE;
  return { cx, cy };
}

function valueFromCoords(x, y) {
  const p = Math.max(-5, Math.min(5, ((x - HALF) / SCALE) * 5));
  const e = Math.max(-5, Math.min(5, ((HALF - y) / SCALE) * 5));
  return { pleasantness: Math.round(p), energy: Math.round(e) };
}

export default function MoodMeterCanvas({ world, viewer, exec, ctx }) {
  const [detailMode, setDetailMode] = useState(false);
  const [previewPoint, setPreviewPoint] = useState(null);
  const [detailDraft, setDetailDraft] = useState({
    pleasantness: 0, energy: 0, emotion: "calm", note: "", activityIds: [],
  });

  const font = "var(--font-apple, -apple-system, BlinkMacSystemFont, system-ui, sans-serif)";
  const textColor = "var(--color-apple-text, #1d1d1f)";
  const textSecondary = "var(--color-apple-text-secondary, #86868b)";
  const divider = "var(--color-apple-divider, rgba(0,0,0,0.1))";
  const accent = "var(--color-apple-accent, #007aff)";
  const pad = "var(--spacing-doodle, 16px)";

  const recentEntries = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 3600 * 1000;
    return (world.moodEntries || [])
      .filter(en => en.userId === viewer?.id)
      .filter(en => {
        const t = new Date(en.createdAt || en.timestamp || 0).getTime();
        return t >= weekAgo;
      });
  }, [world.moodEntries, viewer?.id]);

  const activities = useMemo(() => {
    return (world.activities || []).filter(a => a.userId === viewer?.id || a.userId === null || a.userId === undefined);
  }, [world.activities, viewer?.id]);

  const preview = previewPoint;
  const previewQuadrant = preview ? computeQuadrant(preview.pleasantness, preview.energy) : null;
  const previewEmotion = preview ? EMOTION_BY_ID[defaultEmotionForQuadrant(previewQuadrant)] : null;

  const handleSvgMove = (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const touch = ev.touches?.[0];
    const clientX = touch ? touch.clientX : ev.clientX;
    const clientY = touch ? touch.clientY : ev.clientY;
    const x = ((clientX - rect.left) / rect.width) * SIZE;
    const y = ((clientY - rect.top) / rect.height) * SIZE;
    setPreviewPoint(valueFromCoords(x, y));
  };

  const handleSvgLeave = () => setPreviewPoint(null);

  const handleSvgClick = (ev) => {
    const rect = ev.currentTarget.getBoundingClientRect();
    const clientX = ev.clientX ?? ev.changedTouches?.[0]?.clientX;
    const clientY = ev.clientY ?? ev.changedTouches?.[0]?.clientY;
    const x = ((clientX - rect.left) / rect.width) * SIZE;
    const y = ((clientY - rect.top) / rect.height) * SIZE;
    const { pleasantness, energy } = valueFromCoords(x, y);
    exec("quick_checkin", { pleasantness, energy });
    setPreviewPoint(null);
  };

  const openDetail = () => {
    const p = preview?.pleasantness ?? 0;
    const e = preview?.energy ?? 0;
    const q = computeQuadrant(p, e);
    setDetailDraft({
      pleasantness: p, energy: e,
      emotion: defaultEmotionForQuadrant(q),
      note: "", activityIds: [],
    });
    setDetailMode(true);
  };

  const saveDetailed = () => {
    exec("detailed_checkin", { ...detailDraft });
    setDetailMode(false);
  };

  const toggleActivity = (id) => {
    setDetailDraft(d => ({
      ...d,
      activityIds: d.activityIds.includes(id)
        ? d.activityIds.filter(x => x !== id)
        : [...d.activityIds, id],
    }));
  };

  const btnPrimary = {
    padding: "10px 22px", borderRadius: 980, border: "none",
    background: accent, color: "white", fontFamily: font,
    fontSize: 15, fontWeight: 600, cursor: "pointer",
    transition: `all 0.2s ${EASE}`,
  };
  const btnSecondary = {
    padding: "10px 22px", borderRadius: 980,
    border: `1px solid ${divider}`,
    background: "rgba(0,0,0,0.04)", color: textColor, fontFamily: font,
    fontSize: 15, fontWeight: 500, cursor: "pointer",
    transition: `all 0.2s ${EASE}`,
  };

  return (
    <div style={{ padding: pad, fontFamily: font, maxWidth: 560, margin: "0 auto" }}>
      <h1 style={{
        margin: 0, fontSize: 28, fontWeight: 700, color: textColor,
        letterSpacing: "-0.02em",
      }}>
        Как ты сейчас?
      </h1>
      <p style={{ margin: "4px 0 16px", fontSize: 15, color: textSecondary }}>
        {detailMode ? "Уточни эмоцию и контекст" : "Отметь точкой на 2D-плоскости"}
      </p>

      {!detailMode && (
        <>
          <div style={{ ...GLASS, padding: 16, transition: `all 0.3s ${EASE}` }}>
            <svg
              viewBox={`0 0 ${SIZE} ${SIZE}`}
              style={{ width: "100%", maxWidth: SIZE, height: "auto", display: "block", margin: "0 auto", cursor: "crosshair", touchAction: "none" }}
              onMouseMove={handleSvgMove}
              onMouseLeave={handleSvgLeave}
              onTouchMove={handleSvgMove}
              onClick={handleSvgClick}
            >
              <defs>
                <radialGradient id="gHEP" cx="100%" cy="0%" r="100%">
                  <stop offset="0%" stopColor={QUADRANT_COLORS.HEP} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={QUADRANT_COLORS.HEP} stopOpacity="0.05" />
                </radialGradient>
                <radialGradient id="gHEU" cx="0%" cy="0%" r="100%">
                  <stop offset="0%" stopColor={QUADRANT_COLORS.HEU} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={QUADRANT_COLORS.HEU} stopOpacity="0.05" />
                </radialGradient>
                <radialGradient id="gLEP" cx="100%" cy="100%" r="100%">
                  <stop offset="0%" stopColor={QUADRANT_COLORS.LEP} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={QUADRANT_COLORS.LEP} stopOpacity="0.05" />
                </radialGradient>
                <radialGradient id="gLEU" cx="0%" cy="100%" r="100%">
                  <stop offset="0%" stopColor={QUADRANT_COLORS.LEU} stopOpacity="0.15" />
                  <stop offset="100%" stopColor={QUADRANT_COLORS.LEU} stopOpacity="0.05" />
                </radialGradient>
              </defs>

              <rect x="0" y="0" width={HALF} height={HALF} fill="url(#gHEU)" />
              <rect x={HALF} y="0" width={HALF} height={HALF} fill="url(#gHEP)" />
              <rect x="0" y={HALF} width={HALF} height={HALF} fill="url(#gLEU)" />
              <rect x={HALF} y={HALF} width={HALF} height={HALF} fill="url(#gLEP)" />

              <line x1="0" y1={HALF} x2={SIZE} y2={HALF} stroke={divider} strokeWidth="1" />
              <line x1={HALF} y1="0" x2={HALF} y2={SIZE} stroke={divider} strokeWidth="1" />

              <text x={SIZE - 6} y="14" fontSize="10" fill={textSecondary} textAnchor="end">🤩 Энергия+ Радость+</text>
              <text x="6" y="14" fontSize="10" fill={textSecondary}>😖 Энергия+ Стресс</text>
              <text x={SIZE - 6} y={SIZE - 6} fontSize="10" fill={textSecondary} textAnchor="end">😌 Спокойно+ Приятно</text>
              <text x="6" y={SIZE - 6} fontSize="10" fill={textSecondary}>😴 Спокойно+ Грусть</text>

              {recentEntries.map((en, i) => {
                const q = en.quadrant || computeQuadrant(en.pleasantness || 0, en.energy || 0);
                const { cx, cy } = coordsForValue(en.pleasantness || 0, en.energy || 0);
                return (
                  <circle key={en.id || i} cx={cx} cy={cy} r="4"
                    fill={QUADRANT_COLORS[q]} opacity="0.4" pointerEvents="none" />
                );
              })}

              {preview && (() => {
                const { cx, cy } = coordsForValue(preview.pleasantness, preview.energy);
                return (
                  <g pointerEvents="none">
                    <circle cx={cx} cy={cy} r="14" fill={QUADRANT_COLORS[previewQuadrant]} opacity="0.25">
                      <animate attributeName="r" values="12;18;12" dur="1.6s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.25;0.1;0.25" dur="1.6s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={cx} cy={cy} r="8" fill={QUADRANT_COLORS[previewQuadrant]} />
                  </g>
                );
              })()}
            </svg>
          </div>

          <div style={{
            marginTop: 12, padding: "12px 16px", ...GLASS,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            minHeight: 48,
          }}>
            <div style={{ fontSize: 15, color: textColor }}>
              {preview ? (
                <>
                  Текущий выбор:{" "}
                  <strong>{previewEmotion?.label}</strong>{" "}
                  <span style={{ fontSize: 18 }}>{previewEmotion?.emoji}</span>{" "}
                  <span style={{ color: textSecondary, fontSize: 13 }}>
                    ({QUADRANT_LABELS[previewQuadrant]})
                  </span>
                </>
              ) : (
                <span style={{ color: textSecondary }}>Наведи курсор на плоскость...</span>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
            <button style={btnSecondary} onClick={openDetail}>Подробнее...</button>
          </div>
        </>
      )}

      {detailMode && (
        <div style={{ ...GLASS, padding: 20, transition: `all 0.3s ${EASE}` }}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: textSecondary, display: "block", marginBottom: 4 }}>
              Приятность: <strong style={{ color: textColor }}>{detailDraft.pleasantness}</strong>
            </label>
            <input type="range" min={-5} max={5} step={1}
              value={detailDraft.pleasantness}
              onChange={e => setDetailDraft(d => ({ ...d, pleasantness: Number(e.target.value) }))}
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, color: textSecondary, display: "block", marginBottom: 4 }}>
              Энергия: <strong style={{ color: textColor }}>{detailDraft.energy}</strong>
            </label>
            <input type="range" min={-5} max={5} step={1}
              value={detailDraft.energy}
              onChange={e => setDetailDraft(d => ({ ...d, energy: Number(e.target.value) }))}
              style={{ width: "100%" }}
            />
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, marginBottom: 14,
          }}>
            {ALL_EMOTIONS.map(em => {
              const q = Object.keys(EMOTIONS_BY_QUADRANT).find(k =>
                EMOTIONS_BY_QUADRANT[k].some(x => x.id === em.id)
              );
              const selected = detailDraft.emotion === em.id;
              return (
                <button
                  key={em.id}
                  onClick={() => setDetailDraft(d => ({ ...d, emotion: em.id }))}
                  title={em.label}
                  style={{
                    padding: "8px 4px", borderRadius: 12,
                    border: selected ? `2px solid ${accent}` : `1px solid ${divider}`,
                    background: selected
                      ? `color-mix(in srgb, ${QUADRANT_COLORS[q]} 20%, white)`
                      : `color-mix(in srgb, ${QUADRANT_COLORS[q]} 10%, white)`,
                    cursor: "pointer", fontFamily: font, fontSize: 11,
                    color: textColor, transition: `all 0.2s ${EASE}`,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  }}
                >
                  <span style={{ fontSize: 20 }}>{em.emoji}</span>
                  <span style={{ fontSize: 10, lineHeight: 1.1 }}>{em.label}</span>
                </button>
              );
            })}
          </div>

          <textarea
            placeholder="Заметка..."
            value={detailDraft.note}
            onChange={e => setDetailDraft(d => ({ ...d, note: e.target.value }))}
            rows={3}
            style={{
              width: "100%", boxSizing: "border-box",
              borderRadius: 12, border: `1px solid ${divider}`,
              background: "rgba(255,255,255,0.5)",
              padding: "10px 12px", fontFamily: font, fontSize: 14,
              color: textColor, resize: "vertical", outline: "none",
              marginBottom: 14,
            }}
          />

          {activities.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, color: textSecondary, marginBottom: 6 }}>Активности:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {activities.map(a => {
                  const selected = detailDraft.activityIds.includes(a.id);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleActivity(a.id)}
                      style={{
                        padding: "6px 12px", borderRadius: 980,
                        border: selected ? `1px solid ${accent}` : `1px solid ${divider}`,
                        background: selected
                          ? `color-mix(in srgb, ${accent} 15%, white)`
                          : "rgba(255,255,255,0.5)",
                        color: selected ? accent : textColor,
                        fontFamily: font, fontSize: 13, cursor: "pointer",
                        transition: `all 0.2s ${EASE}`,
                      }}
                    >
                      {a.icon || ""} {a.name || a.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button style={btnSecondary} onClick={() => setDetailMode(false)}>Отмена</button>
            <button style={btnPrimary} onClick={saveDetailed}>Сохранить</button>
          </div>
        </div>
      )}
    </div>
  );
}
