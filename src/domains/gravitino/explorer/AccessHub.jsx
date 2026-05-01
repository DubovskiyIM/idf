/**
 * AccessHub — 2-pane: left submenu (Users/User Groups/Roles), right table.
 * Wires CreateRoleDialog + GrantRoleDialog.
 *
 * U-backend-exec: createRole / deleteRole / removeUser / removeGroup через
 * реальный exec. Generic effect handler в SDK применяет
 * intent.particles.effects (Role/User/Group с op=replace|remove). Локальный
 * createdRoles + deletedIds для этих сущностей удалён.
 *
 * Остаётся optimistic (требует custom buildEffects, → U-backend-exec-2):
 * grantRoleToUser/Group (modify nested User.roles array),
 * setOwner для Role (modify nested owner field).
 */
import { useState } from "react";
import TwoPaneLayout from "./TwoPaneLayout.jsx";
import { UsersTable, GroupsTable, RolesTable } from "./iamTables.jsx";
import { ToastProvider, useToast } from "./Toast.jsx";
import CreateRoleDialog from "./CreateRoleDialog.jsx";
import GrantRoleDialog from "./GrantRoleDialog.jsx";
import SetOwnerDialog from "./SetOwnerDialog.jsx";

const SECTIONS = [
  { key: "users",  label: "Users" },
  { key: "groups", label: "User Groups" },
  { key: "roles",  label: "Roles" },
];

export default function AccessHub(props) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}

function Inner({ world = {}, exec = () => {}, viewer }) {
  const toast = useToast();
  const [active, setActive] = useState("users");
  // U-backend-exec-2: grant через exec — нужен custom buildEffect для User.roles append.
  const [grantTarget, setGrantTarget] = useState(null);
  const [grantedRoles, setGrantedRoles] = useState({}); // {id: [roles]}
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  // U-backend-exec-2: setOwner для Role — modify-nested, generic handler не справится.
  const [roleOwnerTarget, setRoleOwnerTarget] = useState(null);
  const [roleOwnerOverrides, setRoleOwnerOverrides] = useState({}); // {roleId: ownerName}

  const metalakeName = (world.metalakes || [])[0]?.name || "default";

  const onDelete = (kind) => (entity) => {
    const intentId = { User: "removeUser", Group: "removeGroup", Role: "deleteRole" }[kind];
    const paramKey = { User: "user", Group: "group", Role: "role" }[kind];
    if (!intentId || !paramKey) return;
    exec({
      intent: intentId,
      params: { metalake: metalakeName, [paramKey]: entity.name },
      context: {},
    });
    toast(`${kind} «${entity.name}» удалён`, "error");
  };

  const allRoles = (world.roles || []).map(r =>
    roleOwnerOverrides[r.id] !== undefined ? { ...r, owner: roleOwnerOverrides[r.id] } : r
  );
  const enrichedUsers = (world.users || []).map(u => ({ ...u, roles: grantedRoles[u.id] ?? u.roles ?? [] }));
  const enrichedGroups = (world.groups || []).map(g => ({ ...g, roles: grantedRoles[g.id] ?? g.roles ?? [] }));

  return (
    <TwoPaneLayout sections={SECTIONS} active={active} onSelect={setActive} title="Access">
      {active === "users"  && (
        <UsersTable
          users={enrichedUsers}
          onAdd={() => toast("Add User — backend U-iam2c", "info")}
          onGrantRole={(u) => setGrantTarget({ kind: "user", id: u.id, name: u.name, roles: u.roles || [] })}
          onDelete={onDelete("User")}
        />
      )}
      {active === "groups" && (
        <GroupsTable
          groups={enrichedGroups}
          onAdd={() => toast("Add User Group — backend U-iam2c", "info")}
          onGrantRole={(g) => setGrantTarget({ kind: "group", id: g.id, name: g.name, roles: g.roles || [] })}
          onDelete={onDelete("Group")}
        />
      )}
      {active === "roles"  && (
        <RolesTable
          roles={allRoles}
          onCreate={() => setCreateRoleOpen(true)}
          onEdit={(r) => toast(`Edit Role ${r.name} — U-iam2c`, "info")}
          onDelete={onDelete("Role")}
          onSetOwner={(role) => setRoleOwnerTarget(role)}
        />
      )}

      <CreateRoleDialog
        visible={createRoleOpen}
        onClose={() => setCreateRoleOpen(false)}
        onSubmit={(payload) => {
          exec({
            intent: "createRole",
            params: { metalake: metalakeName },
            context: {
              ...payload,
              owner: viewer?.name || "ui",
              audit: { creator: viewer?.name || "ui", createTime: new Date().toISOString() },
            },
          });
          toast(`Role «${payload.name}» создан`, "success");
          setCreateRoleOpen(false);
        }}
      />
      <GrantRoleDialog
        visible={!!grantTarget}
        target={grantTarget}
        availableRoles={allRoles}
        currentRoles={grantTarget?.roles || []}
        onClose={() => setGrantTarget(null)}
        onSubmit={(rolesList) => {
          // U-backend-exec-2: optimistic — нужен custom buildEffect для grantRoleToUser/Group.
          setGrantedRoles(prev => ({ ...prev, [grantTarget.id]: rolesList }));
          toast(`Roles обновлены для ${grantTarget.kind} ${grantTarget.name}`, "success");
          setGrantTarget(null);
        }}
      />
      <SetOwnerDialog
        visible={!!roleOwnerTarget}
        currentOwner={roleOwnerTarget?.owner}
        users={world.users || []}
        groups={world.groups || []}
        onClose={() => setRoleOwnerTarget(null)}
        onSubmit={({ name }) => {
          // U-backend-exec-2: setOwner — modify-nested, generic handler не справится.
          setRoleOwnerOverrides(prev => ({ ...prev, [roleOwnerTarget.id]: name }));
          toast(`Owner role «${roleOwnerTarget.name}» назначен: ${name}`, "success");
          setRoleOwnerTarget(null);
        }}
      />
    </TwoPaneLayout>
  );
}
