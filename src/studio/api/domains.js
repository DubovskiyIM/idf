export async function listDomains() {
  const r = await fetch("/api/studio/domains");
  if (!r.ok) throw new Error(`listDomains: ${r.status}`);
  return (await r.json()).domains;
}

// Hero onboarding: описание свободным текстом → { slug, name, description }.
// Детерминированный sluggify (транслит + stop-words), без LLM-круга.
export async function slugifyDescription(description) {
  const r = await fetch("/api/studio/slug", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ description }),
  });
  if (!r.ok) throw new Error(`slugify: ${r.status}`);
  return r.json();
}

export async function createDomain(name, description = "") {
  const r = await fetch("/api/studio/domain/new", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(data.error || `createDomain: ${r.status}`);
  }
  return r.json();
}
