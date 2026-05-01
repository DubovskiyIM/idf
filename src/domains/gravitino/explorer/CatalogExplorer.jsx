/**
 * CatalogExplorer — split-pane root для metalake_workspace.
 *
 * Breadcrumb › CatalogTree │ Right pane (CatalogsTable / SchemaDetailPane /
 * TableDetailPane / ModelDetailPane). Регистрируется как canvas через
 * `registerCanvas("metalake_workspace", ...)`. `routeParams` приходят либо
 * top-level (тесты), либо на `ctx.routeParams` (ArchetypeCanvas).
 *
 * Optimistic UI-state (без backend exec — реальные intents в U*.5):
 *   U2.5 — tags/policies assignments per catalog;
 *   U3   — created catalogs;
 *   U5   — owner overrides;
 *   U6.1 — linked ModelVersions.
 */
import { useMemo, useState } from "react";
import CatalogTree from "./CatalogTree.jsx";
import CatalogsTable from "./CatalogsTable.jsx";
import CreateCatalogDialog from "./CreateCatalogDialog.jsx";
import LinkVersionDialog from "./LinkVersionDialog.jsx";
import ModelDetailPane from "./ModelDetailPane.jsx";
import SchemaDetailPane from "./SchemaDetailPane.jsx";
import SetOwnerDialog from "./SetOwnerDialog.jsx";
import TableDetailPane from "./TableDetailPane.jsx";

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
  // U6.1: optimistic ModelVersion-add (без backend exec — реальный intent linkModelVersion в U6.5).
  const [linkingForModel, setLinkingForModel] = useState(null); // model.id | null
  const [linkedVersions, setLinkedVersions] = useState([]); // optimistic-list
  // U2.5: optimistic UI-state для tags/policies assignments per catalog.
  const [assignments, setAssignments] = useState({}); // { catalogId: { tags, policies } }

  // U3: optimistic created catalogs (без backend exec — реальный intent createCatalog в U3.5).
  const [creating, setCreating] = useState(false);
  const [createdCatalogs, setCreatedCatalogs] = useState([]);

  // U5: optimistic owner overrides per catalog (без backend exec — реальный intent setCatalogOwner в U5b).
  const [ownerDialogTarget, setOwnerDialogTarget] = useState(null); // catalogId | null
  const [ownerOverrides, setOwnerOverrides] = useState({}); // { catalogId: ownerName }

  const handleCreate = (formData) => {
    const newCatalog = {
      id: `c_new_${Date.now()}`,
      name: formData.name,
      type: formData.type,
      provider: formData.provider,
      comment: formData.comment,
      properties: formData.properties,
      metalakeId,
      tags: [],
      policies: [],
    };
    setCreatedCatalogs(prev => [...prev, newCatalog]);
    setCreating(false);
  };

  // myCatalogsAll = seed (world) + optimistic created для текущего metalake.
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

  // U4 + U6.1: при клике в tree разруливаем kind узла по world-коллекциям.
  // Catalog → reset schema/table/model; schema → reset table/model + auto-set
  // parent catalog; table → auto-set parent schema + parent catalog; model →
  // ModelDetailPane + auto-set parent schema/catalog. Filesets/topics —
  // dedicated detail panes (U6.2+), пока tree-click игнорируется (no crash).
  const handleTreeSelect = (node) => {
    if (!node) return;
    if (myCatalogsAll.some(c => c.id === node.id)) {
      setSelectedCatalog(node);
      setSelectedSchema(null);
      setSelectedTable(null);
      setSelectedModel(null);
      return;
    }
    if ((world.schemas || []).some(s => s.id === node.id)) {
      setSelectedSchema(node);
      setSelectedTable(null);
      setSelectedModel(null);
      const parentCat = myCatalogsAll.find(c => c.id === node.catalogId);
      if (parentCat) setSelectedCatalog(parentCat);
      return;
    }
    if ((world.tables || []).some(t => t.id === node.id)) {
      setSelectedTable(node);
      setSelectedModel(null);
      const parentSch = (world.schemas || []).find(s => s.id === node.schemaId);
      if (parentSch) {
        setSelectedSchema(parentSch);
        const parentCat = myCatalogsAll.find(c => c.id === parentSch.catalogId);
        if (parentCat) setSelectedCatalog(parentCat);
      }
      return;
    }
    if ((world.models || []).some(m => m.id === node.id)) {
      setSelectedModel(node);
      setSelectedTable(null);
      const parentSch = (world.schemas || []).find(s => s.id === node.schemaId);
      if (parentSch) {
        setSelectedSchema(parentSch);
        const parentCat = myCatalogsAll.find(c => c.id === parentSch.catalogId);
        if (parentCat) setSelectedCatalog(parentCat);
      }
      return;
    }
    // filesets/topics — без dedicated detail (U6.2+).
  };

  if (!metalake) {
    return (
      <div style={{
        padding: 40, textAlign: "center",
        color: "var(--idf-text-muted)", fontSize: 13,
      }}>
        Metalake не найден (metalakeId: {String(metalakeId)})
      </div>
    );
  }

  const renderRightPane = () => {
    if (selectedModel) {
      // Сливаем seed-versions с optimistic-добавленными.
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
    if (selectedTable) {
      return <TableDetailPane table={selectedTable} />;
    }
    if (selectedSchema) {
      return <SchemaDetailPane schema={selectedSchema} catalog={selectedCatalog} world={world} />;
    }
    const visible = (selectedCatalog ? [selectedCatalog] : myCatalogsAll).map(applyAssignments);
    return (
      <div style={{ padding: 16, overflow: "auto", height: "100%", background: "var(--idf-card, #fff)" }}>
        <CatalogsTable
          catalogs={visible}
          availableTags={availableTags}
          availablePolicies={availablePolicies}
          onSelect={(cat) => { setSelectedCatalog(cat); setSelectedSchema(null); setSelectedTable(null); setSelectedModel(null); }}
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
        onMetalakeClick={() => { setSelectedCatalog(null); setSelectedSchema(null); setSelectedTable(null); setSelectedModel(null); }}
        onCatalogClick={() => { setSelectedSchema(null); setSelectedTable(null); setSelectedModel(null); }}
        onSchemaClick={() => { setSelectedTable(null); setSelectedModel(null); }}
      />
      <div style={{
        display: "grid", gridTemplateColumns: "260px 1fr",
        flex: 1, minHeight: 0,
      }}>
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

function Breadcrumb({ metalake, catalog, schema, table, model, onMetalakeClick, onCatalogClick, onSchemaClick }) {
  const items = [
    { label: "Metalakes", href: "/gravitino/metalake_list" },
    { label: metalake.name, onClick: onMetalakeClick, active: !catalog },
    ...(catalog ? [{ label: catalog.name, onClick: onCatalogClick, active: !schema }] : []),
    ...(schema  ? [{ label: schema.name,  onClick: onSchemaClick,  active: !table && !model }] : []),
    ...(table   ? [{ label: table.name,   active: true }] : []),
    ...(model && !table ? [{ label: model.name, active: true }] : []),
  ];
  return (
    <nav aria-label="breadcrumb" style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "10px 16px", fontSize: 12,
      background: "var(--idf-card, #fff)",
      borderBottom: "1px solid var(--idf-border, #e5e7eb)",
      color: "var(--idf-text-muted)",
    }}>
      {items.map((it, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span>›</span>}
          {it.href ? (
            <a href={it.href} style={{ color: "var(--idf-text-muted)", textDecoration: "none" }}>{it.label}</a>
          ) : it.onClick ? (
            <button type="button" onClick={it.onClick} style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              color: it.active ? "var(--idf-text)" : "var(--idf-text-muted)",
              fontWeight: it.active ? 500 : 400, fontSize: 12,
            }}>{it.label}</button>
          ) : (
            <span style={{ color: "var(--idf-text)", fontWeight: 500 }}>{it.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
