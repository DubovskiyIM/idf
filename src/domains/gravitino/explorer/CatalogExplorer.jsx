/**
 * CatalogExplorer — split-pane root для metalake_workspace.
 * Breadcrumb › CatalogTree │ Right pane (CatalogsTable / *DetailPane).
 * Optimistic UI-state без backend exec (реальные intents в U*.5):
 * U2.5 tags/policies, U3 created, U5 owner, U6.1 ModelVersions,
 * U-polish-1 deletedIds + ToastProvider.
 */
import { useMemo, useState } from "react";
import Breadcrumb from "./Breadcrumb.jsx";
import CatalogTree from "./CatalogTree.jsx";
import CatalogsTable from "./CatalogsTable.jsx";
import ContextNav from "./ContextNav.jsx";
import ExplorerDialogs from "./ExplorerDialogs.jsx";
import FilesetDetailPane from "./FilesetDetailPane.jsx";
import FunctionDetailPane from "./FunctionDetailPane.jsx";
import ModelDetailPane from "./ModelDetailPane.jsx";
import SchemaDetailPane from "./SchemaDetailPane.jsx";
import TableDetailPane from "./TableDetailPane.jsx";
import { ToastProvider, useToast } from "./Toast.jsx";
import TopicDetailPane from "./TopicDetailPane.jsx";
import { useEntityOverrides } from "./useEntityOverrides.js";
import { useModelVersionOverrides } from "./useModelVersionOverrides.js";
import { makeTreeSelectHandler } from "./useTreeSelection.js";

export default function CatalogExplorer(props) {
  // ToastProvider оборачивает всё дерево, чтобы useToast() работал в children.
  return (
    <ToastProvider>
      <CatalogExplorerInner {...props} />
    </ToastProvider>
  );
}

