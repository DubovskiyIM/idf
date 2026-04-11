import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import App from './prototype.jsx';
import StandaloneApp from './standalone.jsx';
import { registerUIAdapter } from './runtime/renderer/adapters/registry.js';
import { mantineAdapter } from './runtime/renderer/adapters/mantine/index.jsx';

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
  // MantineProvider — для всего @mantine/core (CSS variables, тема, portals).
  // DatesProvider — локаль/неделя для DateInput/TimeInput в @mantine/dates.
  return (
    <MantineProvider defaultColorScheme="light" theme={{ primaryColor: "indigo" }}>
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
            <Route path="/*" element={<App />} />
          </Routes>
        </BrowserRouter>
      </DatesProvider>
    </MantineProvider>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
