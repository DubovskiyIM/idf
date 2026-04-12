/**
 * useAuth — shared hook для JWT-аутентификации.
 *
 * Хранит токен в localStorage("idf_token"), проверяет через GET /api/auth/me.
 * Users берутся из world (через Φ), не из /api/auth/users.
 *
 * Returns: { currentUser, token, doAuth, logout, authError, isLoading }
 */

import { useState, useEffect, useCallback } from "react";

const TOKEN_KEY = "idf_token";

export function useAuth() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState("");
  const [isLoading, setIsLoading] = useState(!!localStorage.getItem(TOKEN_KEY));

  // Verify token on mount / token change
  useEffect(() => {
    if (!token) { setIsLoading(false); return; }
    setIsLoading(true);
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(user => { setCurrentUser(user); setIsLoading(false); })
      .catch(() => {
        setToken(null);
        setCurrentUser(null);
        localStorage.removeItem(TOKEN_KEY);
        setIsLoading(false);
      });
  }, [token]);

  const doAuth = useCallback(async (mode, email, password, name) => {
    setAuthError("");
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const body = mode === "login" ? { email, password } : { email, password, name };
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        const data = await r.json().catch(() => ({}));
        setAuthError(data.error || "Ошибка авторизации");
        return;
      }
      const data = await r.json();
      localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setCurrentUser(data.user);
    } catch (err) {
      setAuthError(err.message || "Ошибка сети");
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setCurrentUser(null);
  }, []);

  return { currentUser, token, doAuth, logout, authError, isLoading };
}
