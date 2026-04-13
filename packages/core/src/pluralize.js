/**
 * Pluralize entity name: User → users, Category → categories, Address → addresses
 * @param {string} name — PascalCase entity name
 * @returns {string} lowercase plural collection name
 */
export function pluralize(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith("s")) return lower + "es";
  if (lower.endsWith("y") && !lower.endsWith("ey")) return lower.slice(0, -1) + "ies";
  return lower + "s";
}
