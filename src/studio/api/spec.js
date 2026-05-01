export async function getSpec(domain) {
  const res = await fetch(`/api/studio/domain/${encodeURIComponent(domain)}/author/spec`);
  if (!res.ok) {
    if (res.status === 404) return { source: null, spec: null };
    throw new Error(`getSpec HTTP ${res.status}`);
  }
  return res.json();
}

export async function putSpec(domain, spec, { commit = false } = {}) {
  const res = await fetch(`/api/studio/domain/${encodeURIComponent(domain)}/author/spec`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spec, commit }),
  });
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.error || `putSpec HTTP ${res.status}`), { body });
  return body;
}
