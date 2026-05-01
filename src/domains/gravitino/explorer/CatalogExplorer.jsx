/**
 * CatalogExplorer — split-pane root для metalake_workspace.
 *
 * Breadcrumb › CatalogTree │ Right pane (CatalogsTable / SchemaDetailPane /
 * TableDetailPane / ModelDetailPane / FilesetDetailPane / FunctionDetailPane /
 * TopicDetailPane). Регистрируется как canvas через
 * `registerCanvas("metalake_workspace", ...)`. `routeParams` приходят либо
 * top-level (тесты), либо на `ctx.routeParams` (ArchetypeCanvas).
 *
 * Optimistic UI-state (без backend exec — реальные intents в U*.5):
 *   U2.5 — tags/policies assignments per catalog;
 *   U3   — created catalogs;
 *   U5   — owner overrides;
 *   U6.1 — linked ModelVersions;
 *   U6.2 — fileset/function/topic — read-only display, optimistic-state не нужен.
 */
import { useMemo, useState } from "react";
import Breadcrumb from "./Breadcrumb.jsx";
import CatalogTree from "./CatalogTree.jsx";
import CatalogsTable from "./CatalogsTable.jsx";
import CreateCatalogDialog from "./CreateCatalogDialog.jsx";
import FilesetDetailPane from "./FilesetDetailPane.jsx";
import FunctionDetailPane from "./FunctionDetailPane.jsx";
import LinkVersionDialog from "./LinkVersionDialog.jsx";
import ModelDetailPane from "./ModelDetailPane.jsx";
import SchemaDetailPane from "./SchemaDetailPane.jsx";
import SetOwnerDialog from "./SetOwnerDialog.jsx";
import TableDetailPane from "./TableDetailPane.jsx";
import TopicDetailPane from "./TopicDetailPane.jsx";

