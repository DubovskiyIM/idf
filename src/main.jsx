import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MantineAdapterProvider } from '@intent-driven/adapter-mantine';
import StandaloneApp, { DOMAINS_RAW } from './standalone.jsx';

// Tailwind 4 entry — должен быть в src/, не в node_modules,
// чтобы @tailwindcss/vite plugin его подхватил.
import './tailwind.css';
// IDF Token Bridge — адаптер-specific overrides через [data-adapter="..."].
// shadcn/apple экспортируют theme.css из npm, mantine/antd — ещё не,
// поэтому inline-fallback для них в src/adapter-themes.css.
import './adapter-themes.css';
import '@intent-driven/adapter-shadcn/styles.css';
import '@intent-driven/adapter-apple/styles.css';

// Корень `/` был prototype v1.2 (src/prototype.jsx). После миграции в Studio
// (tabs Граф / Прототип / Паттерны) prototype удалён как самостоятельный
// entry — перенаправляем на /studio.html с сохранением query-params. Прямые
// domain-routes (/booking-v2, /invest и т.п. через StandaloneApp) остаются.
function StudioRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const target = new URL("/studio.html", window.location.origin);
    for (const [k, v] of new URLSearchParams(window.location.search)) {
      target.searchParams.set(k, v);
    }
    if (!target.searchParams.has("view") && target.searchParams.has("domain")) {
      target.searchParams.set("view", "prototype");
    }
    // Сохраняем hash — Studio hash-router использует #graph/focus?...
    // для deep-link'ов из X-ray HUD и SDK renderer-генерируемых ссылок.
    // URL-копирование через `new URL` не переносит hash автоматически.
    if (window.location.hash) {
      target.hash = window.location.hash;
    }
    window.location.replace(target.toString());
  }, []);
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0b1220", color: "#94a3b8",
      fontFamily: "Inter, -apple-system, system-ui, sans-serif", fontSize: 13,
    }}>
      Открываю Studio…
    </div>
  );
}

// Все domain-роуты + их v2-варианты (booking-v2, planning-v2, messenger-v2)
// рендерятся через одного StandaloneApp с domainId=route. Список — DOMAINS_RAW
// + руками добавленные v2-aliases (один и тот же домен под двумя путями).
const V2_ALIASES = ["booking", "planning", "messenger"];

function Root() {
  const domainIds = Object.keys(DOMAINS_RAW);
  return (
    <MantineAdapterProvider>
      <BrowserRouter>
        <Routes>
          {domainIds.map((id) => (
            <Route key={id} path={`/${id}`} element={<StandaloneApp domainId={id} />} />
          ))}
          {V2_ALIASES.map((id) => (
            <Route
              key={`${id}-v2`}
              path={`/${id}-v2`}
              element={<StandaloneApp domainId={`${id}-v2`} />}
            />
          ))}
          <Route path="/*" element={<StudioRedirect />} />
        </Routes>
      </BrowserRouter>
    </MantineAdapterProvider>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
