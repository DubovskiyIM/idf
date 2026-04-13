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

import { useState, useCallback } from "react";

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

export function usePersonalPrefs() {
  const [prefs, setPrefsState] = useState(loadPrefs);

  const setPref = useCallback((key, value) => {
    setPrefsState(prev => {
      const next = { ...prev, [key]: value };
      savePrefs(next);
      return next;
    });
  }, []);

  const resetPrefs = useCallback(() => {
    const d = { ...DEFAULTS };
    savePrefs(d);
    setPrefsState(d);
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
