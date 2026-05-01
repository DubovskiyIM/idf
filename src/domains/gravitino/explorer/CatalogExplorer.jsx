/**
 * CatalogExplorer — split-pane root для metalake_workspace.
 * Breadcrumb › CatalogTree │ Right pane (CatalogsTable / *DetailPane).
 *
 * U-backend-exec: createCatalog / dropCatalog через реальный exec. Generic
 * effect handler применяет particles.effects (Catalog op=replace|remove) —
 * fold обновляет world.catalogs.
 *
 * U-backend-exec-2: все modify-nested операции через exec — custom
 * buildEffects в gravitino/domain.js собирает full-entity overwrite
 * (α:'add' с тем же id) на pluralized lower target. Локальные
 * assignments / ownerOverrides / enabledOverrides / schemaOv / tableOv /
 * versionOv удалены — display прямо из world.{catalogs,schemas,tables,
 * model_versions}; fold обновляет мир после exec. Handlers вынесены в
 * useCatalogExplorerHandlers ради LOC-budget'а.
 */
import { useState } from "react";
import Breadcrumb from "./Breadcrumb.jsx";
import CatalogTree from "./CatalogTree.jsx";
import CatalogsTable from "./CatalogsTable.jsx";
import ExplorerDialogs from "./ExplorerDialogs.jsx";
import FilesetDetailPane from "./FilesetDetailPane.jsx";
import FunctionDetailPane from "./FunctionDetailPane.jsx";
import ModelDetailPane from "./ModelDetailPane.jsx";
import SchemaDetailPane from "./SchemaDetailPane.jsx";
import TableDetailPane from "./TableDetailPane.jsx";
import { ToastProvider, useToast } from "./Toast.jsx";
import TopicDetailPane from "./TopicDetailPane.jsx";
import { useCatalogExplorerHandlers } from "./useCatalogExplorerHandlers.js";
import { makeTreeSelectHandler } from "./useTreeSelection.js";

export default function CatalogExplorer(props) {
  // ToastProvider оборачивает всё дерево, чтобы useToast() работал в children.
  return (
    <ToastProvider>
      <CatalogExplorerInner {...props} />
    </ToastProvider>
  );
}

