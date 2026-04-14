/**
 * 25 эмоций Mood Meter (Marc Brackett, Yale RULER) по 4 квадрантам.
 * Energy × Pleasantness — каждый квадрант 6 эмоций.
 */

export const EMOTIONS_BY_QUADRANT = {
  HEP: [ // High Energy + Pleasant — yellow/gold
    { id: "excited",    label: "Воодушевлён",  emoji: "🤩" },
    { id: "surprised",  label: "Удивлён",      emoji: "😮" },
    { id: "joyful",     label: "Радостен",     emoji: "😄" },
    { id: "hopeful",    label: "Надеюсь",      emoji: "🌟" },
    { id: "energized",  label: "Полон сил",    emoji: "⚡" },
    { id: "optimistic", label: "Оптимист",     emoji: "☀️" },
  ],
  HEU: [ // High Energy + Unpleasant — red
    { id: "tense",      label: "Напряжён",     emoji: "😬" },
    { id: "stressed",   label: "В стрессе",    emoji: "😖" },
    { id: "angry",      label: "Зол",          emoji: "😠" },
    { id: "frustrated", label: "Разочарован",  emoji: "😤" },
    { id: "anxious",    label: "Тревожен",     emoji: "😰" },
    { id: "worried",    label: "Беспокоюсь",   emoji: "😟" },
  ],
  LEP: [ // Low Energy + Pleasant — green
    { id: "calm",       label: "Спокоен",      emoji: "😌" },
    { id: "relaxed",    label: "Расслаблен",   emoji: "😎" },
    { id: "content",    label: "Доволен",      emoji: "🙂" },
    { id: "peaceful",   label: "Умиротворён",  emoji: "🕊" },
    { id: "grateful",   label: "Благодарен",   emoji: "🙏" },
    { id: "loved",      label: "Любим",        emoji: "🥰" },
  ],
  LEU: [ // Low Energy + Unpleasant — blue
    { id: "sad",          label: "Грустен",      emoji: "😢" },
    { id: "tired",        label: "Устал",        emoji: "😴" },
    { id: "bored",        label: "Скучаю",       emoji: "😑" },
    { id: "lonely",       label: "Одинок",       emoji: "😔" },
    { id: "disappointed", label: "Разочарован",  emoji: "😞" },
    { id: "depressed",    label: "Подавлен",     emoji: "😩" },
  ],
};

export const ALL_EMOTIONS = [
  ...EMOTIONS_BY_QUADRANT.HEP,
  ...EMOTIONS_BY_QUADRANT.HEU,
  ...EMOTIONS_BY_QUADRANT.LEP,
  ...EMOTIONS_BY_QUADRANT.LEU,
];

export const EMOTION_BY_ID = Object.fromEntries(
  ALL_EMOTIONS.map(e => [e.id, e])
);

export const QUADRANT_COLORS = {
  HEP: "var(--color-mood-hep, #fbbf24)",
  HEU: "var(--color-mood-heu, #ef4444)",
  LEP: "var(--color-mood-lep, #10b981)",
  LEU: "var(--color-mood-leu, #3b82f6)",
};

export const QUADRANT_LABELS = {
  HEP: "Энергично + приятно",
  HEU: "Энергично + неприятно",
  LEP: "Спокойно + приятно",
  LEU: "Спокойно + неприятно",
};

/**
 * Computed quadrant из (pleasantness, energy):
 * pleasantness >= 0 + energy >= 0 → HEP
 * pleasantness < 0 + energy >= 0 → HEU
 * pleasantness >= 0 + energy < 0 → LEP
 * pleasantness < 0 + energy < 0 → LEU
 */
export function computeQuadrant(pleasantness, energy) {
  if (energy >= 0) return pleasantness >= 0 ? "HEP" : "HEU";
  return pleasantness >= 0 ? "LEP" : "LEU";
}

/** Дефолтная эмоция для квадранта (центр квадранта при quick_checkin) */
export function defaultEmotionForQuadrant(quadrant) {
  const map = { HEP: "joyful", HEU: "stressed", LEP: "calm", LEU: "tired" };
  return map[quadrant] || "calm";
}
