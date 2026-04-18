// Studio capabilities: доступен ли Claude CLI (для генерации/chat).
// Вызывается один раз при mount'е Studio App.
export async function fetchStudioStatus() {
  try {
    const r = await fetch("/api/studio/status");
    if (!r.ok) return { claudeAvailable: false, readonly: true, mode: "readonly" };
    return await r.json();
  } catch {
    return { claudeAvailable: false, readonly: true, mode: "readonly" };
  }
}
