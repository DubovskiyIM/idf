// Pattern Bank API client для Studio.
//
// BASE = "/api/patterns" — same-origin. Vite dev-server проксирует /api на
// http://localhost:3001 (см. vite.config.js: server.proxy["/api"]), поэтому
// абсолютный URL не нужен. Существующие клиенты (graph.js, domains.js) тоже
// используют same-origin и работают корректно.
const BASE = "/api/patterns";

export async function fetchCatalog() {
  const r = await fetch(`${BASE}/catalog`);
  if (!r.ok) throw new Error(`catalog ${r.status}`);
  return r.json();
}

export async function runFalsification(id) {
  const r = await fetch(`${BASE}/falsification?id=${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(`falsification ${r.status}`);
  return r.json();
}

export async function explainProjection(domain, projection, options = {}) {
  const p = new URLSearchParams({ domain, projection });
  if (options.includeNearMiss) p.set("includeNearMiss", "1");
  if (options.previewPatternId) p.set("previewPatternId", options.previewPatternId);
  const r = await fetch(`${BASE}/explain?${p}`);
  if (!r.ok) throw new Error(`explain ${r.status}`);
  return r.json();
}
