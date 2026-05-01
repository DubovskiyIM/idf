/**
 * ComplianceHub — 2-pane: Tags / Policies (Row Filters / Column Masks disabled
 * placeholders как у gravitino/web-v2). Wires CreateTagDialog + CreatePolicyDialog.
 *
 * U-backend-exec: Create Tag / Create Policy + Drop Tag / Drop Policy через
 * реальный exec({intent, params, context}). Generic effect handler в SDK
 * применяет intent.particles.effects (Tag/Policy с op=replace|remove) — fold
 * обновляет world.tags / world.policies. Локальный optimistic state удалён.
 *
 * U-edit-flows: Edit Tag / Edit Policy reuse тот же dialog instance с prop
 * `initial` (entity-target). Submit передаёт payload с preserved id → тот
 * же createTag/createPolicy intent → generic SDK handler делает overwrite
 * by id. Placeholder toasts «Edit X — U-iam2c» удалены.
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
  const [editTagTarget, setEditTagTarget] = useState(null);
  const [editPolicyTarget, setEditPolicyTarget] = useState(null);

  // Метаlake-name берём из первого metalake в world (в реальной gravitino UI
  // selector или URL-param). В заглушечном domain используется единственный.
  const metalakeName = (world.metalakes || [])[0]?.name || "default";

  const onDelete = (kind) => (entity) => {
    const intentId = kind === "Tag" ? "deleteTag" : "deletePolicy";
    const paramKey = kind === "Tag" ? "tag" : "policy";
    // U-fix-exec-signature: exec(intentId, flatCtx).
    exec(intentId, { metalake: metalakeName, [paramKey]: entity.name });
    toast(`${kind} «${entity.name}» удалён`, "error");
  };

  return (
    <TwoPaneLayout sections={SECTIONS} active={active} onSelect={setActive} title="Data Compliance">
      {active === "tags" && (
        <TagsTable
          tags={world.tags || []}
          onCreate={() => setCreateTagOpen(true)}
          onEdit={(t) => setEditTagTarget(t)}
          onView={(t) => {
            // U-derive Phase 3.6: tag_detail derived projection — lookup by tagName.
            if (typeof window !== "undefined") {
              window.location.href = `/gravitino/tag_detail?tagName=${encodeURIComponent(t.name)}`;
            }
          }}
          onDelete={onDelete("Tag")}
        />
      )}
      {active === "policies" && (
        <PoliciesTable
          policies={world.policies || []}
          onCreate={() => setCreatePolicyOpen(true)}
          onEdit={(p) => setEditPolicyTarget(p)}
          onView={(p) => {
            // Navigate в policy_detail canvas (PolicyDetailPane).
            if (typeof window !== "undefined") {
              window.location.href = `/gravitino/policy_detail?policyId=${encodeURIComponent(p.id)}`;
            }
          }}
          onDelete={onDelete("Policy")}
        />
      )}

      <CreateTagDialog
        visible={createTagOpen || !!editTagTarget}
        initial={editTagTarget}
        onClose={() => { setCreateTagOpen(false); setEditTagTarget(null); }}
        onSubmit={(payload) => {
          const isEdit = !!editTagTarget;
          exec("createTag", {
            ...payload,
            metalake: metalakeName,
            audit: payload.audit || { creator: viewer?.name || "ui", createTime: new Date().toISOString() },
          });
          toast(isEdit ? `Tag «${payload.name}» обновлён` : `Tag «${payload.name}» создан`, "success");
          setCreateTagOpen(false); setEditTagTarget(null);
        }}
      />
      <CreatePolicyDialog
        visible={createPolicyOpen || !!editPolicyTarget}
        initial={editPolicyTarget}
        onClose={() => { setCreatePolicyOpen(false); setEditPolicyTarget(null); }}
        onSubmit={(payload) => {
          const isEdit = !!editPolicyTarget;
          exec("createPolicy", {
            ...payload,
            metalake: metalakeName,
            audit: payload.audit || { creator: viewer?.name || "ui", createTime: new Date().toISOString() },
          });
          toast(isEdit ? `Policy «${payload.name}» обновлена` : `Policy «${payload.name}» создана`, "success");
          setCreatePolicyOpen(false); setEditPolicyTarget(null);
        }}
      />
    </TwoPaneLayout>
  );
}
