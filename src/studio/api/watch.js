export function subscribeDomain(domain, onChange) {
  const es = new EventSource(`/api/studio/domain/${encodeURIComponent(domain)}/events`);
  es.addEventListener("graph_invalidated", (e) => {
    try { onChange(JSON.parse(e.data)); } catch { onChange({}); }
  });
  es.onerror = () => { /* EventSource auto-reconnects */ };
  return () => es.close();
}
