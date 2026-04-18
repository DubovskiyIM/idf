import { useEffect, useState } from "react";

// Vite glob: ленивые loaders всех доменов. Тот же паттерн что и в
// DomainRuntime, но расположение файла влияет на относительный путь.
const LOADERS = import.meta.glob("../domains/*/domain.js");

/**
 * useDomainModule — загружает src/domains/${domainId}/domain.js лениво.
 * Используется в Studio-вкладках (Онтология / Целостность), которые не
 * нуждаются в полном V2Shell runtime, а только в статичном domain-
 * объекте с ONTOLOGY / INTENTS / PROJECTIONS.
 *
 * @returns { domain, loading, error }
 */
export default function useDomainModule(domainId) {
  const [state, setState] = useState({ domain: null, loading: !!domainId, error: null });

  useEffect(() => {
    if (!domainId) { setState({ domain: null, loading: false, error: null }); return; }
    const key = `../domains/${domainId}/domain.js`;
    const loader = LOADERS[key];
    if (!loader) {
      setState({ domain: null, loading: false, error: `Домен «${domainId}» не найден на диске` });
      return;
    }
    setState({ domain: null, loading: true, error: null });
    let cancelled = false;
    loader()
      .then((mod) => { if (!cancelled) setState({ domain: mod, loading: false, error: null }); })
      .catch((e) => { if (!cancelled) setState({ domain: null, loading: false, error: e.message }); });
    return () => { cancelled = true; };
  }, [domainId]);

  return state;
}