function CatalogExplorerInner({ world = {}, routeParams, ctx, exec = () => {}, viewer }) {
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
  const [linkingForModel, setLinkingForModel] = useState(null);
  const [creating, setCreating] = useState(false);
  const [ownerDialogTarget, setOwnerDialogTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [schemaOwnerDialogTarget, setSchemaOwnerDialogTarget] = useState(null);
  const [tableOwnerDialogTarget, setTableOwnerDialogTarget] = useState(null);
  const [editTableTarget, setEditTableTarget] = useState(null);

  const resetLeaves = () => {
    setSelectedTable(null); setSelectedModel(null);
    setSelectedFileset(null); setSelectedFunction(null); setSelectedTopic(null);
  };

  const h = useCatalogExplorerHandlers({
    world, metalake, viewer, exec, toast,
    selectedCatalog, selectedSchema, selectedModel,
    setCreating, setOwnerDialogTarget, setSchemaOwnerDialogTarget,
    setTableOwnerDialogTarget, setLinkingForModel, setDeleteTarget,
    setSelectedCatalog, setSelectedSchema, resetLeaves,
  });

  // suggestedVersion — max+1 по существующим backend versions.
  const suggestedVersion = linkingForModel
    ? Math.max(0, ...((world.model_versions || []).filter(v => v.modelId === linkingForModel).map(v => v.version || 0))) + 1
    : 1;

  const handleTreeSelect = makeTreeSelectHandler({
    world, myCatalogsAll: myCatalogs,
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
        model={selectedModel} world={world}
        onLinkVersion={() => setLinkingForModel(selectedModel.id)}
        onUnlinkVersion={h.handleUnlinkVersion}
        onEditAliases={h.handleEditAliases}
      />
    );
    if (selectedTable) return (
      <TableDetailPane table={selectedTable} world={world}
        onSetOwner={setTableOwnerDialogTarget}
        onAssociate={(_id, type, names) => h.handleEntityAssociate("tables", selectedTable, type, names)}
        onEdit={() => setEditTableTarget(selectedTable)} />
    );
    if (selectedSchema) return (
      <SchemaDetailPane
        schema={selectedSchema}
        catalog={selectedCatalog}
        world={world}
        onSetOwner={setSchemaOwnerDialogTarget}
        onAssociate={(_id, type, names) => h.handleEntityAssociate("schemas", selectedSchema, type, names)}
        // U-fix-toggle-tabs: child-tables (Tables/Filesets/Models) callbacks.
        // Edit — out of scope для всех kind'ов (нет EditDialog); toast
        // placeholder. SetOwner для tables reuse dialog; для filesets/models
        // нет dialog'ов — toast. Delete → exec(dropTable / dropFileset /
        // deleteModel). Associate — reuse handleEntityAssociate для tables;
        // для filesets/models — toast (associate intent есть, но без UI flow).
        onChildEdit={(item, kind) => {
          toast(`Edit ${kind} «${item.name}» — out of scope для текущего sprint'а`, "info");
        }}
        onChildSetOwner={(item, kind) => {
          if (kind === "tables") setTableOwnerDialogTarget(item.id);
          else toast(`Set Owner для ${kind} — out of scope`, "info");
        }}
        onChildDelete={(item, kind) => {
          const intentByKind = { tables: "dropTable", filesets: "dropFileset", models: "deleteModel" };
          const paramKey = { tables: "table", filesets: "fileset", models: "model" }[kind];
          const intentId = intentByKind[kind];
          if (!intentId || !paramKey) return;
          // U-fix-exec-signature: exec(intentId, flatCtx).
          exec(intentId, {
            metalake: metalake?.name,
            catalog: selectedCatalog?.name,
            schema: selectedSchema?.name,
            [paramKey]: item.name,
          });
          toast(`${kind} «${item.name}» удалён`, "error");
        }}
        onChildAssociate={(itemId, type, names, kind) => {
          if (kind === "tables") {
            const t = (world.tables || []).find(x => x.id === itemId);
            if (!t) return;
            h.handleEntityAssociate("tables", t, type, names);
          } else {
            toast(`Associate ${type} для ${kind} — out of scope`, "info");
          }
        }}
      />
    );
    const visible = selectedCatalog ? [selectedCatalog] : myCatalogs;
    return (
      <div style={{ padding: 16, overflow: "auto", height: "100%", background: "var(--idf-card, #fff)" }}>
        <CatalogsTable
          catalogs={visible}
          availableTags={availableTags}
          availablePolicies={availablePolicies}
          onSelect={(cat) => { setSelectedCatalog(cat); setSelectedSchema(null); resetLeaves(); }}
          onAssociate={h.onAssociate}
          onCreate={() => setCreating(true)}
          onSetOwner={(catalogId) => setOwnerDialogTarget(catalogId)}
          onToggleEnabled={h.handleToggleEnabled}
          onDelete={(cat) => setDeleteTarget(cat)}
        />
      </div>
    );
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", minHeight: 0,
      background: "var(--idf-surface, #f8fafc)",
    }}>
      {/* ContextNav (U-context-nav) удалён — V2Shell уже рендерит outer top-nav
          (Metalakes / Jobs / Access / Data Compliance), inner strip создавал
          дубль навигации. */}
      <Breadcrumb
        metalake={metalake} catalog={selectedCatalog} schema={selectedSchema}
        table={selectedTable} model={selectedModel} fileset={selectedFileset}
        fn={selectedFunction} topic={selectedTopic}
        onMetalakeClick={() => { setSelectedCatalog(null); setSelectedSchema(null); resetLeaves(); }}
        onCatalogClick={() => { setSelectedSchema(null); resetLeaves(); }}
        onSchemaClick={() => { resetLeaves(); }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", flex: 1, minHeight: 0 }}>
        <CatalogTree
          catalogs={myCatalogs} world={world} metalakeId={metalakeId}
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
        onSubmitCreate={h.handleCreate}
        ownerDialogTarget={ownerDialogTarget}
        myCatalogsAll={myCatalogs}
        onCloseOwnerDialog={() => setOwnerDialogTarget(null)}
        onSubmitOwner={h.handleSetOwner(ownerDialogTarget)}
        schemaOwnerDialogTarget={schemaOwnerDialogTarget}
        onCloseSchemaOwner={() => setSchemaOwnerDialogTarget(null)}
        onSubmitSchemaOwner={h.handleSchemaSetOwner(schemaOwnerDialogTarget)}
        tableOwnerDialogTarget={tableOwnerDialogTarget}
        onCloseTableOwner={() => setTableOwnerDialogTarget(null)}
        onSubmitTableOwner={h.handleTableSetOwner(tableOwnerDialogTarget)}
        linkingForModel={linkingForModel}
        suggestedVersion={suggestedVersion}
        onCloseLinkVersion={() => setLinkingForModel(null)}
        onSubmitLinkVersion={h.handleLinkVersion(linkingForModel)}
        deleteTarget={deleteTarget}
        onCancelDelete={() => setDeleteTarget(null)}
        onConfirmDelete={h.handleConfirmDelete(deleteTarget)}
        editTableTarget={editTableTarget}
        onCloseEditTable={() => setEditTableTarget(null)}
        onSubmitEditTable={(payload) => {
          // alterTable — gravitino/domain.js делает full-payload replace by id
          // через α:'add' (preserved partitioning / distribution / sortOrders /
          // properties pass-through из initial). entity = editTableTarget,
          // pickOverrides() применит остальные authorial поля; raw URL params
          // (metalake / catalog / schema / table) отбрасываются.
          exec("alterTable", {
            entity: editTableTarget,
            ...payload,
            audit: payload.audit || { creator: viewer?.name || "ui", createTime: new Date().toISOString() },
            metalake: metalake?.name,
            catalog: selectedCatalog?.name,
            schema: selectedSchema?.name,
            table: payload.name,
          });
          toast(`Table «${payload.name}» обновлена`, "success");
          setEditTableTarget(null);
        }}
      />
    </div>
  );
}
