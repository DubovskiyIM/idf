/**
 * Правила присвоения иконок намерениям.
 *
 * Приоритет:
 *  1. Явный intent.icon (автор в определении) — побеждает всё
 *  2. Домен-специфичные правила из domain.ICON_RULES (если переданы)
 *  3. Общие правила по ключевым словам в intent id
 *  4. Fallback: ⚡
 *
 * Правило — пара { match, icon }. `match` может быть строкой, массивом строк
 * (OR), регулярным выражением или функцией (intentId) => boolean. Первое
 * совпавшее правило побеждает.
 */

// Правила по умолчанию — покрывают типовые паттерны CRUD + доменные шаблоны
// из четырёх прототипных доменов (messenger + booking + planning + workflow).
export const DEFAULT_ICON_RULES = [
  // === Деструктивные ===
  { match: /^(delete|remove|clear|cancel|abandon)_/, icon: "🗑" },
  { match: /^(ban|block|reject)/, icon: "🚫" },
  { match: /^unban|^unblock|^accept_/, icon: "✓" },
  { match: /^unarchive_/, icon: "📤" },
  { match: /^archive_/, icon: "📦" },

  // === Коммуникация ===
  { match: /^(send_message|reply|send_sticker|send_gif)/, icon: "📤" },
  { match: /send_image|set_avatar|set_group_avatar/, icon: "🖼" },
  { match: /send_video/, icon: "🎬" },
  { match: /send_document/, icon: "📎" },
  { match: /send_voice|record_voice/, icon: "🎤" },
  { match: /send_location/, icon: "📍" },
  { match: /send_poll|^create_poll|^vote/, icon: "🗳" },
  { match: /forward/, icon: "↗" },

  // === Редактирование ===
  { match: /^edit|^rename|^update/, icon: "✎" },
  { match: /nickname/, icon: "✎" },
  { match: /^translate/, icon: "🌐" },
  { match: /^copy/, icon: "⎘" },

  // === Закрепление / избранное ===
  { match: /^unpin/, icon: "📍" },
  { match: /^pin/, icon: "📌" },
  { match: /^remove_bookmark/, icon: "☆" },
  { match: /^bookmark|^save/, icon: "⭐" },

  // === Уведомления / звук ===
  { match: /^mute/, icon: "🔇" },
  { match: /^unmute/, icon: "🔔" },
  { match: /notification/, icon: "🔔" },

  // === Создание ===
  { match: /^create_direct/, icon: "💬" },
  { match: /^create_group/, icon: "👥" },
  { match: /^create_channel/, icon: "📢" },
  { match: /^create_/, icon: "➕" },
  { match: /^add_/, icon: "➕" },

  // === Поиск и фильтрация ===
  { match: /^search|^find/, icon: "🔍" },
  { match: /^filter|^sort/, icon: "⇅" },
  { match: /^set_filter/, icon: "⚙" },

  // === Контакты / люди ===
  { match: /^add_contact/, icon: "👤" },
  { match: /^invite/, icon: "✉" },
  { match: /^promote/, icon: "⬆" },
  { match: /^demote/, icon: "⬇" },
  { match: /^transfer/, icon: "🔑" },
  { match: /^leave/, icon: "←" },

  // === Группы / админка ===
  { match: /^approve/, icon: "✓" },
  { match: /set_group|set_welcome|set_slow/, icon: "⚙" },
  { match: /^set_.*_(settings|permissions|rules|interval)/, icon: "⚙" },
  { match: /^set_(theme|language)/, icon: "⚙" },

  // === Звонки ===
  { match: /start_voice_call/, icon: "📞" },
  { match: /start_video_call/, icon: "📹" },
  { match: /end_call/, icon: "📵" },

  // === Workflow / узлы ===
  { match: /^connect/, icon: "🔗" },
  { match: /^disconnect/, icon: "✂" },
  { match: /^execute|^run/, icon: "▶" },
  { match: /^stop/, icon: "⏹" },
  { match: /^save_workflow/, icon: "💾" },
  { match: /^duplicate/, icon: "⎘" },
  { match: /^configure/, icon: "⚙" },
  { match: /^move_/, icon: "✥" },

  // === Booking ===
  { match: /^confirm/, icon: "✓" },
  { match: /^book|^reserve/, icon: "📅" },
  { match: /^reschedule/, icon: "🔄" },
  { match: /^complete/, icon: "✓" },
  { match: /^leave_review|^edit_review/, icon: "⭐" },
  { match: /^mark_no_show/, icon: "⚠" },

  // === Planning ===
  { match: /^open_poll/, icon: "▶" },
  { match: /^close_poll/, icon: "⏹" },
  { match: /^resolve_poll/, icon: "✓" },
  { match: /^add_time_option|^suggest_alternative/, icon: "➕" },
  { match: /^set_deadline/, icon: "⏰" },
  { match: /^change_vote/, icon: "🔄" },

  // === Экспорт / импорт ===
  { match: /^export/, icon: "⬇" },
  { match: /^import/, icon: "⬆" },

  // === Информация / метаданные ===
  { match: /_info$/, icon: "ℹ" },
  { match: /^mark_as_read/, icon: "✓" },
  { match: /^mark_as_unread/, icon: "●" },

  // === Профиль / настройки (общее) ===
  { match: /^set_status/, icon: "💭" },
  { match: /^update_profile/, icon: "👤" },
  { match: /^enable_2fa/, icon: "🔒" },
  { match: /^delete_account/, icon: "⚠" },
];

const FALLBACK_ICON = "⚡";

/**
 * Получить иконку для намерения.
 * @param {string} intentId
 * @param {object} intent — определение (для explicit override через intent.icon)
 * @param {Array} extraRules — опциональные домен-специфичные правила
 *   (мерджатся перед default правилами — их приоритет выше)
 * @returns {string}
 */
export function getIntentIcon(intentId, intent, extraRules = []) {
  // 1. Explicit override
  if (intent?.icon) return intent.icon;

  // 2. Домен-специфичные + общие правила
  const allRules = [...extraRules, ...DEFAULT_ICON_RULES];
  for (const rule of allRules) {
    if (matchesRule(rule.match, intentId)) return rule.icon;
  }

  // 3. Fallback
  return FALLBACK_ICON;
}

function matchesRule(match, intentId) {
  if (typeof match === "string") return intentId.includes(match);
  if (match instanceof RegExp) return match.test(intentId);
  if (Array.isArray(match)) return match.some(m => matchesRule(m, intentId));
  if (typeof match === "function") return Boolean(match(intentId));
  return false;
}
