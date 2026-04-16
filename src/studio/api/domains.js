export async function listDomains() {
  const r = await fetch("/api/studio/domains");
  if (!r.ok) throw new Error(`listDomains: ${r.status}`);
  return (await r.json()).domains;
}
