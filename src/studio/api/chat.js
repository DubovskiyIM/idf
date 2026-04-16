export async function sendChat({ domain, message, sessionId, onEvent, signal }) {
  let res;
  try {
    res = await fetch("/api/studio/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, message, sessionId }),
      signal,
    });
  } catch (e) {
    console.error("[studio/chat] fetch failed", e);
    throw e;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("[studio/chat] HTTP", res.status, text);
    throw new Error(`chat HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  if (!res.body) {
    throw new Error("chat: response body is empty (proxy не пропускает stream?)");
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
      if (ev) {
        console.debug("[studio/chat] event", ev.event, ev.data);
        onEvent(ev);
      }
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
