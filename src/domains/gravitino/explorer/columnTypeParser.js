/**
 * columnTypeParser — простой парсер nested типов колонок Gravitino (B5).
 *
 * Поддерживаемые формы:
 *   struct<a:int, b:string>
 *   array<bigint>
 *   array<struct<x:int, y:string>>
 *   map<string, decimal(10,2)>
 *
 * Возвращает дерево:
 *   - scalar → {kind: "scalar", type: "bigint"}
 *   - struct → {kind: "struct", fields: [{name, type: <node>}]}
 *   - array  → {kind: "array",  element: <node>}
 *   - map    → {kind: "map",    key: <node>, value: <node>}
 *
 * Top-level split учитывает <…> и (…) — `splitTopLevel` идёт по depth.
 */
export function parseColumnType(typeStr) {
  if (!typeStr || typeof typeStr !== "string") {
    return { kind: "scalar", type: String(typeStr ?? "—") };
  }
  const s = typeStr.trim();
  const lower = s.toLowerCase();

  if (lower.startsWith("struct<") && s.endsWith(">")) {
    const inner = s.slice(7, -1);
    return { kind: "struct", fields: parseStructFields(inner) };
  }
  if (lower.startsWith("array<") && s.endsWith(">")) {
    const inner = s.slice(6, -1);
    return { kind: "array", element: parseColumnType(inner) };
  }
  if (lower.startsWith("map<") && s.endsWith(">")) {
    const inner = s.slice(4, -1);
    const [keyStr, valueStr] = splitTopLevel(inner, ",");
    return {
      kind: "map",
      key: parseColumnType(keyStr || "string"),
      value: parseColumnType(valueStr || "string"),
    };
  }
  return { kind: "scalar", type: s };
}

function parseStructFields(s) {
  return splitTopLevel(s, ",").map(part => {
    const colonIdx = findTopLevelColon(part);
    if (colonIdx === -1) {
      return { name: part.trim(), type: { kind: "scalar", type: "?" } };
    }
    const name = part.slice(0, colonIdx).trim();
    const typeStr = part.slice(colonIdx + 1).trim();
    return { name, type: parseColumnType(typeStr) };
  });
}

function splitTopLevel(s, sep) {
  const result = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "<" || ch === "(") depth++;
    else if (ch === ">" || ch === ")") depth--;
    else if (ch === sep && depth === 0) {
      result.push(s.slice(start, i));
      start = i + 1;
    }
  }
  result.push(s.slice(start));
  return result.map(x => x.trim()).filter(Boolean);
}

function findTopLevelColon(s) {
  let depth = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "<" || ch === "(") depth++;
    else if (ch === ">" || ch === ")") depth--;
    else if (ch === ":" && depth === 0) return i;
  }
  return -1;
}

export function isComplex(node) {
  return Boolean(node) && node.kind !== "scalar";
}
