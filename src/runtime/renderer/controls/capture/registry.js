/**
 * Реестр кастомных виджетов захвата (customCapture).
 *
 * Сюда регистрируются React-компоненты, которые рендерятся через
 * OverlayManager при клике на customCapture-кнопку. Каждый виджет
 * знает свой id + match-функцию + компонент. Match-правила дублируются
 * в controlArchetypes.js::CAPTURE_RULES — кристаллизатор использует
 * их для выбора widgetId без импорта React-компонентов, runtime — для
 * резолвинга компонента по id.
 *
 * Такое разделение позволяет crystallize_v2 оставаться чистым (без JSX)
 * и одновременно имеет один источник правды для match-правил
 * (см. M3.5b Step 5).
 */

export const CAPTURE_WIDGETS = [];

export function registerCaptureWidget(widget) {
  if (!widget?.id || typeof widget.match !== "function" || !widget.component) {
    throw new Error("registerCaptureWidget: widget must have { id, match, component }");
  }
  CAPTURE_WIDGETS.push(widget);
  return widget;
}

export function findCaptureWidgetById(id) {
  return CAPTURE_WIDGETS.find(w => w.id === id) || null;
}

export function findCaptureWidget(intent, intentId) {
  for (const w of CAPTURE_WIDGETS) {
    if (w.match(intent, intentId)) return w;
  }
  return null;
}
