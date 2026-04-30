export async function uploadAttachment(domain, file) {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch(`/api/studio/domain/${encodeURIComponent(domain)}/author/attach`, {
    method: "POST",
    body: fd,
  });
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(body.error || `attach HTTP ${res.status}`), { body });
  return body;
}

export async function runAuthoringTurn(domain, userText, { onEvent, signal } = {}) {
  const res = await fetch(`/api/studio/domain/${encodeURIComponent(domain)}/author/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userText }),
    signal,
  });
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`turn HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop();
    for (const part of parts) {
      const ev = parseSse(part);
      if (ev) onEvent?.(ev);
    }
  }
}

function parseSse(text) {
  const lines = text.split("\n");
  let event = null;
  let data = "";
  for (const l of lines) {
    if (l.startsWith("event:")) event = l.slice(6).trim();
    else if (l.startsWith("data:")) data += l.slice(5).trim();
  }
  if (!event) return null;
  try { return { event, data: JSON.parse(data) }; }
  catch { return { event, data }; }
}
