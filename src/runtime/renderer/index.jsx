import ArchetypeFeed from "./archetypes/ArchetypeFeed.jsx";
import ArchetypeCatalog from "./archetypes/ArchetypeCatalog.jsx";
import ArchetypeDetail from "./archetypes/ArchetypeDetail.jsx";
import ArchetypeForm from "./archetypes/ArchetypeForm.jsx";
import ArchetypeCanvas from "./archetypes/ArchetypeCanvas.jsx";
import ArchetypeDashboard from "./archetypes/ArchetypeDashboard.jsx";
import ArchetypeWizard from "./archetypes/ArchetypeWizard.jsx";
import ArchetypeErrorBoundary from "./ErrorBoundary.jsx";
import { validateArtifact } from "./validation/validateArtifact.js";

const ARCHETYPES = {
  feed: ArchetypeFeed,
  catalog: ArchetypeCatalog,
  detail: ArchetypeDetail,
  form: ArchetypeForm,
  canvas: ArchetypeCanvas,
  dashboard: ArchetypeDashboard,
  wizard: ArchetypeWizard,
};

export default function ProjectionRendererV2({
  artifact,
  projection,
  world,
  exec,
  execBatch,
  viewer,
  viewerContext,
  routeParams,
  navigate,
  back,
  theme,
  artifacts,
  allProjections,
}) {
  if (!artifact) {
    return <div style={{ padding: 20, color: "#9ca3af", textAlign: "center" }}>Нет артефакта</div>;
  }

  const validation = validateArtifact(artifact);
  if (!validation.ok) {
    return (
      <div style={{ padding: 20, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8 }}>
        <div style={{ fontWeight: 600, color: "#dc2626", marginBottom: 8 }}>Артефакт не валиден</div>
        <ul style={{ margin: 0, paddingLeft: 20, fontSize: 12, color: "#7f1d1d" }}>
          {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      </div>
    );
  }

  const Archetype = ARCHETYPES[artifact.archetype];
  if (!Archetype) {
    return (
      <div style={{ padding: 20, color: "#9ca3af" }}>
        Архетип "{artifact.archetype}" пока не поддержан.
      </div>
    );
  }

  // Обёртка exec: автоматически вливает viewerContext + routeParams
  const wrappedExec = (intentId, params = {}) =>
    exec(intentId, { ...(viewerContext || {}), ...(routeParams || {}), ...params });

  // Обёртка execBatch: добавляет viewerContext + routeParams в каждый sub-ctx
  const wrappedExecBatch = execBatch
    ? (intentId, subs) =>
        execBatch(intentId, subs.map(sub => ({
          intentId: sub.intentId,
          ctx: { ...(viewerContext || {}), ...(routeParams || {}), ...(sub.ctx || {}) },
        })))
    : undefined;

  const ctx = {
    world,
    viewer,
    exec: wrappedExec,
    execBatch: wrappedExecBatch,
    theme,
    artifact,
    viewerContext,
    routeParams,
    navigate,
    back,
    artifacts,
    allProjections,
  };

  return (
    <ArchetypeErrorBoundary archetype={artifact.archetype} key={artifact.projection}>
      <Archetype slots={artifact.slots} nav={artifact.nav} ctx={ctx} projection={projection} />
    </ArchetypeErrorBoundary>
  );
}
