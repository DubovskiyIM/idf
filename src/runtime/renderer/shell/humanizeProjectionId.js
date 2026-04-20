/**
 * humanizeProjectionId — читаемое имя для derived projection, у которого
 * автор не задал proj.name. Работает на стандартных паттернах деривации
 * R1/R3/R7/R7b/R3b/R11/R11 v2 (всё через suffix _list / _detail / _feed и
 * префикс my_).
 *
 * Host-specific fallback. Долгосрочно — SDK deriveProjections должен
 * эмитить name при деривации; пока эта функция решает UX-задачу «raw id
 * в sidebar'е» без изменения формата.
 */

// Мини-словарь частых стемов русского перевода. Расширять по мере появления
// новых entity в доменах. Первое — singular, второе — plural.
const ENTITY_RU = {
  insight: ["инсайт", "инсайты"],
  deal: ["сделка", "сделки"],
  wallet: ["кошелёк", "кошельки"],
  task: ["задача", "задачи"],
  response: ["отклик", "отклики"],
  review: ["отзыв", "отзывы"],
  user: ["пользователь", "пользователи"],
  listing: ["объявление", "объявления"],
  bid: ["ставка", "ставки"],
  order: ["заказ", "заказы"],
  dispute: ["спор", "споры"],
  watchlist: ["избранное", "избранное"],
  message: ["сообщение", "сообщения"],
  booking: ["бронь", "брони"],
  poll: ["опрос", "опросы"],
  meeting: ["встреча", "встречи"],
  hypothesis: ["гипотеза", "гипотезы"],
  activity: ["активность", "активности"],
  tag: ["тег", "теги"],
  moodentry: ["запись настроения", "записи настроения"],
  reminder: ["напоминание", "напоминания"],
  portfolio: ["портфель", "портфели"],
  position: ["позиция", "позиции"],
  asset: ["актив", "активы"],
  transaction: ["транзакция", "транзакции"],
  goal: ["цель", "цели"],
  alert: ["алерт", "алерты"],
  recommendation: ["рекомендация", "рекомендации"],
  merchant: ["заведение", "заведения"],
  delivery: ["доставка", "доставки"],
  zone: ["зона", "зоны"],
  payment: ["платёж", "платежи"],
  notification: ["уведомление", "уведомления"],
  sphere: ["сфера", "сферы"],
  habit: ["привычка", "привычки"],
  quote: ["цитата", "цитаты"],
  badge: ["бейдж", "бейджи"],
};

function entityLabel(stem, plural = false) {
  const pair = ENTITY_RU[stem.toLowerCase()];
  if (pair) return pair[plural ? 1 : 0];
  // Fallback — делаем Title Case, убираем подчёркивания.
  const spaced = stem.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function humanizeProjectionId(id) {
  // my_<entity>_(feed|list|detail) — owner-scoped R7 / R7b / R3b / R11 v2
  const myMatch = id.match(/^my_(.+)_(feed|list|detail)$/);
  if (myMatch) {
    const [, stem, kind] = myMatch;
    const plural = kind !== "detail";
    const base = entityLabel(stem, plural);
    if (kind === "feed") return `Мои ${base} (лента)`;
    if (kind === "detail") return `Мой ${base}`;
    return `Мои ${base}`;
  }

  // <entity>_(feed|list|detail) — R1 catalog, R3 detail, R11 feed
  const m = id.match(/^(.+)_(feed|list|detail)$/);
  if (m) {
    const [, stem, kind] = m;
    const plural = kind !== "detail";
    const base = entityLabel(stem, plural);
    const capitalized = base.charAt(0).toUpperCase() + base.slice(1);
    if (kind === "feed") return `${capitalized} (лента)`;
    return capitalized;
  }

  return id;
}
