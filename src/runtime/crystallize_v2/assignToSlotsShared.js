/**
 * Общие фильтры и помощники для всех архетипов (feed/catalog/detail).
 *
 * Вынесены из assignToSlots*.js, чтобы правила были консистентны между
 * архетипами и чтобы M2 polish не приходилось применять в трёх местах.
 */

// Witnesses, которые обозначают *результат* специализированного захвата или
// настроек, требующих виджетов, которых в M1/M2 нет.
//
// Три группы:
//  — capture widgets (голос, стикер, GIF, гео, опрос, видео)
//  — settings с enum/interval (theme, language, permissions, settings)
//  — коллекции/export (pack, album, import/export файлы)
//
// Всё это придёт в M3 через реестр кастомных контролов + SelectControl +
// BulkWizard. В M2 — пропускаем.
export const CAPTURE_WITNESSES = new Set([
  // capture
  "recording_duration", "duration",
  "sticker_id", "sticker_pack", "sticker_image",
  "gif_url",
  "latitude", "longitude",
  "video_duration", "video_size",
  "question", "options",
  "poll_results",
  "wallpaper_preview", "album_cover",
  // scheduling — нужен datetime picker в кастомном виджете
  "scheduled_time",
  // settings-as-enum
  "current_theme", "current_language",
  "current_settings", "current_permissions",
  "current_interval", "current_rules",
  // коллекции/export/import
  "pack_name", "album_title",
  "contacts_file",
]);

export function needsCustomCapture(intent) {
  const witnesses = intent.particles?.witnesses || [];
  return witnesses.some(w => CAPTURE_WITNESSES.has(w));
}

/**
 * Creator-интент нуждается в entity-picker'е, если в его entities есть
 * сущность, отличная от той, что он создаёт, И не предоставляемая route-
 * контекстом проекции (routeEntities).
 *
 * Пример: create_direct_chat создаёт Conversation, но требует user: User —
 * User нет в routeEntities любой проекции → нужен picker.
 * Пример: send_message создаёт Message и имеет entity conversation: Conversation
 * — Conversation В routeEntities у chat_view → picker НЕ нужен, беседа
 * известна из маршрута.
 */
export function needsEntityPicker(intent, projection) {
  if (!intent.creates) return false;
  const entities = (intent.particles?.entities || [])
    .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
  const nonCreates = entities.filter(e => e !== intent.creates);
  if (nonCreates.length === 0) return false;

  // Если проекция не передана — старое поведение (любая не-creates entity → picker).
  if (!projection) return true;

  // Роутовый скоп: mainEntity + routeEntities (или projection.entities как дефолт).
  const routeScope = new Set(
    projection.routeEntities
      ? [projection.mainEntity, ...projection.routeEntities].filter(Boolean)
      : (projection.entities || [])
  );
  if (projection.mainEntity) routeScope.add(projection.mainEntity);

  // Если хоть одна не-creates entity НЕ в routeScope — picker нужен.
  return nonCreates.some(e => !routeScope.has(e));
}

/**
 * Blacklist намерений, которые требуют виджетов/контекста, которых нет в M2:
 *  — picker участника группы для административных действий
 *  — picker запроса на вступление
 *  — picker контакт-группы
 *  — BulkWizard для массовых операций
 *
 * Эти интенты пропускаются в кристаллизации M2. В M3 они получат поддержку
 * через реестр кастомных виджетов / BulkWizard / выделенную проекцию
 * group_members.
 */
