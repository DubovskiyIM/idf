export async function fetchGraph(domain) {
  const r = await fetch(`/api/studio/domain/${encodeURIComponent(domain)}/graph`);
  if (!r.ok) throw new Error(`fetchGraph: ${r.status}`);
  return r.json();
}

export async function validateDomain(domain) {
  const r = await fetch(`/api/studio/domain/${encodeURIComponent(domain)}/validate`, { method: "POST" });
  if (!r.ok) throw new Error(`validateDomain: ${r.status}`);
  return r.json();
}
