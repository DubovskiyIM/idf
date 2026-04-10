import { INTENTS } from "./intents.js";

export function deriveLinks() {
  const links = [];
  const ids = Object.keys(INTENTS);
  for (const id of ids) {
    const i = INTENTS[id];
    if (i.antagonist) links.push({ type: "⇌", from: id, to: i.antagonist, label: "антагонист" });
    if (i.creates) {
      for (const id2 of ids) {
        if (id2 !== id && INTENTS[id2].particles.conditions.length > 0)
          links.push({ type: "▷", from: id, to: id2, label: "последоват." });
      }
    }
  }
  const seen = new Set();
  return links.filter(l => { const k = [l.from, l.to, l.type].sort().join("|"); if (seen.has(k)) return false; seen.add(k); return true; });
}
