import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MantineAdapterProvider } from '@idf/adapter-mantine';
import App from './prototype.jsx';
import StandaloneApp from './standalone.jsx';

// Tailwind 4 entry — должен быть в src/, не в node_modules,
// чтобы @tailwindcss/vite plugin его подхватил.
import './tailwind.css';
// CSS-темы адаптеров: @theme-блоки внутри обрабатываются глобально.
import '@idf/adapter-shadcn/styles.css';
import '@idf/adapter-apple/styles.css';

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
          <Route path="/*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </MantineAdapterProvider>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