function CatalogExplorerInner({ world = {}, routeParams, ctx }) {
  const toast = useToast();
  const params = routeParams ?? ctx?.routeParams ?? {};
  const metalakeId = params.metalakeId;
  const metalake = (world.metalakes || []).find(m => m.id === metalakeId);
  const allCatalogs = world.catalogs || [];
  const myCatalogs = allCatalogs.filter(c => c.metalakeId === metalakeId);
  const availableTags = world.tags || [];
  const availablePolicies = world.policies || [];

  const [selectedCatalog, setSelectedCatalog] = useState(null);
  const [selectedSchema, setSelectedSchema] = useState(null);
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedFileset, setSelectedFileset] = useState(null);
  const [selectedFunction, setSelectedFunction] = useState(null);
  const [selectedTopic, setSelectedTopic] = useState(null);
  // U6.1 + U-detail-polish: optimistic ModelVersion link / unlink / aliases-edit
  // (backend exec в U6.5 — здесь только client-state через хук).
  const [linkingForModel, setLinkingForModel] = useState(null);
  const versionOv = useModelVersionOverrides();
  // U2.5: optimistic UI-state для tags/policies assignments per catalog.
  const [assignments, setAssignments] = useState({});

  // U3: optimistic created catalogs.
  const [creating, setCreating] = useState(false);
  const [createdCatalogs, setCreatedCatalogs] = useState([]);

  // U5: optimistic owner overrides.
  const [ownerDialogTarget, setOwnerDialogTarget] = useState(null);
  const [ownerOverrides, setOwnerOverrides] = useState({});

  // U-polish-1: Delete-confirm + optimistic delete (без backend exec — реальный
  // intent dropCatalog в U6.5 batch).
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletedIds, setDeletedIds] = useState(new Set());

  // U-polish-3: optimistic enabled overrides (In-Use toggle, C3).
  const [enabledOverrides, setEnabledOverrides] = useState({});

  // U6.3: schema/table-level owner + assignments через общий хук.
  const schemaOv = useEntityOverrides();
  const tableOv = useEntityOverrides();
  const [schemaOwnerDialogTarget, setSchemaOwnerDialogTarget] = useState(null);
  const [tableOwnerDialogTarget, setTableOwnerDialogTarget] = useState(null);

  const handleCreate = (formData) => {
    const newCatalog = {
      id: `c_new_${Date.now()}`,
      name: formData.name, type: formData.type, provider: formData.provider,
      comment: formData.comment, properties: formData.properties,
      metalakeId, tags: [], policies: [],
    };
    setCreatedCatalogs(prev => [...prev, newCatalog]);
    setCreating(false);
    toast(`Catalog «${formData.name}» создан`, "success");
  };

  const myCatalogsAll = useMemo(
    () => [...myCatalogs, ...createdCatalogs.filter(c => c.metalakeId === metalakeId)]
      .filter(c => !deletedIds.has(c.id)),
    [myCatalogs, createdCatalogs, metalakeId, deletedIds]
  );

  const applyAssignments = (cat) => {
    const a = assignments[cat.id];
    const ownerOv = ownerOverrides[cat.id];
    const enabledOv = enabledOverrides[cat.id];
    let next = cat;
    if (a) next = { ...next, tags: a.tags ?? next.tags, policies: a.policies ?? next.policies };
    if (ownerOv !== undefined) next = { ...next, owner: ownerOv };
    if (enabledOv !== undefined) next = { ...next, enabled: enabledOv };
    return next;
  };

  const onAssociate = (catalogId, type, names) => {
    setAssignments(prev => ({
      ...prev,
      [catalogId]: { ...(prev[catalogId] || {}), [type]: names },
    }));
    const catName = myCatalogsAll.find(c => c.id === catalogId)?.name || catalogId;
    toast(`${type === "tags" ? "Tag" : "Policy"} обновлён для ${catName}`, "success");
  };

  const handleSetOwner = ({ kind, name }) => {
    if (!ownerDialogTarget) return;
    setOwnerOverrides(prev => ({ ...prev, [ownerDialogTarget]: name }));
    setOwnerDialogTarget(null);
    toast(`Owner назначен: ${name}`, "success");
  };

  const handleConfirmDelete = () => {
    const target = deleteTarget;
    if (!target) return;
    setDeletedIds(prev => { const next = new Set(prev); next.add(target.id); return next; });
    if (selectedCatalog?.id === target.id) {
      setSelectedCatalog(null); setSelectedSchema(null); resetLeaves();
    }
    toast(`Catalog «${target.name}» удалён`, "error");
    setDeleteTarget(null);
  };

  // Вычисляет следующий version-номер для linkModelVersion (max+1 по существующим
  // backend versions + optimistically linked).
  const suggestedVersion = linkingForModel
    ? Math.max(
        0,
        ...((world.model_versions || []).filter(v => v.modelId === linkingForModel).map(v => v.version || 0)),
        ...versionOv.linkedVersions.filter(v => v.modelId === linkingForModel).map(v => v.version || 0),
      ) + 1
    : 1;

  const handleLinkVersion = ({ version, modelObject, aliases }) => {
    versionOv.link({
      id: `mv_new_${Date.now()}`, modelId: linkingForModel,
      version, modelObject, aliases, properties: {},
    });
    setLinkingForModel(null);
  };

  const handleToggleEnabled = (catalogId, next) => {
    setEnabledOverrides(prev => ({ ...prev, [catalogId]: next }));
    toast(`Catalog ${next ? "включён" : "приостановлен"}`, next ? "success" : "warning");
  };

  // Сбрасывает все leaf-selections (table/model/fileset/function/topic).
  const resetLeaves = () => {
    setSelectedTable(null); setSelectedModel(null);
    setSelectedFileset(null); setSelectedFunction(null); setSelectedTopic(null);
  };

  // U4 + U6.1 + U6.2: при клике в tree разруливаем kind узла по world-коллекциям.
  const handleTreeSelect = makeTreeSelectHandler({
    world, myCatalogsAll,
    setters: {
      setSelectedCatalog, setSelectedSchema,
      setSelectedTable, setSelectedModel,
      setSelectedFileset, setSelectedFunction, setSelectedTopic,
    },
    resetLeaves,
  });

  if (!metalake) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--idf-text-muted)", fontSize: 13 }}>
        Metalake не найден (metalakeId: {String(metalakeId)})
      </div>
    );
  }

  const renderRightPane = () => {
    if (selectedFunction) return <FunctionDetailPane function={selectedFunction} />;
    if (selectedTopic)    return <TopicDetailPane topic={selectedTopic} />;
    if (selectedFileset)  return <FilesetDetailPane fileset={selectedFileset} world={world} />;
    if (selectedModel) return (
      <ModelDetailPane
        model={selectedModel}
        world={{ ...world, model_versions: versionOv.applyTo(world.model_versions || []) }}
        onLinkVersion={() => setLinkingForModel(selectedModel.id)}
        onUnlinkVersion={(id) => { versionOv.unlink(id); toast(`Version unlinked`, "warning"); }}
        onEditAliases={(id, aliases) => { versionOv.editAliases(id, aliases); toast(`Aliases обновлены`, "success"); }}
      />
    );
    const assocFor = (kind, ov) => (id, type, names) => {
      ov.setAssoc(id, type, names);
      toast(`${kind} ${type === "tags" ? "tag" : "policy"} обновлён`, "success");
    };
    if (selectedTable) return (
      <TableDetailPane table={tableOv.apply(selectedTable)} world={world}
        onSetOwner={setTableOwnerDialogTarget} onAssociate={assocFor("Table", tableOv)} />
    );
    if (selectedSchema) return (
      <SchemaDetailPane schema={schemaOv.apply(selectedSchema)} catalog={selectedCatalog} world={world}
        onSetOwner={setSchemaOwnerDialogTarget} onAssociate={assocFor("Schema", schemaOv)} />
    );
    const visible = (selectedCatalog ? [selectedCatalog] : myCatalogsAll).map(applyAssignments);
    return (
      <div style={{ padding: 16, overflow: "auto", height: "100%", background: "var(--idf-card, #fff)" }}>
        <CatalogsTable
          catalogs={visible}
          availableTags={availableTags}
          availablePolicies={availablePolicies}
          onSelect={(cat) => { setSelectedCatalog(cat); setSelectedSchema(null); resetLeaves(); }}
          onAssociate={onAssociate}
          onCreate={() => setCreating(true)}
          onSetOwner={(catalogId) => setOwnerDialogTarget(catalogId)}
          onToggleEnabled={handleToggleEnabled}
          onDelete={(cat) => setDeleteTarget(cat)}
        />
      </div>
    );
  };

  // Navigate из ContextNav: window.location в соответствующий root.
  const handleContextNav = (target) => {
    if (typeof window !== "undefined") window.location.href = `/gravitino/${target}`;
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", minHeight: 0,
      background: "var(--idf-surface, #f8fafc)",
    }}>
      <ContextNav active="catalogs" onNavigate={handleContextNav} />
      <Breadcrumb
        metalake={metalake}
        catalog={selectedCatalog}
        schema={selectedSchema}
        table={selectedTable}
        model={selectedModel}
        fileset={selectedFileset}
        fn={selectedFunction}
        topic={selectedTopic}
        onMetalakeClick={() => { setSelectedCatalog(null); setSelectedSchema(null); resetLeaves(); }}
        onCatalogClick={() => { setSelectedSchema(null); resetLeaves(); }}
        onSchemaClick={() => { resetLeaves(); }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", flex: 1, minHeight: 0 }}>
        <CatalogTree
          catalogs={myCatalogsAll}
          world={world}
          metalakeId={metalakeId}
          onSelect={handleTreeSelect}
        />
        <div style={{ minHeight: 0, background: "var(--idf-card, #fff)" }}>
          {renderRightPane()}
        </div>
      </div>
      <ExplorerDialogs
        world={world}
        creating={creating}
        onCloseCreate={() => setCreating(false)}
        onSubmitCreate={handleCreate}
        ownerDialogTarget={ownerDialogTarget}
        ownerOverrides={ownerOverrides}
        myCatalogsAll={myCatalogsAll}
        onCloseOwnerDialog={() => setOwnerDialogTarget(null)}
        onSubmitOwner={handleSetOwner}
        schemaOwnerDialogTarget={schemaOwnerDialogTarget}
        schemaOv={schemaOv}
        onCloseSchemaOwner={() => setSchemaOwnerDialogTarget(null)}
        onSubmitSchemaOwner={({ name }) => { schemaOv.setOwner(schemaOwnerDialogTarget, name); toast(`Schema owner назначен: ${name}`, "success"); setSchemaOwnerDialogTarget(null); }}
        tableOwnerDialogTarget={tableOwnerDialogTarget}
        tableOv={tableOv}
        onCloseTableOwner={() => setTableOwnerDialogTarget(null)}
        onSubmitTableOwner={({ name }) => { tableOv.setOwner(tableOwnerDialogTarget, name); toast(`Table owner назначен: ${name}`, "success"); setTableOwnerDialogTarget(null); }}
        linkingForModel={linkingForModel}
        suggestedVersion={suggestedVersion}
        onCloseLinkVersion={() => setLinkingForModel(null)}
        onSubmitLinkVersion={handleLinkVersion}
        deleteTarget={deleteTarget}
        onCancelDelete={() => setDeleteTarget(null)}
        onConfirmDelete={handleConfirmDelete}
      />
    </div>
  );
}
