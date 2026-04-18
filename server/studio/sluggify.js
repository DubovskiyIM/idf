const fs = require("fs");
const path = require("path");

const RU_MAP = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "",  ы: "y", ь: "",  э: "e", ю: "yu", я: "ya",
};

function transliterate(text) {
  return text.toLowerCase().split("").map((ch) => RU_MAP[ch] ?? ch).join("");
}

const STOP_WORDS = new Set([
  "и", "в", "на", "с", "о", "от", "для", "при", "про", "это", "этот",
  "a", "an", "the", "of", "in", "on", "for", "to", "with", "and", "or",
  "app", "application", "система", "сервис",
]);

/**
 * Из свободного описания вернуть { slug, name }.
 *   slug — детерминированный [a-z_0-9], начинается с буквы, не длиннее 24 симв.
 *   name — человекочитаемое сокращение для UI (первые 2 значимых слова).
 *
 * Алгоритм:
 *  1. транслитерация кириллицы в латиницу
 *  2. разбиение на слова через [^a-z0-9]
 *  3. фильтрация stop-words
 *  4. взятие первых 2 значимых слов → slug через "_"
 *  5. collision-free добавление суффикса (если directory-check-callback указан)
 */
function sluggify(description, { existsCheck } = {}) {
  const text = String(description || "").trim();
  if (!text) return { slug: `domain_${Date.now().toString(36).slice(-6)}`, name: "Новый домен" };

  const originalWords = text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .filter((w) => !STOP_WORDS.has(w));

  const words = originalWords
    .map((w) => transliterate(w))
    .filter((w) => w.length >= 2);

  const pick = words.slice(0, 2);
  let base = pick.join("_") || "domain";
  if (!/^[a-z]/.test(base)) base = `d_${base}`;
  base = base.slice(0, 24);

  let slug = base;
  if (existsCheck) {
    let i = 2;
    while (existsCheck(slug)) {
      const suffix = `_${i}`;
      slug = base.slice(0, 24 - suffix.length) + suffix;
      i++;
      if (i > 99) break;
    }
  }

  const original = text.split(/\s+/).filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  const name = original.slice(0, 3).join(" ").slice(0, 48) || "Новый домен";

  return { slug, name };
}

function existsInDomainsDir(domainsDir) {
  return (slug) => {
    try { return fs.existsSync(path.join(domainsDir, slug)); } catch { return false; }
  };
}

module.exports = { sluggify, transliterate, existsInDomainsDir };
