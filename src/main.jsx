import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './prototype.jsx';
import StandaloneApp from './standalone.jsx';

function Root() {
  // Если путь начинается с /messenger, /booking и т.д. — standalone
  // Иначе — полный IDF
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/messenger" element={<StandaloneApp domainId="messenger" />} />
        <Route path="/booking" element={<StandaloneApp domainId="booking" />} />
        <Route path="/planning" element={<StandaloneApp domainId="planning" />} />
        <Route path="/workflow" element={<StandaloneApp domainId="workflow" />} />
        <Route path="/*" element={<App />} />
      </Routes>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')).render(<Root />);
