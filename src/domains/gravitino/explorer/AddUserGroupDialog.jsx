/**
 * AddUserGroupDialog — universal modal для Add User или Add Group (U-add-user-group).
 *
 * Single name input + Submit. Reuse Modal/Field/Footer из CreateTagDialog.
 * Mode определяется через kind="user"|"group".
 */
import { useEffect, useState } from "react";
import { Modal, Field, Footer } from "./CreateTagDialog.jsx";

const NAME_HINT = "Username (alphanumeric, dot, underscore, dash)";

export default function AddUserGroupDialog({
  visible, kind = "user",
  onClose = () => {}, onSubmit = () => {},
}) {
  const [name, setName] = useState("");
  useEffect(() => { if (!visible) setName(""); }, [visible]);
  if (!visible) return null;

  const isValid = name.trim().length > 0;
  const submit = () => isValid && onSubmit({ name: name.trim() });
  const titleNoun = kind === "group" ? "User Group" : "User";

  return (
    <Modal title={`Add ${titleNoun}`} subtitle={`Add a new ${titleNoun.toLowerCase()}`} onClose={onClose} width={420}>
      <Field label="Name" required>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={NAME_HINT}
          aria-label="Name"
          style={{ display: "block", width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4, background: "var(--idf-surface, #fff)", color: "var(--idf-text)", boxSizing: "border-box" }}
        />
      </Field>
      <Footer onClose={onClose} onSubmit={submit} disabled={!isValid} submitLabel="Submit" />
    </Modal>
  );
}
