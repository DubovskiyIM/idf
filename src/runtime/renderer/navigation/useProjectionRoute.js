import { useState, useCallback } from "react";

/**
 * Стек проекций для V2-рендерера. Возвращает current/history + navigate/back/reset.
 */
export function useProjectionRoute(initialProjection = null, initialParams = {}) {
  const [stack, setStack] = useState(
    initialProjection
      ? [{ projectionId: initialProjection, params: initialParams }]
      : []
  );

  const current = stack.length > 0 ? stack[stack.length - 1] : null;
  const history = stack.slice(0, -1);

  const navigate = useCallback((projectionId, params = {}) => {
    setStack(prev => [...prev, { projectionId, params }]);
  }, []);

  const back = useCallback(() => {
    setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  }, []);

  const reset = useCallback((projectionId, params = {}) => {
    setStack([{ projectionId, params }]);
  }, []);

  const canGoBack = stack.length > 1;

  return { current, history, navigate, back, reset, canGoBack };
}
