/**
 * CatalogExplorer — split-pane root для metalake_workspace (U2.1).
 *
 * Структура (паритет gravitino/web-v2 /catalogs):
 *   ┌──────────────────────────────────────────────────────────────┐
 *   │ Breadcrumb: Metalakes › <metalake.name> [› <catalog.name>]   │
 *   ├─────────────────┬────────────────────────────────────────────┤
 *   │ CatalogTree     │ CatalogsTable (default) или catalog detail │
 *   │ (tabs + search) │                                            │
 *   └─────────────────┴────────────────────────────────────────────┘
 *
 * Регистрируется как canvas через registerCanvas("metalake_workspace", ...)
 * в standalone.jsx. ArchetypeCanvas передаёт props { artifact, ctx, world,
 * exec, viewer } — `routeParams` живут на `ctx.routeParams` (паттерн
 * идентичен notion BlockCanvas, см. src/domains/notion/canvas/BlockCanvas.jsx).
 *
 * Тесты могут передавать `routeParams` напрямую top-level — поддерживаем оба
 * варианта через fallback `routeParams ?? ctx?.routeParams ?? {}`.
 */
import { useState } from "react";
import CatalogTree from "./CatalogTree.jsx";
import CatalogsTable from "./CatalogsTable.jsx";

export default function CatalogExplorer({ world = {}, routeParams, ctx }) {
  const params = routeParams ?? ctx?.routeParams ?? {};
  const metalakeId = params.metalakeId;
  const metalake = (world.metalakes || []).find(m => m.id === metalakeId);
  const allCatalogs = world.catalogs || [];
  const myCatalogs = allCatalogs.filter(c => c.metalakeId === metalakeId);

  const [selectedCatalog, setSelectedCatalog] = useState(null);

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

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100%", minHeight: 0,
      background: "var(--idf-surface, #f8fafc)",
    }}>
      <Breadcrumb metalake={metalake} catalog={selectedCatalog} onMetalakeClick={() => setSelectedCatalog(null)} />
      <div style={{
        display: "grid", gridTemplateColumns: "260px 1fr",
        flex: 1, minHeight: 0,
      }}>
        <CatalogTree
          catalogs={allCatalogs}
          metalakeId={metalakeId}
          onSelect={setSelectedCatalog}
        />
        <div style={{
          padding: 16, overflow: "auto",
          background: "var(--idf-card, #fff)",
        }}>
          <CatalogsTable
            catalogs={selectedCatalog ? [selectedCatalog] : myCatalogs}
            onSelect={setSelectedCatalog}
          />
        </div>
      </div>
    </div>
  );
}

function Breadcrumb({ metalake, catalog, onMetalakeClick }) {
  return (
    <nav
      aria-label="breadcrumb"
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "10px 16px",
        fontSize: 12,
        background: "var(--idf-card, #fff)",
        borderBottom: "1px solid var(--idf-border, #e5e7eb)",
        color: "var(--idf-text-muted)",
      }}
    >
      <a href="/gravitino/metalake_list" style={{ color: "var(--idf-text-muted)", textDecoration: "none" }}>
        Metalakes
      </a>
      <span>›</span>
      {catalog ? (
        <>
          <button
            type="button"
            onClick={onMetalakeClick}
            style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              color: "var(--idf-text-muted)", fontSize: 12,
            }}
          >{metalake.name}</button>
          <span>›</span>
          <span style={{ color: "var(--idf-text)", fontWeight: 500 }}>{catalog.name}</span>
        </>
      ) : (
        <span style={{ color: "var(--idf-text)", fontWeight: 500 }}>{metalake.name}</span>
      )}
    </nav>
  );
}
