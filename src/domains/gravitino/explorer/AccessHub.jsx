/**
 * AccessHub — 2-pane: left submenu (Users/User Groups/Roles), right table.
 * Click row Grant Role → toast «Grant Role TODO (U-iam2.b)».
 */
import { useState } from "react";
import TwoPaneLayout from "./TwoPaneLayout.jsx";
import { UsersTable, GroupsTable, RolesTable } from "./iamTables.jsx";
import { ToastProvider, useToast } from "./Toast.jsx";

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

  const filterDel = (xs) => (xs || []).filter(x => !deletedIds.has(x.id));
  const onDelete = (kind) => (entity) => {
    setDeletedIds(prev => new Set(prev).add(entity.id));
    toast(`${kind} «${entity.name}» удалён`, "error");
  };

  return (
    <TwoPaneLayout sections={SECTIONS} active={active} onSelect={setActive} title="Access">
      {active === "users"  && (
        <UsersTable
          users={filterDel(world.users)}
          onAdd={() => toast("Add User — U-iam2.b", "info")}
          onGrantRole={(u) => toast(`Grant Role to ${u.name} — U-iam2.b`, "info")}
          onDelete={onDelete("User")}
        />
      )}
      {active === "groups" && (
        <GroupsTable
          groups={filterDel(world.groups)}
          onAdd={() => toast("Add User Group — U-iam2.b", "info")}
          onGrantRole={(g) => toast(`Grant Role to ${g.name} — U-iam2.b`, "info")}
          onDelete={onDelete("Group")}
        />
      )}
      {active === "roles"  && (
        <RolesTable
          roles={filterDel(world.roles)}
          onCreate={() => toast("Create Role — U-iam2.b", "info")}
          onEdit={(r) => toast(`Edit Role ${r.name} — U-iam2.b`, "info")}
          onDelete={onDelete("Role")}
        />
      )}
    </TwoPaneLayout>
  );
}
