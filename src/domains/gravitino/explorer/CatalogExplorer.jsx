/**
 * CatalogExplorer — split-pane root для metalake_workspace (U2.1 + U2.5 + U4).
 *
 * Структура (паритет gravitino/web-v2 /catalogs):
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ Breadcrumb: Metalakes › <metalake> [› <catalog> [› <schema>  │
 *   │                                       [› <table>]]]          │
 *   ├─────────────────┬────────────────────────────────────────────┤
 *   │ CatalogTree     │ Right pane:                                │
 *   │ (tabs + search) │   - default        → CatalogsTable         │
 *   │                 │   - schema selected → SchemaDetailPane     │
 *   │                 │   - table  selected → TableDetailPane      │
 *   └─────────────────┴────────────────────────────────────────────┘
 *
 * Регистрируется как canvas через registerCanvas("metalake_workspace", ...)
 * в standalone.jsx. ArchetypeCanvas передаёт props { artifact, ctx, world,
 * exec, viewer } — `routeParams` живут на `ctx.routeParams`.
 *
 * Тесты могут передавать `routeParams` напрямую top-level — поддерживаем оба
 * варианта через fallback `routeParams ?? ctx?.routeParams ?? {}`.
 *
 * U2.5: optimistic UI-state для tags/policies assignments per catalog.
 * U3:   optimistic created catalogs (без backend exec).
 * U4:   schema/table click в tree свапает правую панель на detail-pane.
 */
import { useMemo, useState } from "react";
import CatalogTree from "./CatalogTree.jsx";
import CatalogsTable from "./CatalogsTable.jsx";
import CreateCatalogDialog from "./CreateCatalogDialog.jsx";
import SchemaDetailPane from "./SchemaDetailPane.jsx";
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
  // U2.5: optimistic UI-state для tags/policies assignments per catalog.
  const [assignments, setAssignments] = useState({}); // { catalogId: { tags, policies } }

  // U3: optimistic created catalogs (без backend exec — реальный intent createCatalog в U3.5).
  const [creating, setCreating] = useState(false);
  const [createdCatalogs, setCreatedCatalogs] = useState([]);

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
    if (!a) return cat;
    return { ...cat, tags: a.tags ?? cat.tags, policies: a.policies ?? cat.policies };
  };

  const onAssociate = (catalogId, type, names) => {
    setAssignments(prev => ({
      ...prev,
      [catalogId]: { ...(prev[catalogId] || {}), [type]: names },
    }));
  };

  // U4: при клике в tree разруливаем kind узла по world-коллекциям.
  // Catalog → reset schema/table; schema → reset table + auto-set parent catalog;
  // table → auto-set parent schema + parent catalog. Filesets/topics/models —
  // dedicated detail panes в U6, пока tree-click игнорируется (no crash).
  const handleTreeSelect = (node) => {
    if (!node) return;
    if (myCatalogsAll.some(c => c.id === node.id)) {
      setSelectedCatalog(node);
      setSelectedSchema(null);
      setSelectedTable(null);
      return;
    }
    if ((world.schemas || []).some(s => s.id === node.id)) {
      setSelectedSchema(node);
      setSelectedTable(null);
      const parentCat = myCatalogsAll.find(c => c.id === node.catalogId);
      if (parentCat) setSelectedCatalog(parentCat);
      return;
    }
    if ((world.tables || []).some(t => t.id === node.id)) {
      setSelectedTable(node);
      const parentSch = (world.schemas || []).find(s => s.id === node.schemaId);
      if (parentSch) {
        setSelectedSchema(parentSch);
        const parentCat = myCatalogsAll.find(c => c.id === parentSch.catalogId);
        if (parentCat) setSelectedCatalog(parentCat);
      }
      return;
    }
    // filesets/topics/models — без dedicated detail (U6).
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
          onSelect={(cat) => { setSelectedCatalog(cat); setSelectedSchema(null); setSelectedTable(null); }}
          onAssociate={onAssociate}
          onCreate={() => setCreating(true)}
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
        onMetalakeClick={() => { setSelectedCatalog(null); setSelectedSchema(null); setSelectedTable(null); }}
        onCatalogClick={() => { setSelectedSchema(null); setSelectedTable(null); }}
        onSchemaClick={() => { setSelectedTable(null); }}
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
    </div>
  );
}

function Breadcrumb({ metalake, catalog, schema, table, onMetalakeClick, onCatalogClick, onSchemaClick }) {
  const items = [
    { label: "Metalakes", href: "/gravitino/metalake_list" },
    { label: metalake.name, onClick: onMetalakeClick, active: !catalog },
    ...(catalog ? [{ label: catalog.name, onClick: onCatalogClick, active: !schema }] : []),
    ...(schema  ? [{ label: schema.name,  onClick: onSchemaClick,  active: !table  }] : []),
    ...(table   ? [{ label: table.name,   active: true }] : []),
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
