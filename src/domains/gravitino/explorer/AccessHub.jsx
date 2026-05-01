/**
 * AccessHub — 2-pane: left submenu (Users/User Groups/Roles), right table.
 * Wires CreateRoleDialog + GrantRoleDialog (U-iam2.b).
 * Optimistic state — createdRoles + grantedRoles overrides без backend exec.
 */
import { useState } from "react";
import TwoPaneLayout from "./TwoPaneLayout.jsx";
import { UsersTable, GroupsTable, RolesTable } from "./iamTables.jsx";
import { ToastProvider, useToast } from "./Toast.jsx";
import CreateRoleDialog from "./CreateRoleDialog.jsx";
import GrantRoleDialog from "./GrantRoleDialog.jsx";

const SECTIONS = [
  { key: "users",  label: "Users" },
  { key: "groups", label: "User Groups" },
  { key: "roles",  label: "Roles" },
];

export default function AccessHub(props) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}

function Inner({ world = {} }) {
  const toast = useToast();
  const [active, setActive] = useState("users");
  const [deletedIds, setDeletedIds] = useState(new Set());
  const [grantTarget, setGrantTarget] = useState(null);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [createdRoles, setCreatedRoles] = useState([]);
  const [grantedRoles, setGrantedRoles] = useState({}); // {id: [roles]}

  const filterDel = (xs) => (xs || []).filter(x => !deletedIds.has(x.id));
  const onDelete = (kind) => (entity) => {
    setDeletedIds(prev => new Set(prev).add(entity.id));
    toast(`${kind} «${entity.name}» удалён`, "error");
  };

  const allRoles = [...(world.roles || []), ...createdRoles];
  const enrichedUsers = (world.users || []).map(u => ({ ...u, roles: grantedRoles[u.id] ?? u.roles ?? [] }));
  const enrichedGroups = (world.groups || []).map(g => ({ ...g, roles: grantedRoles[g.id] ?? g.roles ?? [] }));

  return (
    <TwoPaneLayout sections={SECTIONS} active={active} onSelect={setActive} title="Access">
      {active === "users"  && (
        <UsersTable
          users={filterDel(enrichedUsers)}
          onAdd={() => toast("Add User — backend U-iam2c", "info")}
          onGrantRole={(u) => setGrantTarget({ kind: "user", id: u.id, name: u.name, roles: u.roles || [] })}
          onDelete={onDelete("User")}
        />
      )}
      {active === "groups" && (
        <GroupsTable
          groups={filterDel(enrichedGroups)}
          onAdd={() => toast("Add User Group — backend U-iam2c", "info")}
          onGrantRole={(g) => setGrantTarget({ kind: "group", id: g.id, name: g.name, roles: g.roles || [] })}
          onDelete={onDelete("Group")}
        />
      )}
      {active === "roles"  && (
        <RolesTable
          roles={filterDel(allRoles)}
          onCreate={() => setCreateRoleOpen(true)}
          onEdit={(r) => toast(`Edit Role ${r.name} — U-iam2c`, "info")}
          onDelete={onDelete("Role")}
        />
      )}

      <CreateRoleDialog
        visible={createRoleOpen}
        onClose={() => setCreateRoleOpen(false)}
        onSubmit={(payload) => {
          setCreatedRoles(prev => [...prev, {
            id: `r_new_${Date.now()}`,
            owner: "current_user",
            audit: { createTime: new Date().toISOString() },
            ...payload,
          }]);
          toast(`Role «${payload.name}» создан`, "success");
          setCreateRoleOpen(false);
        }}
      />
      <GrantRoleDialog
        visible={!!grantTarget}
        target={grantTarget}
        availableRoles={filterDel(allRoles)}
        currentRoles={grantTarget?.roles || []}
        onClose={() => setGrantTarget(null)}
        onSubmit={(rolesList) => {
          setGrantedRoles(prev => ({ ...prev, [grantTarget.id]: rolesList }));
          toast(`Roles обновлены для ${grantTarget.kind} ${grantTarget.name}`, "success");
          setGrantTarget(null);
        }}
      />
    </TwoPaneLayout>
  );
}
