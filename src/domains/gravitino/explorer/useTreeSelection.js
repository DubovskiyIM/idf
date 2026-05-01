/**
 * useTreeSelection — централизованный resolver kind узла в CatalogTree
 * (catalog / schema / table / model / fileset / function / topic) (U6.3 split).
 *
 * Возвращает callback handleTreeSelect, который вызывает соответствующие
 * setSelected*-сеттеры. Walk schema → catalog для leaf-nodes.
 *
 * Вынесено отдельно ради LOC-budget'а в CatalogExplorer.jsx (<300 LOC).
 */
export function makeTreeSelectHandler({
  world, myCatalogsAll, setters, resetLeaves,
}) {
  const {
    setSelectedCatalog, setSelectedSchema,
    setSelectedTable, setSelectedModel,
    setSelectedFileset, setSelectedFunction, setSelectedTopic,
  } = setters;

  const walkToCatalog = (schemaId) => {
    const parentSch = (world.schemas || []).find(s => s.id === schemaId);
    if (parentSch) {
      setSelectedSchema(parentSch);
      const parentCat = myCatalogsAll.find(c => c.id === parentSch.catalogId);
      if (parentCat) setSelectedCatalog(parentCat);
    }
  };

  return (node) => {
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
}
