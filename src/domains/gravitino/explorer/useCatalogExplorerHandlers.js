/**
 * useCatalogExplorerHandlers — экстракт exec-handler'ов CatalogExplorer
 * чтобы остаться < 300 LOC после wire всех modify-nested через exec
 * (U-backend-exec-2).
 *
 * Все handlers — чистые closures над exec/world/metalake/viewer/toast +
 * dialog-state setters. UI-state (selected* / dialog-targets) живут в
 * CatalogExplorer; здесь только мост world → exec(intentId, flatCtx).
 *
 * U-fix-exec-signature (CRITICAL): SDK exec — 2 args (intentId, ctx). Все
 * params + context flatten'утся в один ctx; domain.js handlers разбираются
 * через explicit destructure + pickOverrides() для alter*.
 */

export function useCatalogExplorerHandlers({
  world, metalake, viewer, exec, toast,
  selectedCatalog, selectedSchema, selectedModel,
  setCreating,
  setOwnerDialogTarget,
  setSchemaOwnerDialogTarget,
  setTableOwnerDialogTarget,
  setLinkingForModel,
  setDeleteTarget,
  setSelectedCatalog, setSelectedSchema, resetLeaves,
}) {
  const allCatalogs = world.catalogs || [];

  const handleCreate = (formData) => {
    exec("createCatalog", {
      ...formData,
      metalake: metalake?.name,
      metalakeId: metalake?.id,
      tags: [],
      policies: [],
      audit: { creator: viewer?.name || "ui", createTime: new Date().toISOString() },
    });
    setCreating(false);
    toast(`Catalog «${formData.name}» создан`, "success");
  };

  // Catalog-level: associate (tag/policy) + setOwner + enable/disable.
  const onAssociate = (catalogId, type, names) => {
    const c = allCatalogs.find(x => x.id === catalogId);
    if (!c) return;
    const intentId = type === "tags" ? "associateTags" : "associatePoliciesForObject";
    exec(intentId, {
      entity: c, entityType: "catalogs", [type]: names,
      metalake: metalake?.name, metadataObjectType: "catalog", metadataObjectFullName: c.name,
    });
    toast(`${type === "tags" ? "Tag" : "Policy"} обновлён для ${c.name}`, "success");
  };

  const handleSetOwner = (ownerDialogTarget) => ({ name }) => {
    if (!ownerDialogTarget) return;
    const c = allCatalogs.find(x => x.id === ownerDialogTarget);
    if (!c) return;
    exec("setOwner", {
      entity: c, entityType: "catalogs", newOwnerName: name,
      metalake: metalake?.name, metadataObjectType: "catalog", metadataObjectFullName: c.name,
    });
    toast(`Owner назначен: ${name}`, "success");
    setOwnerDialogTarget(null);
  };

  const handleConfirmDelete = (deleteTarget) => () => {
    if (!deleteTarget) return;
    exec("dropCatalog", { metalake: metalake?.name, catalog: deleteTarget.name });
    if (selectedCatalog?.id === deleteTarget.id) {
      setSelectedCatalog(null); setSelectedSchema(null); resetLeaves();
    }
    toast(`Catalog «${deleteTarget.name}» удалён`, "error");
    setDeleteTarget(null);
  };

  const handleToggleEnabled = (catalogId, next) => {
    const c = allCatalogs.find(x => x.id === catalogId);
    if (!c) return;
    // U-fix-toggle-tabs: enableCatalog/disableCatalog не существуют в
    // imported.js. alterCatalog (PUT full body) + enabled override.
    exec("alterCatalog", {
      entity: c, enabled: next,
      metalake: metalake?.name, catalog: c.name,
    });
    toast(`Catalog ${next ? "включён" : "приостановлен"}`, next ? "success" : "warning");
  };

  // Model versions: link / unlink / aliases.
  const handleLinkVersion = (linkingForModel) => ({ version, modelObject, aliases }) => {
    if (!linkingForModel) return;
    exec("linkModelVersion", {
      version: {
        modelId: linkingForModel,
        version, modelObject, aliases, properties: {},
        audit: { creator: viewer?.name || "ui", createTime: new Date().toISOString() },
      },
      metalake: metalake?.name, catalog: selectedCatalog?.name,
      schema: selectedSchema?.name, model: selectedModel?.name,
    });
    setLinkingForModel(null);
    toast(`Version linked`, "success");
  };

  const handleUnlinkVersion = (versionId) => {
    exec("deleteModelVersion", {
      versionId,
      metalake: metalake?.name, catalog: selectedCatalog?.name,
      schema: selectedSchema?.name, model: selectedModel?.name, version: versionId,
    });
    toast(`Version unlinked`, "warning");
  };

  const handleEditAliases = (versionId, aliases) => {
    const v = (world.model_versions || []).find(x => x.id === versionId);
    if (!v) return;
    exec("updateModelVersionAlias", {
      version: v, aliases,
      metalake: metalake?.name, catalog: selectedCatalog?.name,
      schema: selectedSchema?.name, model: selectedModel?.name, versionId,
    });
    toast(`Aliases обновлены`, "success");
  };

  // Schema/Table associate (tag/policy) + setOwner.
  const handleEntityAssociate = (entityType, entity, type, names) => {
    if (!entity) return;
    const intentId = type === "tags" ? "associateTags" : "associatePoliciesForObject";
    const moTypeMap = { schemas: "schema", tables: "table" };
    exec(intentId, {
      entity, entityType, [type]: names,
      metalake: metalake?.name,
      metadataObjectType: moTypeMap[entityType] || "schema",
      metadataObjectFullName: entity.name,
    });
    const kind = entityType === "schemas" ? "Schema" : "Table";
    toast(`${kind} ${type === "tags" ? "tag" : "policy"} обновлён`, "success");
  };

  const handleSchemaSetOwner = (schemaOwnerDialogTarget) => ({ name }) => {
    if (!schemaOwnerDialogTarget) return;
    const s = (world.schemas || []).find(x => x.id === schemaOwnerDialogTarget);
    if (!s) return;
    exec("setOwner", {
      entity: s, entityType: "schemas", newOwnerName: name,
      metalake: metalake?.name, metadataObjectType: "schema", metadataObjectFullName: s.name,
    });
    toast(`Schema owner назначен: ${name}`, "success");
    setSchemaOwnerDialogTarget(null);
  };

  const handleTableSetOwner = (tableOwnerDialogTarget) => ({ name }) => {
    if (!tableOwnerDialogTarget) return;
    const t = (world.tables || []).find(x => x.id === tableOwnerDialogTarget);
    if (!t) return;
    exec("setOwner", {
      entity: t, entityType: "tables", newOwnerName: name,
      metalake: metalake?.name, metadataObjectType: "table", metadataObjectFullName: t.name,
    });
    toast(`Table owner назначен: ${name}`, "success");
    setTableOwnerDialogTarget(null);
  };

  return {
    handleCreate, onAssociate, handleSetOwner, handleConfirmDelete,
    handleToggleEnabled, handleLinkVersion, handleUnlinkVersion, handleEditAliases,
    handleEntityAssociate, handleSchemaSetOwner, handleTableSetOwner,
  };
}
