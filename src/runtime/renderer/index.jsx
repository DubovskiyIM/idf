import ArchetypeFeed from "./archetypes/ArchetypeFeed.jsx";
import { validateArtifact } from "./validation/validateArtifact.js";

const ARCHETYPES = {
  feed: ArchetypeFeed,
  // catalog, detail, dashboard, canvas — добавятся в M2-M4
};

export default function ProjectionRendererV2({ artifact, world, exec, viewer, viewerContext, theme }) {
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
        Архетип "{artifact.archetype}" пока не поддержан (M1: только feed).
      </div>
    );
  }

  // Обёртка exec: автоматически вливает viewerContext в каждый вызов.
  // Это позволяет контролам (Composer, FormModal, IntentButton) ничего не знать про
  // доменно-специфичные поля типа conversationId/userId — их подаёт внешняя обёртка.
  const wrappedExec = (intentId, params = {}) =>
    exec(intentId, { ...(viewerContext || {}), ...params });

  const ctx = { world, viewer, exec: wrappedExec, theme, artifact, viewerContext };
  return <Archetype slots={artifact.slots} nav={artifact.nav} ctx={ctx} />;
}
