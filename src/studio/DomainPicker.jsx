import React, { useEffect, useState } from "react";
import { listDomains, slugifyDescription, createDomain } from "./api/domains.js";

const EXAMPLES = [
  "Приложение для записи к врачу — клиенты бронируют слоты, врач подтверждает",
  "Доставка еды — курьеры, заказы, оплата, уведомления",
  "Приложение для учёта привычек — ежедневные чекины, стрики, напоминания",
];

export default function DomainPicker({ onPick, onNewDomain, onGenerateFromDescription, readonly = false }) {
  const [domains, setDomains] = useState(null);
  const [err, setErr] = useState(null);
  const [hero, setHero] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listDomains().then(setDomains).catch((e) => setErr(e.message));
  }, []);

  const generate = async () => {
    const text = hero.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const { slug, name } = await slugifyDescription(text);
      await createDomain(slug, name);
      onGenerateFromDescription({ slug, name, description: text });
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
    // busy остаётся true до разрыва DomainPicker — родитель переключит view
  };

  if (err && !domains) return <div style={{ padding: 24, color: "#f87171" }}>Ошибка: {err}</div>;
  if (!domains) return <div style={{ padding: 24 }}>Загрузка…</div>;

  return (
    <div style={{ height: "100vh", overflowY: "auto" }}>
      <div style={{ padding: 32, maxWidth: 780, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, marginBottom: 8 }}>IDF Studio</h1>
        <p style={{ color: "#94a3b8", marginBottom: 28 }}>
          {readonly
            ? "Публичное демо — read-only. Открой любой домен ниже чтобы посмотреть граф и рабочий прототип."
            : "Опиши процесс словами — Claude сгенерирует формальное описание за 1-2 минуты."}
        </p>

        {readonly && (
          <div style={{
            background: "#1e293b", border: "1px solid #334155",
            borderRadius: 10, padding: "16px 20px", marginBottom: 24,
            display: "flex", gap: 14, alignItems: "flex-start",
          }}>
            <div style={{ fontSize: 20 }}>ℹ</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#e2e8f0", marginBottom: 4 }}>
                Генерация и чат отключены
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
                На этом сервере нет Claude CLI — LLM-авторство доступно только в локальной разработке.
                Здесь можно открыть 9 hardcoded-доменов (booking, planning, invest...) и посмотреть как работает кристаллизованный UI.
              </div>
            </div>
          </div>
        )}

        {/* Hero: опиши процесс → прототип */}
        {!readonly && (
        <div style={{
          background: "linear-gradient(135deg, #1e293b 0%, #1e1b4b 100%)",
          border: "1px solid #3730a3",
          borderRadius: 10,
          padding: 20,
          marginBottom: 28,
        }}>
          <label style={{ display: "block", marginBottom: 10, fontSize: 13, color: "#c7d2fe", fontWeight: 500 }}>
            Что за приложение?
          </label>
          <textarea
            value={hero}
            onChange={(e) => setHero(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generate(); }}
            placeholder="Например: приложение для записи к врачу — клиенты видят слоты, бронируют, врач подтверждает"
            rows={3}
            disabled={busy}
            autoFocus
            style={{
              width: "100%",
              padding: 12,
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: 6,
              color: "#e2e8f0",
              fontFamily: "inherit",
              fontSize: 14,
              lineHeight: 1.5,
              resize: "vertical",
              outline: "none",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
            <div style={{ fontSize: 11, color: "#64748b" }}>
              {busy ? "Создаю скелет домена…" : "⌘⏎ — сгенерировать"}
            </div>
            <button
              onClick={generate}
              disabled={busy || !hero.trim()}
              style={{
                padding: "8px 20px",
                background: busy ? "#334155" : hero.trim() ? "#6366f1" : "#334155",
                color: "white",
                border: "none",
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: busy || !hero.trim() ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "…" : "Сгенерировать →"}
            </button>
          </div>
          {err && <div style={{ color: "#f87171", fontSize: 12, marginTop: 8 }}>{err}</div>}

          {/* Примеры-подсказки */}
          {!hero && !busy && (
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setHero(ex)}
                  style={{
                    padding: "4px 10px",
                    background: "transparent",
                    border: "1px solid #475569",
                    borderRadius: 999,
                    color: "#94a3b8",
                    fontSize: 11,
                    cursor: "pointer",
                    lineHeight: 1.4,
                    textAlign: "left",
                  }}
                >
                  {ex.slice(0, 40)}{ex.length > 40 ? "…" : ""}
                </button>
              ))}
            </div>
          )}
        </div>
        )}

        {/* Существующие домены */}
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Существующие домены ({domains.length})
        </div>
        <div style={{ display: "grid", gap: 8 }}>
          {domains.map((d) => (
            <button key={d.name} onClick={() => onPick(d.name)}
              style={{ textAlign: "left", padding: 14, background: "#1e293b", border: "1px solid #334155", borderRadius: 6, color: "#e2e8f0" }}>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{d.name}</div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                {d.intents} intents · {d.entities} entities
                {d.warnings > 0 && <span style={{ color: "#eab308" }}> · ⚠ {d.warnings} warnings</span>}
                {d.error && <span style={{ color: "#f87171" }}> · {d.error}</span>}
              </div>
            </button>
          ))}
          {!readonly && (
            <button onClick={onNewDomain}
              style={{ marginTop: 8, padding: 10, background: "transparent", border: "1px dashed #475569", borderRadius: 6, color: "#94a3b8", fontSize: 12 }}>
              + Новый домен вручную (укажу name и description сам)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