export const UNSUPPORTED_INTENTS_M2 = new Set([
  // Админские действия над участниками — нужен picker участника
  "promote_to_admin", "demote_admin", "transfer_ownership",
  "ban_user", "unban_user", "remove_from_group",
  // Запросы на вступление — нужна отдельная проекция join_requests
  "approve_join_request", "reject_join_request", "set_join_approval",
  // Контакт-группы — нужен picker контакт-группы
  "add_to_contact_group", "remove_from_contact_group",
  "create_contact_group",
  // Extended / массовые операции — нужен BulkWizard
  "bulk_delete_messages", "select_messages",
  // Закрепление сообщения в группе — requires participant-picker + message-picker
  "pin_group_message",
  // Перевод сообщения — нужен API перевода
  "translate_message",
  // Каналы — отдельная сущность в онтологии
  "create_channel",
  // Read-only intents без эффектов — не вписываются в action paradigm M2.
  // copy_message делает browser-side copy; message_info — просмотр метаданных.
  // В M3 станут «read-only детализациями» или сигналами.
  "copy_message", "message_info",
  // Контекстно-зависимые per-participant без picker'а
  "mark_as_unread", "leave_group",
  // search_contacts — scoped к contact_list, а не к chat_view/conversation_list
  "search_contacts",
  // Закладки — нужна отдельная проекция bookmarks, не показываем до M3
  "bookmark_message", "remove_bookmark",
  // Реакции — нужен emoji picker
  "react_to_message", "remove_reaction",
  // Report — report_reason не переводится в text input правильно
  "report_message",
  // Forward — нужен picker целевой беседы (не текущей)
  "forward_message", "share_contact", "send_contact_card",
  // Добавить участника в группу — нужен picker пользователя
  "add_to_group",
  // Управление профилем — не место в contact_list, отдельный user_profile
  // их показывает через detail-архетип
  "delete_avatar", "enable_2fa", "delete_account",
  // Ссылки-приглашения — отдельная UX-механика
  "invite_by_link", "revoke_invite_link",
  // Медиа/файлы — нужен preview-виджет
  "send_image", "send_video", "send_document", "set_avatar",
  "set_group_avatar", "set_chat_wallpaper",
]);

export function isUnsupportedInM2(intentId) {
  return UNSUPPORTED_INTENTS_M2.has(intentId);
}

/**
 * Правило применимости интента к проекции (M2 polish).
 *
 * Intent применим, если:
 *  1. Pure projection-level utility — нет entities, нет dotted witnesses
 *     (поиск, фильтры без привязки к сущностям), ИЛИ
 *  2. Все entities интента находятся в route scope проекции. Route scope =
 *     mainEntity + routeEntities (если явно заданы автором) или
 *     mainEntity + projection.entities (дефолт). `every`, не `some` — любая
 *     неизвестная entity означает, что intent требует picker'а.
 *
 * До этого правила пускали любой intent, у которого *хотя бы одна* entity
 * была в projection.entities, что приводило к появлению create_direct_chat
 * (требует picker User) в conversation_list — отсечено в M1.
 *
 * Админские интенты (promote_to_admin, ban_user…) формально проходят это
 * правило (их entity = Participant входит в projection.entities), но
 * отсекаются отдельно через `isUnsupportedInM2` — см. главный цикл архетипа.
 */
export function appliesToProjection(intent, projection) {
  const mainEntity = projection.mainEntity;
  const intentEntities = (intent.particles?.entities || [])
    .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
  const witnesses = intent.particles?.witnesses || [];

  // Creator-scoping: интент, создающий сущность X, применяется только к
  // проекциям с mainEntity === X. Предотвращает появление create_group в
  // chat_view (mainEntity Message) и аналогичные «наведённые» кнопки создания.
  if (intent.creates && mainEntity && intent.creates !== mainEntity) {
    return false;
  }

  // Effect-less intents: интенты без effects — это read-only утилиты
  // (`message_info`, `copy_message`, `search_*`). Часть из них полезна
  // как projection-level-поиск, часть бессмысленна как кнопка. Оставляем
  // только «поиск» — intents без effects, но с `query` witness.
  const hasEffects = (intent.particles?.effects || []).length > 0;
  const isSearchUtility = witnesses.includes("query");
  if (!hasEffects && !isSearchUtility) {
    return false;
  }

  // 1. Pure projection-level utility (search, filters без entity binding)
  const hasDottedWitness = witnesses.some(w => w.includes("."));
  if (intentEntities.length === 0 && !hasDottedWitness) return true;

  // 2. Route scope: либо явно объявленный автором, либо все entities проекции
  const routeScope = new Set(
    projection.routeEntities
      ? [mainEntity, ...projection.routeEntities].filter(Boolean)
      : (projection.entities || [])
  );
  if (mainEntity) routeScope.add(mainEntity);

  if (intentEntities.length > 0 && intentEntities.every(e => routeScope.has(e))) {
    return true;
  }

  return false;
}
