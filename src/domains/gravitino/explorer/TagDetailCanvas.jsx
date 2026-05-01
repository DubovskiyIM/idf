/**
 * TagDetailCanvas — canvas-обёртка для tag_detail (U-tag-policy-objects).
 *
 * Читает routeParams.tagId, ищет Tag в world.tags (по id или name) и
 * рендерит MetadataObjectsPane (reverse-lookup catalog/schema/table/...
 * с этим тегом + Unlink action). Регистрируется как canvas("tag_detail").
 *
 * Unlink → exec("associateTags", { entity, entityType: collectionKey,
 * tags: filteredList }) — domain.js custom buildEffects делает overwrite
 * by entity.id.
 */
import MetadataObjectsPane from "./MetadataObjectsPane.jsx";

export default function TagDetailCanvas({ world = {}, routeParams, ctx, exec = () => {} }) {
  const params = routeParams ?? ctx?.routeParams ?? {};
  const tagId = params.tagId;
  const tag = (world.tags || []).find(t => t.id === tagId || t.name === tagId);
  if (!tag) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--idf-text-muted)" }}>
        Tag не найден (id: {String(tagId)})
      </div>
    );
  }
  const metalakeName = (world.metalakes || [])[0]?.name || "default";
  return (
    <MetadataObjectsPane
      kind="tag"
      name={tag.name}
      world={world}
      onUnlink={({ entityType, collectionKey, entity }) => {
        const newTags = (entity.tags || []).filter(n => n !== tag.name);
        exec("associateTags", {
          entity,
          entityType: collectionKey,
          tags: newTags,
          metalake: metalakeName,
          metadataObjectType: entityType,
          metadataObjectFullName: entity.name,
        });
      }}
    />
  );
}
