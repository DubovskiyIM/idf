/**
 * AuthGate — shared login/register форма.
 *
 * Если currentUser !== null — рендерит children.
 * Иначе — показывает форму аутентификации.
 *
 * Props:
 *   currentUser, doAuth, authError, isLoading — из useAuth()
 *   title — название приложения для заголовка формы
 *   children — содержимое после авторизации
 */

import { useState } from "react";

export default function AuthGate({ currentUser, doAuth, authError, isLoading, title, children }) {
  const [authMode, setAuthMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  if (isLoading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", fontFamily: "system-ui, sans-serif",
        color: "var(--mantine-color-dimmed, #6b7280)",
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
      maxWidth: 360, margin: "60px auto", fontFamily: "system-ui, sans-serif",
      padding: 20, color: "var(--mantine-color-text, #1a1a2e)",
    }}>
      <h2 style={{
        fontSize: 22, fontWeight: 700, marginBottom: 20, textAlign: "center",
        color: "var(--mantine-color-text, #1a1a2e)",
      }}>
        {title || "IDF"}
      </h2>
      <div style={{ display: "flex", marginBottom: 16, borderRadius: 6, overflow: "hidden" }}>
        {["login", "register"].map(m => (
          <button key={m} onClick={() => setAuthMode(m)} style={{
            flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontSize: 14,
            background: authMode === m ? "var(--mantine-color-primary, #6366f1)" : "var(--mantine-color-default, #e5e7eb)",
            color: authMode === m ? "#fff" : "var(--mantine-color-dimmed, #6b7280)",
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
          style={{
            width: "100%", padding: 10, marginBottom: 8,
            border: "1px solid var(--mantine-color-default-border, #d1d5db)",
            borderRadius: 6, boxSizing: "border-box", fontSize: 14,
            background: "var(--mantine-color-body, #fff)",
            color: "var(--mantine-color-text, #1a1a2e)",
          }}
        />
        {authMode === "register" && (
          <input
            placeholder="Имя"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            style={{
              width: "100%", padding: 10, marginBottom: 8,
              border: "1px solid var(--mantine-color-default-border, #d1d5db)",
              borderRadius: 6, boxSizing: "border-box", fontSize: 14,
              background: "var(--mantine-color-body, #fff)",
              color: "var(--mantine-color-text, #1a1a2e)",
            }}
          />
        )}
        <input
          type="password"
          placeholder="пароль"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{
            width: "100%", padding: 10, marginBottom: 12,
            border: "1px solid var(--mantine-color-default-border, #d1d5db)",
            borderRadius: 6, boxSizing: "border-box", fontSize: 14,
            background: "var(--mantine-color-body, #fff)",
            color: "var(--mantine-color-text, #1a1a2e)",
          }}
        />
        <button type="submit" style={{
          width: "100%", padding: 10,
          background: "var(--mantine-color-primary, #6366f1)", color: "#fff",
          border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600,
          fontSize: 14, fontFamily: "inherit",
        }}>
          {authMode === "login" ? "Войти" : "Зарегистрироваться"}
        </button>
      </form>
      {authError && (
        <div style={{ color: "var(--mantine-color-red-6, #ef4444)", marginTop: 8, fontSize: 12 }}>
          {authError}
        </div>
      )}
    </div>
  );
}
