/**
 * AccessHub — canvas для access_hub projection (U2.6).
 * Группирует IAM-resources (Users / Groups / Roles) под одной точкой
 * входа. Заменяет 3 flat-tab'а в top-nav.
 */
import HubGrid from "./HubGrid.jsx";

const TILES = [
  { projectionId: "user_list",  label: "Users",  description: "User accounts с роли и audit",  icon: "👤" },
  { projectionId: "group_list", label: "Groups", description: "User groups с членами",           icon: "👥" },
  { projectionId: "role_list",  label: "Roles",  description: "RBAC роли с securableObjects",   icon: "🎭" },
];

export default function AccessHub() {
  return <HubGrid title="Access" subtitle="IAM — пользователи, группы, роли" tiles={TILES} />;
}