export default function CatalogExplorer({ world = {}, routeParams, ctx }) {
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
  // U6.1: optimistic ModelVersion-add (без backend exec — реальный intent linkModelVersion в U6.5).
  const [linkingForModel, setLinkingForModel] = useState(null);
  const [linkedVersions, setLinkedVersions] = useState([]);
  // U2.5: optimistic UI-state для tags/policies assignments per catalog.
  const [assignments, setAssignments] = useState({});

  // U3: optimistic created catalogs.
  const [creating, setCreating] = useState(false);
  const [createdCatalogs, setCreatedCatalogs] = useState([]);

  // U5: optimistic owner overrides.
  const [ownerDialogTarget, setOwnerDialogTarget] = useState(null);
  const [ownerOverrides, setOwnerOverrides] = useState({});

  const handleCreate = (formData) => {
    const newCatalog = {
      id: `c_new_${Date.now()}`,
      name: formData.name, type: formData.type, provider: formData.provider,
      comment: formData.comment, properties: formData.properties,
      metalakeId, tags: [], policies: [],
    };
    setCreatedCatalogs(prev => [...prev, newCatalog]);
    setCreating(false);
  };

  const myCatalogsAll = useMemo(
    () => [...myCatalogs, ...createdCatalogs.filter(c => c.metalakeId === metalakeId)],
    [myCatalogs, createdCatalogs, metalakeId]
  );

  const applyAssignments = (cat) => {
    const a = assignments[cat.id];
    const ownerOv = ownerOverrides[cat.id];
    let next = cat;
    if (a) next = { ...next, tags: a.tags ?? next.tags, policies: a.policies ?? next.policies };
    if (ownerOv !== undefined) next = { ...next, owner: ownerOv };
    return next;
  };

  const onAssociate = (catalogId, type, names) => {
    setAssignments(prev => ({
      ...prev,
      [catalogId]: { ...(prev[catalogId] || {}), [type]: names },
    }));
  };

  const handleSetOwner = ({ kind, name }) => {
    if (!ownerDialogTarget) return;
    setOwnerOverrides(prev => ({ ...prev, [ownerDialogTarget]: name }));
    setOwnerDialogTarget(null);
  };

  // Сбрасывает все leaf-selections (table/model/fileset/function/topic).
  const resetLeaves = () => {
    setSelectedTable(null); setSelectedModel(null);
    setSelectedFileset(null); setSelectedFunction(null); setSelectedTopic(null);
  };

  // Walk schema → catalog для leaf-узлов (U6.2: fileset/function в добавление к table/model).
  const walkToCatalog = (schemaId) => {
    const parentSch = (world.schemas || []).find(s => s.id === schemaId);
    if (parentSch) {
      setSelectedSchema(parentSch);
      const parentCat = myCatalogsAll.find(c => c.id === parentSch.catalogId);
      if (parentCat) setSelectedCatalog(parentCat);
    }
  };

  // U4 + U6.1 + U6.2: при клике в tree разруливаем kind узла по world-коллекциям.
  const handleTreeSelect = (node) => {
    if (!node) return;
    if (myCatalogsAll.some(c => c.id === node.id)) {
      setSelectedCatalog(node); setSelectedSchema(null); resetLeaves(); return;
    }
    if ((world.schemas || []).some(s => s.id === node.id)) {
      setSelectedSchema(node); resetLeaves();
      const parentCat = myCatalogsAll.find(c => c.id === node.catalogId);
      if (parentCat) setSelectedCatalog(parentCat);
      return;
    }
    if ((world.tables || []).some(t => t.id === node.id)) {
      resetLeaves(); setSelectedTable(node); walkToCatalog(node.schemaId); return;
    }
    if ((world.models || []).some(m => m.id === node.id)) {
      resetLeaves(); setSelectedModel(node); walkToCatalog(node.schemaId); return;
    }
    if ((world.filesets || []).some(f => f.id === node.id)) {
      resetLeaves(); setSelectedFileset(node); walkToCatalog(node.schemaId); return;
    }
    if ((world.functions || []).some(fn => fn.id === node.id)) {
      resetLeaves(); setSelectedFunction(node); walkToCatalog(node.schemaId); return;
    }
    if ((world.topics || []).some(t => t.id === node.id)) {
      resetLeaves(); setSelectedTopic(node);
      // topic в seed имеет schemaId; CatalogTree.getCatalogChildren фильтрует
      // topics по catalogId (legacy quirk). Walk через schema если есть.
      if (node.schemaId) walkToCatalog(node.schemaId);
      else if (node.catalogId) {
        const parentCat = myCatalogsAll.find(c => c.id === node.catalogId);
        if (parentCat) { setSelectedCatalog(parentCat); setSelectedSchema(null); }
      }
      return;
    }
  };

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
    if (selectedModel) {
      const mergedWorld = {
        ...world,
        model_versions: [...(world.model_versions || []), ...linkedVersions],
      };
      return (
        <ModelDetailPane
          model={selectedModel}
          world={mergedWorld}
          onLinkVersion={() => setLinkingForModel(selectedModel.id)}
        />
      );
    }
    if (selectedTable)  return <TableDetailPane table={selectedTable} />;
    if (selectedSchema) return <SchemaDetailPane schema={selectedSchema} catalog={selectedCatalog} world={world} />;
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
        />
      </div>
    );
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", minHeight: 0,
      background: "var(--idf-surface, #f8fafc)",
    }}>
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
      <CreateCatalogDialog
        visible={creating}
        onClose={() => setCreating(false)}
        onSubmit={handleCreate}
      />
      <SetOwnerDialog
        visible={!!ownerDialogTarget}
        currentOwner={ownerDialogTarget && (
          ownerOverrides[ownerDialogTarget]
          ?? myCatalogsAll.find(c => c.id === ownerDialogTarget)?.owner
        )}
        users={world.users || []}
        groups={world.groups || []}
        onClose={() => setOwnerDialogTarget(null)}
        onSubmit={handleSetOwner}
      />
      <LinkVersionDialog
        visible={!!linkingForModel}
        suggestedVersion={
          linkingForModel
            ? Math.max(
                0,
                ...((world.model_versions || []).filter(v => v.modelId === linkingForModel).map(v => v.version || 0)),
                ...linkedVersions.filter(v => v.modelId === linkingForModel).map(v => v.version || 0),
              ) + 1
            : 1
        }
        onClose={() => setLinkingForModel(null)}
        onSubmit={({ version, modelObject, aliases }) => {
          setLinkedVersions(prev => [...prev, {
            id: `mv_new_${Date.now()}`,
            modelId: linkingForModel,
            version, modelObject, aliases, properties: {},
          }]);
          setLinkingForModel(null);
        }}
      />
    </div>
  );
}
