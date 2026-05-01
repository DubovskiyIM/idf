/**
 * ComplianceHub — 2-pane: Tags / Policies (Row Filters / Column Masks disabled
 * placeholders как у gravitino/web-v2).
 */
import { useState } from "react";
import TwoPaneLayout from "./TwoPaneLayout.jsx";
import { TagsTable, PoliciesTable } from "./iamTables.jsx";
import { ToastProvider, useToast } from "./Toast.jsx";

const SECTIONS = [
  { key: "tags",     label: "Tags" },
  { key: "policies", label: "Policies" },
  { key: "filters",  label: "Row Filters",   disabled: true },
  { key: "masks",    label: "Column Masks",  disabled: true },
];

export default function ComplianceHub(props) {
  return <ToastProvider><Inner {...props} /></ToastProvider>;
}

function Inner({ world = {} }) {
  const toast = useToast();
  const [active, setActive] = useState("tags");
  const [deletedIds, setDeletedIds] = useState(new Set());
  const filterDel = (xs) => (xs || []).filter(x => !deletedIds.has(x.id));
  const onDelete = (kind) => (entity) => {
    setDeletedIds(prev => new Set(prev).add(entity.id));
    toast(`${kind} «${entity.name}» удалён`, "error");
  };

  return (
    <TwoPaneLayout sections={SECTIONS} active={active} onSelect={setActive} title="Data Compliance">
      {active === "tags" && (
        <TagsTable
          tags={filterDel(world.tags)}
          onCreate={() => toast("Create Tag — U-iam2.b", "info")}
          onEdit={(t) => toast(`Edit Tag ${t.name} — U-iam2.b`, "info")}
          onDelete={onDelete("Tag")}
        />
      )}
      {active === "policies" && (
        <PoliciesTable
          policies={filterDel(world.policies)}
          onCreate={() => toast("Create Policy — U-iam2.b", "info")}
          onEdit={(p) => toast(`Edit Policy ${p.name} — U-iam2.b`, "info")}
          onView={(p) => toast(`View Policy ${p.name}`, "info")}
          onDelete={onDelete("Policy")}
        />
      )}
    </TwoPaneLayout>
  );
}
