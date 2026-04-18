import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MantineAdapterProvider } from '@intent-driven/adapter-mantine';
import StandaloneApp from './standalone.jsx';

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

function Root() {
  return (
    <MantineAdapterProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/messenger" element={<StandaloneApp domainId="messenger" />} />
          <Route path="/messenger-v2" element={<StandaloneApp domainId="messenger-v2" />} />
          <Route path="/booking" element={<StandaloneApp domainId="booking" />} />
          <Route path="/booking-v2" element={<StandaloneApp domainId="booking-v2" />} />
          <Route path="/planning" element={<StandaloneApp domainId="planning" />} />
          <Route path="/planning-v2" element={<StandaloneApp domainId="planning-v2" />} />
          <Route path="/workflow" element={<StandaloneApp domainId="workflow" />} />
          <Route path="/sales" element={<StandaloneApp domainId="sales" />} />
          <Route path="/lifequest" element={<StandaloneApp domainId="lifequest" />} />
          <Route path="/reflect" element={<StandaloneApp domainId="reflect" />} />
          <Route path="/invest" element={<StandaloneApp domainId="invest" />} />
          <Route path="/delivery" element={<StandaloneApp domainId="delivery" />} />
          <Route path="/freelance" element={<StandaloneApp domainId="freelance" />} />
          <Route path="/*" element={<StudioRedirect />} />
        </Routes>
      </BrowserRouter>
    </MantineAdapterProvider>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
