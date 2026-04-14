import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  MantineProvider,
  ColorSchemeScript,
  localStorageColorSchemeManager,
} from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import App from './prototype.jsx';
import StandaloneApp from './standalone.jsx';
import { registerUIAdapter } from './runtime/renderer/adapters/registry.js';
import { mantineAdapter } from './runtime/renderer/adapters/mantine/index.jsx';

// localStorage key для color scheme — Mantine сам читает/пишет через
// colorSchemeManager. Используем тот же ключ idf_theme, что prototype
// читал раньше, чтобы ничего не ломать.
const colorSchemeManager = localStorageColorSchemeManager({ key: "idf_theme" });

// Mantine глобальные стили + стили dates-компонентов (DateInput, TimeInput).
// Порядок важен — core до dates.
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';

// Регистрация адаптера UI-kit (§17 манифеста, адаптивный слой).
// Все ParameterControl'ы и (в будущем) кнопки/карточки резолвятся через
// этот адаптер; fallback на built-in inline-styled компоненты если
// конкретная категория не покрыта.
registerUIAdapter(mantineAdapter);

function Root() {
  // MantineProvider + colorSchemeManager — Mantine сама persist'ит scheme
  // в localStorage['idf_theme'] и инициализирует из него. useMantineColorScheme
  // в дочерних компонентах читает/меняет без дополнительной синхронизации.
  return (
    <>
      <ColorSchemeScript defaultColorScheme="light" />
      <MantineProvider
        defaultColorScheme="light"
        colorSchemeManager={colorSchemeManager}
        theme={{ primaryColor: "indigo" }}
      >
        <DatesProvider settings={{ locale: "ru", firstDayOfWeek: 1, weekendDays: [0, 6] }}>
          <BrowserRouter>
          <Routes>
            <Route path="/messenger" element={<StandaloneApp domainId="messenger" />} />
            <Route path="/messenger-v2" element={<StandaloneApp domainId="messenger-v2" />} />
            <Route path="/booking" element={<StandaloneApp domainId="booking" />} />
            <Route path="/booking-v2" element={<StandaloneApp domainId="booking-v2" />} />
            <Route path="/planning" element={<StandaloneApp domainId="planning" />} />
            <Route path="/planning-v2" element={<StandaloneApp domainId="planning-v2" />} />
            <Route path="/workflow" element={<StandaloneApp domainId="workflow" />} />
            <Route path="/meshok" element={<StandaloneApp domainId="meshok" />} />
            <Route path="/lifequest" element={<StandaloneApp domainId="lifequest" />} />
            <Route path="/reflect" element={<StandaloneApp domainId="reflect" />} />
            <Route path="/*" element={<App />} />
          </Routes>
          </BrowserRouter>
        </DatesProvider>
      </MantineProvider>
    </>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
