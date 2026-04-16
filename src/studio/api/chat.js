export async function sendChat({ domain, message, sessionId, onEvent, signal }) {
  const res = await fetch("/api/studio/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain, message, sessionId }),
    signal,
  });
  if (!res.ok) throw new Error(`chat: ${res.status}`);

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
      if (ev) onEvent(ev);
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
