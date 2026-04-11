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
