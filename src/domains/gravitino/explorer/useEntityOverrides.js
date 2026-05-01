/**
 * useEntityOverrides — общий хук для optimistic UI overrides
 * (owner / tag-policy assignments / enabled) per entity (U6.3).
 *
 * Используется CatalogExplorer для трёх уровней entity:
 *   - catalog (legacy: ownerOverrides + assignments + enabledOverrides)
 *   - schema  (U6.3: schemaOwnerOverrides + schemaAssignments)
 *   - table   (U6.3: tableOwnerOverrides + tableAssignments)
 *
 * Вынесено отдельно ради LOC-budget'а в CatalogExplorer.jsx (<300 LOC).
 */
import { useState } from "react";

/**
 * @returns {{
 *   ownerOverrides: Record<string,string>,
 *   assignments:    Record<string,{tags?:string[],policies?:string[]}>,
 *   setOwner:       (id:string, name:string) => void,
 *   setAssoc:       (id:string, type:"tags"|"policies", names:string[]) => void,
 *   apply:          (entity:object) => object,
 * }}
 */
export function useEntityOverrides() {
  const [ownerOverrides, setOwnerOverrides] = useState({});
  const [assignments, setAssignments] = useState({});

  const setOwner = (id, name) =>
    setOwnerOverrides(prev => ({ ...prev, [id]: name }));

  const setAssoc = (id, type, names) =>
    setAssignments(prev => ({
      ...prev,
      [id]: { ...(prev[id] || {}), [type]: names },
    }));

  const apply = (entity) => {
    if (!entity) return entity;
    const ow = ownerOverrides[entity.id];
    const a = assignments[entity.id];
    let next = entity;
    if (ow !== undefined) next = { ...next, owner: ow };
    if (a?.tags !== undefined) next = { ...next, tags: a.tags };
    if (a?.policies !== undefined) next = { ...next, policies: a.policies };
    return next;
  };

  return { ownerOverrides, assignments, setOwner, setAssoc, apply };
}
