/**
 * PolicyDetailCanvas — canvas-обёртка для PolicyDetailPane (U-polish-3, B15).
 *
 * Читает routeParams.policyId, ищет Policy в world.policies (по id или name),
 * прокидывает в PolicyDetailPane. Регистрируется как canvas("policy_detail").
 */
import PolicyDetailPane from "./PolicyDetailPane.jsx";

export default function PolicyDetailCanvas({ world = {}, routeParams, ctx }) {
  const params = routeParams ?? ctx?.routeParams ?? {};
  const policyId = params.policyId;
  const policy = (world.policies || []).find(p => p.id === policyId || p.name === policyId);
  if (!policy) return (
    <div style={{ padding: 40, textAlign: "center", color: "var(--idf-text-muted)" }}>
      Policy не найдена (id: {String(policyId)})
    </div>
  );
  return <PolicyDetailPane policy={policy} />;
}
