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

  // Торговля / аукцион
  currentPrice: "Текущая цена",
  startPrice: "Начальная цена",
  buyNowPrice: "Купить сейчас",
  reservePrice: "Резервная цена",
  shippingCost: "Доставка",
  shippingFrom: "Откуда",
  shippingAddress: "Адрес доставки",
  condition: "Состояние",
  status: "Статус",
  auctionEnd: "Завершение",
  bidCount: "Ставок",
  watcherCount: "Наблюдателей",
  totalAmount: "Сумма",
  finalPrice: "Итого",
  trackingNumber: "Трекинг",
  amount: "Сумма",
  rating: "Рейтинг",
  salesCount: "Продаж",
  location: "Откуда",
  verified: "Проверен",
  registeredAt: "Регистрация",
  createdAt: "Создано",
  paidAt: "Оплачено",
  shippedAt: "Отправлено",
  deliveredAt: "Доставлено",
  images: "Фото",
  featured: "Рекомендуемый",
  read: "Прочитано",

  // Бронирование
  duration: "Длительность",
  price: "Цена",
  active: "Активна",
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

/**
 * Маппинг enum-значений для человекочитаемого отображения.
 * Ключ: "field:value" или просто "value" (fallback).
 */
const VALUE_DICTIONARY = {
  // Статусы общие
  "status:draft": "Черновик",
  "status:active": "Активен",
  "status:sold": "Продан",
  "status:cancelled": "Отменён",
  "status:suspended": "Заблокирован",
  "status:completed": "Завершён",
  "status:pending_payment": "Ожидает оплаты",
  "status:paid": "Оплачен",
  "status:shipped": "Отправлен",
  "status:delivered": "Доставлен",
  "status:disputed": "Спор",
  "status:refunded": "Возврат",
  "status:open": "Открыт",
  "status:closed": "Закрыт",
  "status:resolved": "Решён",
  "status:confirmed": "Подтверждён",
  "status:invited": "Приглашён",
  "status:declined": "Отклонён",

  // Состояние товара
  "condition:new": "Новый",
  "condition:like_new": "Как новый",
  "condition:good": "Хорошее",
  "condition:fair": "Удовлетворительное",
  "condition:poor": "Плохое",
  "condition:parts": "На запчасти",
};

/**
 * Превратить enum-значение в человекочитаемое.
 * Приоритет: "field:value" → "value" → as-is.
 */
export function humanValue(fieldName, value) {
  if (value == null || value === "") return "";
  const str = String(value);
  return VALUE_DICTIONARY[`${fieldName}:${str}`] || str;
}

export function humanLabel(fieldName, explicitLabel) {
  if (explicitLabel) return explicitLabel;
  if (!fieldName) return "";
  if (DICTIONARY[fieldName]) return DICTIONARY[fieldName];
  return humanize(fieldName);
}
