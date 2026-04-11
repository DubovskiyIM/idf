/**
 * Human-readable labels для field-имён.
 *
 * Приоритет резолва:
 *   1. Явный spec.label — полностью побеждает
 *   2. Доменная онтология (если есть ontology.entities[X].fields[name].label)
 *      — это отдельная таска, пока обрабатывается только в buildFormSpec
 *   3. Глобальный словарь стандартных имён (ниже)
 *   4. Fallback: humanize camelCase → "Start Time"
 */

const DICTIONARY = {
  // Даты и время
  date: "Дата",
  startTime: "Начало",
  endTime: "Конец",
  start_time: "Начало",
  end_time: "Конец",
  deadline: "Дедлайн",
  scheduledTime: "Запланировано",

  // Идентификация
  name: "Имя",
  title: "Название",
  description: "Описание",
  email: "Email",
  phone: "Телефон",
  url: "URL",

  // Сообщения
  content: "Сообщение",
  message: "Сообщение",
  text: "Текст",
  body: "Текст",

  // Модерация
  reason: "Причина",
  comment: "Комментарий",

  // Профиль
  avatar: "Аватар",
  statusMessage: "Статус",
  bio: "О себе",

  // Голосование
  value: "Значение",
};

/**
 * Превратить camelCase / snake_case имя в человекочитаемое:
 *   startTime → "Start Time"
 *   poll_title → "Poll Title"
 * Используется как последний fallback, когда нет ничего лучше.
 */
function humanize(name) {
  if (!name) return "";
  return String(name)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/^./, s => s.toUpperCase());
}

export function humanLabel(fieldName, explicitLabel) {
  if (explicitLabel) return explicitLabel;
  if (!fieldName) return "";
  if (DICTIONARY[fieldName]) return DICTIONARY[fieldName];
  return humanize(fieldName);
}
