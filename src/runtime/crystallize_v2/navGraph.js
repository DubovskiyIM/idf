/**
 * §3.3 дизайна: деривация навигационного графа между проекциями.
 * Рёбра выводятся из пересечений mainEntity/entities проекций.
 *
 * Правило detail-ссылки: если P1 показывает коллекцию сущностей X
 * (entities.includes(X)) и P2 — detail-проекция c mainEntity === X,
 * создаётся ребро P1 --item-click--> P2.
 */

export function deriveNavGraph(PROJECTIONS) {
  const edges = [];

  // Индексируем detail-проекции по их mainEntity
  const detailByEntity = {};
  for (const [projId, proj] of Object.entries(PROJECTIONS)) {
    if (proj.kind === "detail" && proj.mainEntity) {
      detailByEntity[proj.mainEntity] = { projId, proj };
    }
  }

  for (const [fromId, from] of Object.entries(PROJECTIONS)) {
    if (from.kind !== "catalog" && from.kind !== "feed") continue;
    const fromEntities = new Set(from.entities || []);

    for (const entity of fromEntities) {
      const detail = detailByEntity[entity];
      if (!detail) continue;
      if (detail.projId === fromId) continue;

      const paramName = detail.proj.idParam || `${entity.toLowerCase()}Id`;

      edges.push({
        from: fromId,
        to: detail.projId,
        kind: "item-click",
        itemEntity: entity,
        params: { [paramName]: "item.id" },
      });
    }
  }

  // Catalog → feed/detail с соответствующей mainEntity (conversation_list → chat_view)
  for (const [fromId, from] of Object.entries(PROJECTIONS)) {
    if (from.kind !== "catalog") continue;
    const mainEntity = from.mainEntity;
    if (!mainEntity) continue;

    for (const [toId, to] of Object.entries(PROJECTIONS)) {
      if (toId === fromId) continue;
      if (to.kind !== "feed" && to.kind !== "detail") continue;
      const toHasEntity = to.mainEntity === mainEntity ||
                          (to.entities || []).includes(mainEntity);
      if (!toHasEntity) continue;

      const exists = edges.some(e => e.from === fromId && e.to === toId && e.kind === "item-click");
      if (exists) continue;

      const paramName = to.idParam || `current${mainEntity}Id`;
      edges.push({
        from: fromId,
        to: toId,
        kind: "item-click",
        itemEntity: mainEntity,
        params: { [paramName]: "item.id" },
      });
    }
  }

  return {
    edges,
    edgesFrom(projId) {
      return edges.filter(e => e.from === projId);
    },
    edgesTo(projId) {
      return edges.filter(e => e.to === projId);
    },
  };
}
