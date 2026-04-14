/**
 * usePersonalPrefs — пользовательские настройки UI (§17 Personal layer).
 *
 * Хранит в localStorage:
 *   - density: "compact" | "comfortable" | "spacious"
 *   - iconMode: "emoji" | "lucide" | "none"
 *   - fontSize: "sm" | "md" | "lg"
 *
 * Возвращает { prefs, setPref, resetPrefs, PrefsPanel }.
 */

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "idf_personal_prefs";

const DEFAULTS = {
  density: "comfortable",
  iconMode: "lucide",
  fontSize: "md",
};

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
  } catch {
    return { ...DEFAULTS };
  }
}

function savePrefs(prefs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// Глобальный кэш + listeners для синхронной читки из не-React кода (Icon.jsx).
// Альтернатива: проброс iconMode через React Context — но Icon вызывается
// из десятков мест (атомов, контролов), это раздуло бы сигнатуры.
let GLOBAL_PREFS = loadPrefs();
const LISTENERS = new Set();

export function getGlobalPrefs() {
  return GLOBAL_PREFS;
}

function notifyAndPersist(next) {
  GLOBAL_PREFS = next;
  savePrefs(next);
  LISTENERS.forEach(fn => { try { fn(next); } catch {} });
}

export function usePersonalPrefs() {
  const [prefs, setPrefsState] = useState(GLOBAL_PREFS);

  // Подписка на глобальные изменения с корректным cleanup
  useEffect(() => {
    const sub = (next) => setPrefsState(next);
    LISTENERS.add(sub);
    return () => { LISTENERS.delete(sub); };
  }, []);

  const setPref = useCallback((key, value) => {
    const next = { ...GLOBAL_PREFS, [key]: value };
    notifyAndPersist(next); // вызовет listener, который обновит state
  }, []);

  const resetPrefs = useCallback(() => {
    const d = { ...DEFAULTS };
    notifyAndPersist(d);
  }, []);

  return { prefs, setPref, resetPrefs };
}

/**
 * CSS-переменные из personal prefs — инжектируются в root-контейнер.
 */
export function prefsToStyle(prefs) {
  const density = prefs.density || "comfortable";
  const fontSize = prefs.fontSize || "md";

  const paddingMap = { compact: 6, comfortable: 12, spacious: 20 };
  const gapMap = { compact: 4, comfortable: 8, spacious: 16 };
  const fontSizeMap = { sm: 12, md: 14, lg: 16 };

  return {
    "--idf-padding": `${paddingMap[density]}px`,
    "--idf-gap": `${gapMap[density]}px`,
    "--idf-font-size": `${fontSizeMap[fontSize]}px`,
  };
}
