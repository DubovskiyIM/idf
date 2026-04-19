/**
 * AuthGate — shared login/register форма.
 *
 * Если currentUser !== null — рендерит children.
 * Иначе — показывает форму аутентификации.
 *
 * Токены `--idf-*` и `--idf-font` — IDF Token Bridge (см. src/adapter-themes.css
 * и SDK styles.css адаптеров). Форма автоматически подхватывает тему активного
 * адаптера через `[data-adapter="..."]`-скоуп снаружи.
 *
 * Props:
 *   currentUser, doAuth, authError, isLoading — из useAuth()
 *   title — название приложения для заголовка формы
 *   children — содержимое после авторизации
 */

import { useState } from "react";

const FIELD_STYLE = {
  width: "100%", padding: 10, marginBottom: 8,
  border: "1px solid var(--idf-border, #d1d5db)",
  borderRadius: "var(--idf-radius, 6px)",
  boxSizing: "border-box", fontSize: 14,
  background: "var(--idf-surface, #fff)",
  color: "var(--idf-text, #1a1a2e)",
  fontFamily: "inherit",
};

export default function AuthGate({ currentUser, doAuth, authError, isLoading, title, children }) {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  if (isLoading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh",
        fontFamily: "var(--idf-font, system-ui, sans-serif)",
        color: "var(--idf-text-muted, #6b7280)",
      }}>
        Загрузка...
      </div>
    );
  }

  if (currentUser) {
    return children;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    doAuth(authMode, email, password, name);
  };

  return (
    <div style={{
      maxWidth: 360, margin: "60px auto",
      fontFamily: "var(--idf-font, system-ui, sans-serif)",
      padding: 20,
      color: "var(--idf-text, #1a1a2e)",
    }}>
      <h2 style={{
        fontSize: 22, fontWeight: 700, marginBottom: 20, textAlign: "center",
        color: "var(--idf-text, #1a1a2e)",
        fontFamily: "inherit",
      }}>
        {title || "IDF"}
      </h2>
      <div style={{
        display: "flex", marginBottom: 16,
        borderRadius: "var(--idf-radius, 6px)", overflow: "hidden",
      }}>
        {["login", "register"].map(m => (
          <button key={m} type="button" onClick={() => setAuthMode(m)} style={{
            flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontSize: 14,
            background: authMode === m ? "var(--idf-primary, #6366f1)" : "var(--idf-card, #e5e7eb)",
            color: authMode === m ? "#fff" : "var(--idf-text-muted, #6b7280)",
            fontFamily: "inherit",
          }}>{m === "login" ? "Вход" : "Регистрация"}</button>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={FIELD_STYLE}
        />
        {authMode === "register" && (
          <input
            placeholder="Имя"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={FIELD_STYLE}
          />
        )}
        <input
          type="password"
          placeholder="пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ ...FIELD_STYLE, marginBottom: 12 }}
        />
        <button type="submit" style={{
          width: "100%", padding: 10,
          background: "var(--idf-primary, #6366f1)", color: "#fff",
          border: "none",
          borderRadius: "var(--idf-radius, 6px)",
          cursor: "pointer", fontWeight: 600,
          fontSize: 14, fontFamily: "inherit",
        }}>
          {authMode === "login" ? "Войти" : "Зарегистрироваться"}
        </button>
      </form>
      {authError && (
        <div style={{ color: "var(--idf-danger, #ef4444)", marginTop: 8, fontSize: 12 }}>
          {authError}
        </div>
      )}
    </div>
  );
}
