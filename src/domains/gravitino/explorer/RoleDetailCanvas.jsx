/**
 * RoleDetailCanvas — canvas-обёртка для RoleDetailPane (U-iam, B12).
 *
 * routeParams.roleId — id или name роли. Резолвим через world.roles.
 * Если не нашли — empty state (роли могут быть удалены до load'а route).
 */
import RoleDetailPane from "./RoleDetailPane.jsx";

export default function RoleDetailCanvas({ world = {}, routeParams, ctx }) {
  const params = routeParams ?? ctx?.routeParams ?? {};
  const roleId = params.roleId;
  const role = (world.roles || []).find(r => r.id === roleId || r.name === roleId);
  if (!role) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--idf-text-muted)" }}>
        Role не найден (id: {String(roleId)})
      </div>
    );
  }
  return <RoleDetailPane role={role} />;
}
