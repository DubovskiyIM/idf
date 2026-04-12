/**
 * Общие фильтры и помощники для всех архетипов (feed/catalog/detail).
 *
 * Вынесены из assignToSlots*.js, чтобы правила были консистентны между
 * архетипами и чтобы M2 polish не приходилось применять в трёх местах.
 */

// Witnesses, которые обозначают *результат* специализированного захвата или
// настроек, требующих виджетов, которых в M3.5b нет.
//
// В M3.5b покрыты: голос (voiceRecorder по witness recording_duration/duration),
// реакции (emojiPicker по react_*), выбор сущности (entityPicker по
// creates+entity). Их нет в CAPTURE_WITNESSES — они пройдут через customCapture.
//
// Остаются непокрытыми: стикеры, GIF, геолокация, видео, опросы, настройки,
// коллекции/export. Их скип через этот фильтр. Придут в M3.6+.
export const CAPTURE_WITNESSES = new Set([
  // capture (непокрытые M3.5b)
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
  const creates = normalizeCreates(intent.creates);
  if (!creates) return false;
  const entities = (intent.particles?.entities || [])
    .map(e => e.split(":").pop().trim().replace(/\[\]$/, ""));
  const nonCreates = entities.filter(e => e !== creates);
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
  // select_messages — требует UI выделения (multi-select mode). В M3.6
  // BulkWizard делает выделение своим внутренним шагом, так что отдельный
  // intent не нужен в toolbar.
  "select_messages",
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
  // Реакции — покрыто emojiPicker'ом (M3.5b), но только per-item. В M3.5b
  // остаётся решить UX «собственных реакций» (react_with_custom и т.п.)
  // Report — report_reason не переводится в text input правильно
  "report_message",
  // share_contact, send_contact_card — creates не User, но требуют picker
  // особой семантики. Ждут M3.6.
  "share_contact", "send_contact_card",
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
 * Нормализация `intent.creates`: booking использует суффикс состояния
 * (`Booking(draft)`, `Booking(confirmed)`), но проекции объявляют
 * `mainEntity: "Booking"`. Срезаем скобочный суффикс, чтобы матчинг работал
 * единообразно для всех доменов.
 */
export function normalizeCreates(raw) {
  if (!raw || typeof raw !== "string") return raw;
  return raw.replace(/\s*\(.*\)\s*$/, "").trim();
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
  // ИСКЛЮЧЕНИЕ: cross-entity creators разрешены если intent явно ссылается
  // на mainEntity в entities (пример: create_direct_chat создаёт Conversation,
  // но работает как per-item action на User в people_list).
  const creates = normalizeCreates(intent.creates);
  if (creates && mainEntity && creates !== mainEntity) {
    const entityRefs = intentEntities;
    if (!entityRefs.includes(mainEntity)) {
      return false;
    }
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

  // 2. Creator-intent для главной сущности: если intent создаёт mainEntity
  // проекции, пускаем даже если есть extra entities вне route scope —
  // их закроет customCapture.entityPicker (M3.5b). Без этого правила
  // create_direct_chat (creates Conversation + entity User) не попадал в
  // conversation_list, поскольку User отсутствует в routeScope.
  if (creates && creates === mainEntity) {
    return true;
  }

  // 3. Route scope: либо явно объявленный автором, либо все entities проекции
  const routeScope = new Set(
    projection.routeEntities
      ? [mainEntity, ...projection.routeEntities].filter(Boolean)
      : (projection.entities || [])
  );
  if (mainEntity) routeScope.add(mainEntity);
  // Cross-entity creators: creates-entity автоматически считается "в scope",
  // потому что intent уже прошёл creator-scoping check выше (entities включает
  // mainEntity). Без этого create_direct_chat (creates Conversation + entity
  // User) не попадает в people_list — Conversation не в routeScope.
  if (creates) routeScope.add(creates);

  if (intentEntities.length > 0 && intentEntities.every(e => routeScope.has(e))) {
    return true;
  }

  return false;
}
