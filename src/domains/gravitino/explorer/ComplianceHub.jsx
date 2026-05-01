/**
 * ComplianceHub — 2-pane: Tags / Policies (Row Filters / Column Masks disabled
 * placeholders как у gravitino/web-v2). Wires CreateTagDialog + CreatePolicyDialog (U-iam2.b).
 */
import { useState } from "react";
import TwoPaneLayout from "./TwoPaneLayout.jsx";
import { TagsTable, PoliciesTable } from "./iamTables.jsx";
import { ToastProvider, useToast } from "./Toast.jsx";
import CreateTagDialog from "./CreateTagDialog.jsx";
import CreatePolicyDialog from "./CreatePolicyDialog.jsx";

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
  const [createTagOpen, setCreateTagOpen] = useState(false);
  const [createPolicyOpen, setCreatePolicyOpen] = useState(false);
  const [createdTags, setCreatedTags] = useState([]);
  const [createdPolicies, setCreatedPolicies] = useState([]);

  const filterDel = (xs) => (xs || []).filter(x => !deletedIds.has(x.id));
  const onDelete = (kind) => (entity) => {
    setDeletedIds(prev => new Set(prev).add(entity.id));
    toast(`${kind} «${entity.name}» удалён`, "error");
  };

  const allTags = [...(world.tags || []), ...createdTags];
  const allPolicies = [...(world.policies || []), ...createdPolicies];

  return (
    <TwoPaneLayout sections={SECTIONS} active={active} onSelect={setActive} title="Data Compliance">
      {active === "tags" && (
        <TagsTable
          tags={filterDel(allTags)}
          onCreate={() => setCreateTagOpen(true)}
          onEdit={(t) => toast(`Edit Tag ${t.name} — U-iam2c`, "info")}
          onDelete={onDelete("Tag")}
        />
      )}
      {active === "policies" && (
        <PoliciesTable
          policies={filterDel(allPolicies)}
          onCreate={() => setCreatePolicyOpen(true)}
          onEdit={(p) => toast(`Edit Policy ${p.name} — U-iam2c`, "info")}
          onView={(p) => toast(`View Policy ${p.name}`, "info")}
          onDelete={onDelete("Policy")}
        />
      )}

      <CreateTagDialog
        visible={createTagOpen}
        onClose={() => setCreateTagOpen(false)}
        onSubmit={(payload) => {
          setCreatedTags(prev => [...prev, {
            id: `tag_new_${Date.now()}`,
            audit: { createTime: new Date().toISOString() },
            ...payload,
          }]);
          toast(`Tag «${payload.name}» создан`, "success");
          setCreateTagOpen(false);
        }}
      />
      <CreatePolicyDialog
        visible={createPolicyOpen}
        onClose={() => setCreatePolicyOpen(false)}
        onSubmit={(payload) => {
          setCreatedPolicies(prev => [...prev, {
            id: `pol_new_${Date.now()}`,
            audit: { createTime: new Date().toISOString() },
            ...payload,
          }]);
          toast(`Policy «${payload.name}» создана`, "success");
          setCreatePolicyOpen(false);
        }}
      />
    </TwoPaneLayout>
  );
}
