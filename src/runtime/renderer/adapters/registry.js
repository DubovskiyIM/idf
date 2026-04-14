/**
 * Реестр UI-адаптеров (§17 манифеста — адаптивный слой как visual language).
 *
 * Адаптер — это отображение declarative spec'ов в конкретные React-компоненты
 * стороннего UI-kit'а (Mantine, shadcn/ui, Ant Design, собственный...).
 * Реестр держит один активный адаптер; компоненты runtime рендерера сначала
 * ищут spec.control в adapter.controls, и если находят — используют его,
 * иначе падают на built-in fallback.
 *
 * Это даёт:
 *   - Единую точку переключения визуального языка
 *   - Инкрементальную миграцию (один control за раз переезжает на kit)
 *   - Три слоя проекции (canonical / adaptive / personal) как одно семейство
 *     артефактов, но разные адаптеры рендера
 */

let currentAdapter = null;

/**
 * Установить активный адаптер. Обычно вызывается один раз при bootstrap
 * приложения в main.jsx.
 */
export function registerUIAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") {
    currentAdapter = null;
    return;
  }
  currentAdapter = adapter;
}

export function getUIAdapter() {
  return currentAdapter;
}

/**
 * Резолвить конкретный компонент по kind + control type.
 * kind — категория («parameter», «button», «card», «modal»).
 * Возвращает React-компонент или null, если адаптер не предоставляет реализацию.
 */
export function getAdaptedComponent(kind, type) {
  if (!currentAdapter) return null;
  const category = currentAdapter[kind];
  if (!category || typeof category !== "object") return null;
  return category[type] || null;
}

/**
 * Capability surface адаптера (§26.4 / §26.6).
 *
 * Адаптер может объявить `capabilities: { primitive: { chart: {
 * chartTypes: ["line", "pie", "candlestick"] } } }` — это декларативная
 * surface. Проекция декларирует "candlestick", адаптер говорит что
 * умеет. Несовпадение → warning + graceful fallback, не ошибка.
 *
 * Возвращает:
 *   true  — поддерживается (капабилити есть и не содержит отказа)
 *   false — явно не поддерживается (capability = false)
 *   object — детальный capability-descriptor ({ chartTypes, fallback, ... })
 *   null  — не объявлено (unknown — по умолчанию считается supported,
 *           чтобы не ломать существующие адаптеры)
 *
 * Пример использования в chart-primitive:
 *   const cap = getCapability("primitive", "chart");
 *   if (cap?.chartTypes && !cap.chartTypes.includes(spec.chartType)) {
 *     console.warn("chartType not supported — fallback");
 *   }
 */
export function getCapability(kind, type) {
  if (!currentAdapter) return null;
  const caps = currentAdapter.capabilities;
  if (!caps) return null;
  const category = caps[kind];
  if (!category || typeof category !== "object") return null;
  if (!(type in category)) return null;
  return category[type];
}

/**
 * Helper: проверяет, что адаптер поддерживает конкретный variant
 * (chartType для chart, size для button, и т.п.).
 * Возвращает true если:
 *   - capability не объявлена (unknown = assume supported)
 *   - capability === true
 *   - variant входит в capability[variantKey] array
 */
export function supportsVariant(kind, type, variantKey, variant) {
  const cap = getCapability(kind, type);
  if (cap === null || cap === undefined) return true; // unknown → assume
  if (cap === false) return false;
  if (cap === true) return true;
  if (typeof cap !== "object") return true;
  const list = cap[variantKey];
  if (!Array.isArray(list)) return true;
  return list.includes(variant);
}
