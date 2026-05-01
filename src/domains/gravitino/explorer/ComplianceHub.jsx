/**
 * ComplianceHub — 2-pane: Tags / Policies (Row Filters / Column Masks disabled
 * placeholders как у gravitino/web-v2). Wires CreateTagDialog + CreatePolicyDialog.
 *
 * U-backend-exec: Create Tag / Create Policy + Drop Tag / Drop Policy через
 * реальный exec({intent, params, context}). Generic effect handler в SDK
 * применяет intent.particles.effects (Tag/Policy с op=replace|remove) — fold
 * обновляет world.tags / world.policies. Локальный optimistic state удалён.
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

function Inner({ world = {}, exec = () => {}, viewer }) {
  const toast = useToast();
  const [active, setActive] = useState("tags");
  const [createTagOpen, setCreateTagOpen] = useState(false);
  const [createPolicyOpen, setCreatePolicyOpen] = useState(false);

  // Метаlake-name берём из первого metalake в world (в реальной gravitino UI
  // selector или URL-param). В заглушечном domain используется единственный.
  const metalakeName = (world.metalakes || [])[0]?.name || "default";

  const onDelete = (kind) => (entity) => {
    const intentId = kind === "Tag" ? "deleteTag" : "deletePolicy";
    const paramKey = kind === "Tag" ? "tag" : "policy";
    exec({
      intent: intentId,
      params: { metalake: metalakeName, [paramKey]: entity.name },
      context: {},
    });
    toast(`${kind} «${entity.name}» удалён`, "error");
  };

  return (
    <TwoPaneLayout sections={SECTIONS} active={active} onSelect={setActive} title="Data Compliance">
      {active === "tags" && (
        <TagsTable
          tags={world.tags || []}
          onCreate={() => setCreateTagOpen(true)}
          onEdit={(t) => toast(`Edit Tag ${t.name} — U-iam2c`, "info")}
          onDelete={onDelete("Tag")}
        />
      )}
      {active === "policies" && (
        <PoliciesTable
          policies={world.policies || []}
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
          exec({
            intent: "createTag",
            params: { metalake: metalakeName },
            context: {
              ...payload,
              audit: { creator: viewer?.name || "ui", createTime: new Date().toISOString() },
            },
          });
          toast(`Tag «${payload.name}» создан`, "success");
          setCreateTagOpen(false);
        }}
      />
      <CreatePolicyDialog
        visible={createPolicyOpen}
        onClose={() => setCreatePolicyOpen(false)}
        onSubmit={(payload) => {
          exec({
            intent: "createPolicy",
            params: { metalake: metalakeName },
            context: {
              ...payload,
              audit: { creator: viewer?.name || "ui", createTime: new Date().toISOString() },
            },
          });
          toast(`Policy «${payload.name}» создана`, "success");
          setCreatePolicyOpen(false);
        }}
      />
    </TwoPaneLayout>
  );
}
