/**
 * AccessHub — 2-pane: left submenu (Users/User Groups/Roles), right table.
 * Wires CreateRoleDialog + GrantRoleDialog.
 *
 * U-backend-exec: createRole / deleteRole / removeUser / removeGroup через
 * реальный exec. Generic effect handler в SDK применяет
 * intent.particles.effects (Role/User/Group с op=replace|remove).
 *
 * U-backend-exec-2: grantRoleToUser/Group + setOwner Role через exec —
 * custom buildEffects в gravitino/domain.js собирает full-entity overwrite
 * (α:'add' с тем же id) на users/groups/roles. Локальные grantedRoles +
 * roleOwnerOverrides удалены — display прямо из world.{users,groups,roles};
 * fold обновляет мир после exec.
 *
 * U-edit-flows: Edit Role reuse single CreateRoleDialog instance с prop
 * `initial`. Submit с preserved id/owner/audit → тот же createRole intent
 * делает overwrite by id. Placeholder toast «Edit Role — U-iam2c» удалён.
 */
import { useState } from "react";
import TwoPaneLayout from "./TwoPaneLayout.jsx";
import { UsersTable, GroupsTable, RolesTable } from "./iamTables.jsx";
import { ToastProvider, useToast } from "./Toast.jsx";
// CreateRoleDialog заменён на IntentFormDialog (Phase 3.13). securableObjects
// pre-fill для edit-mode не поддерживается — multi-securable matrix UX
// потенциально вернётся через SDK permissionMatrix-as-input primitive.
import GrantRoleDialog from "./GrantRoleDialog.jsx";
import SetOwnerDialog from "./SetOwnerDialog.jsx";
import IntentFormDialog from "./IntentFormDialog.jsx";
import { INTENTS } from "../intents.js";

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
  const [grantTarget, setGrantTarget] = useState(null);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [editRoleTarget, setEditRoleTarget] = useState(null);
  const [roleOwnerTarget, setRoleOwnerTarget] = useState(null);
  const [addOpen, setAddOpen] = useState(null); // "user" | "group" | null

  const metalakeName = (world.metalakes || [])[0]?.name || "default";

  const onDelete = (kind) => (entity) => {
    const intentId = { User: "removeUser", Group: "removeGroup", Role: "deleteRole" }[kind];
    const paramKey = { User: "user", Group: "group", Role: "role" }[kind];
    if (!intentId || !paramKey) return;
    // U-fix-exec-signature: exec(intentId, flatCtx).
    exec(intentId, { metalake: metalakeName, [paramKey]: entity.name });
    toast(`${kind} «${entity.name}» удалён`, "error");
  };

  const handleGrantRole = (rolesList) => {
    if (!grantTarget) return;
    const isUser = grantTarget.kind === "user";
    const intentId = isUser ? "grantRoleToUser" : "grantRoleToGroup";
    const subjectKey = isUser ? "user" : "group";
    const entityKey = isUser ? "userEntity" : "groupEntity";
    const collection = isUser ? (world.users || []) : (world.groups || []);
    const subject = collection.find(s => s.id === grantTarget.id);
    if (!subject) { setGrantTarget(null); return; }
    // U-fix-exec-signature: collision между param `user`/`group` (raw name)
    // и full entity → entity передаётся как userEntity / groupEntity.
    exec(intentId, {
      [entityKey]: subject,
      roles: rolesList,
      metalake: metalakeName,
      [subjectKey]: subject.name,
    });
    toast(`Roles обновлены для ${grantTarget.kind} ${grantTarget.name}`, "success");
    setGrantTarget(null);
  };

  const handleRoleSetOwner = ({ name }) => {
    if (!roleOwnerTarget) return;
    exec("setOwner", {
      entity: roleOwnerTarget, entityType: "roles", newOwnerName: name,
      metalake: metalakeName, metadataObjectType: "role", metadataObjectFullName: roleOwnerTarget.name,
    });
    toast(`Owner role «${roleOwnerTarget.name}» назначен: ${name}`, "success");
    setRoleOwnerTarget(null);
  };

  const users = world.users || [];
  const groups = world.groups || [];
  const roles = world.roles || [];

  return (
    <TwoPaneLayout sections={SECTIONS} active={active} onSelect={setActive} title="Access">
      {active === "users"  && (
        <UsersTable
          users={users}
          onAdd={() => setAddOpen("user")}
          onGrantRole={(u) => setGrantTarget({ kind: "user", id: u.id, name: u.name, roles: u.roles || [] })}
          onDelete={onDelete("User")}
        />
      )}
      {active === "groups" && (
        <GroupsTable
          groups={groups}
          onAdd={() => setAddOpen("group")}
          onGrantRole={(g) => setGrantTarget({ kind: "group", id: g.id, name: g.name, roles: g.roles || [] })}
          onDelete={onDelete("Group")}
        />
      )}
      {active === "roles"  && (
        <RolesTable
          roles={roles}
          onCreate={() => setCreateRoleOpen(true)}
          onEdit={(r) => setEditRoleTarget(r)}
          onDelete={onDelete("Role")}
          onSetOwner={(role) => setRoleOwnerTarget(role)}
        />
      )}

      <IntentFormDialog
        visible={createRoleOpen || !!editRoleTarget}
        intentId="createRole"
        intents={INTENTS}
        initial={editRoleTarget}
        title={editRoleTarget ? "Edit Role" : "Create Role"}
        contextParams={{
          metalake: metalakeName,
          owner: viewer?.name || "ui",
          audit: { creator: viewer?.name || "ui", createTime: new Date().toISOString() },
        }}
        onClose={() => { setCreateRoleOpen(false); setEditRoleTarget(null); }}
        onSubmit={(payload) => {
          const isEdit = !!editRoleTarget;
          exec("createRole", payload);
          toast(isEdit ? `Role «${payload.name}» обновлён` : `Role «${payload.name}» создан`, "success");
          setCreateRoleOpen(false); setEditRoleTarget(null);
        }}
      />
      <GrantRoleDialog
        visible={!!grantTarget}
        target={grantTarget}
        availableRoles={roles}
        currentRoles={grantTarget?.roles || []}
        onClose={() => setGrantTarget(null)}
        onSubmit={handleGrantRole}
      />
      <SetOwnerDialog
        visible={!!roleOwnerTarget}
        currentOwner={roleOwnerTarget?.owner}
        users={users}
        groups={groups}
        onClose={() => setRoleOwnerTarget(null)}
        onSubmit={handleRoleSetOwner}
      />
      <IntentFormDialog
        visible={addOpen !== null}
        intentId={addOpen === "group" ? "addGroup" : "addUser"}
        intents={INTENTS}
        title={addOpen === "group" ? "Add User Group" : "Add User"}
        contextParams={{
          metalake: metalakeName, roles: [],
          audit: { creator: viewer?.name || "ui", createTime: new Date().toISOString() },
        }}
        onClose={() => setAddOpen(null)}
        onSubmit={(payload) => {
          const intentId = addOpen === "group" ? "addGroup" : "addUser";
          exec(intentId, payload);
          toast(`${addOpen === "group" ? "Group" : "User"} «${payload.name}» добавлен`, "success");
          setAddOpen(null);
        }}
      />
    </TwoPaneLayout>
  );
}
