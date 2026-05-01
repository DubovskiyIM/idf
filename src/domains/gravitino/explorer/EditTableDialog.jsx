/**
 * EditTableDialog — редактирование Table (U-edit-table).
 *
 * Tabs: Columns (inline-editor с Add/Remove) / Indexes (read-mostly + edit name).
 * Table Name — pre-filled placeholder (name immutable в Gravitino — rename
 * через separate flow). Submit отдаёт full table payload с preserved id +
 * extra fields (partitioning/distribution/sortOrders/properties не editable
 * в этом MVP — pass-through из initial).
 */
import { useEffect, useState } from "react";
import { Modal, Field, Footer } from "./CreateTagDialog.jsx";
import Tabs from "./Tabs.jsx";

const DATA_TYPES = ["String", "Integer", "Bigint", "Boolean", "Decimal(10,2)", "Decimal(18,2)", "Varchar(100)", "Varchar(255)", "Timestamp", "Date", "Double", "Float", "JSON"];

const TABS = [
  { key: "columns", label: "Columns" },
  { key: "indexes", label: "Indexes" },
];

const blankColumn = () => ({ name: "", type: "String", nullable: true, autoIncrement: false, defaultValue: null, comment: "" });
const blankIndex  = () => ({ name: "", type: "BTREE", fieldNames: [[""]] });

export default function EditTableDialog({ visible, initial, onClose = () => {}, onSubmit = () => {} }) {
  const [active, setActive] = useState("columns");
  const [comment, setComment] = useState("");
  const [columns, setColumns] = useState([]);
  const [indexes, setIndexes] = useState([]);

  useEffect(() => {
    if (visible && initial) {
      setActive("columns");
      setComment(initial.comment || "");
      setColumns((initial.columns || []).map(c => ({
        name: c.name || "",
        type: c.type || "String",
        nullable: c.nullable !== false,
        autoIncrement: !!c.autoIncrement,
        defaultValue: c.defaultValue ?? null,
        comment: c.comment || "",
      })));
      setIndexes((initial.indexes || []).map(ix => ({
        name: ix.name || "",
        type: ix.type || "BTREE",
        fieldNames: ix.fieldNames || [[""]],
      })));
    } else if (!visible) {
      setActive("columns"); setComment(""); setColumns([]); setIndexes([]);
    }
  }, [visible, initial]);

  if (!visible || !initial) return null;

  const updCol = (i, patch) => setColumns(prev => prev.map((c, ix) => ix === i ? { ...c, ...patch } : c));
  const addCol = () => setColumns(prev => [...prev, blankColumn()]);
  const removeCol = (i) => setColumns(prev => prev.filter((_, ix) => ix !== i));

  const updIdx = (i, patch) => setIndexes(prev => prev.map((c, ix) => ix === i ? { ...c, ...patch } : c));
  const addIdx = () => setIndexes(prev => [...prev, blankIndex()]);
  const removeIdx = (i) => setIndexes(prev => prev.filter((_, ix) => ix !== i));

  const isValid = columns.every(c => c.name.trim());
  const submit = () => {
    if (!isValid) return;
    onSubmit({
      ...initial, // pass-through partitioning/distribution/sortOrders/properties/audit/owner/tags/policies
      id: initial.id,
      name: initial.name,
      comment: comment.trim(),
      columns: columns.map(c => ({
        name: c.name.trim(),
        type: c.type,
        nullable: c.nullable,
        autoIncrement: c.autoIncrement,
        defaultValue: c.defaultValue,
        comment: c.comment.trim(),
      })),
      indexes: indexes.filter(ix => ix.name.trim()).map(ix => ({
        name: ix.name.trim(),
        type: ix.type,
        fieldNames: ix.fieldNames,
      })),
    });
  };

  return (
    <Modal title="Edit Table" subtitle={`Edit the table ${initial.name}`} onClose={onClose} width={900}>
      <Field label="Table Name" required>
        <input type="text" placeholder={initial.name} aria-label="Table Name" disabled style={{ ...inputStyle, color: "var(--idf-text-muted)" }} />
      </Field>
      <Tabs tabs={TABS} active={active} onChange={setActive}>
        {active === "columns" && (
          <ColumnsEditor columns={columns} update={updCol} add={addCol} remove={removeCol} />
        )}
        {active === "indexes" && (
          <IndexesEditor indexes={indexes} update={updIdx} add={addIdx} remove={removeIdx} />
        )}
      </Tabs>
      <Field label="Comment">
        <textarea value={comment} onChange={e => setComment(e.target.value)}
          style={{ ...inputStyle, minHeight: 60 }} />
      </Field>
      <Footer onClose={onClose} onSubmit={submit} disabled={!isValid} submitLabel="Submit" />
    </Modal>
  );
}

function ColumnsEditor({ columns, update, add, remove }) {
  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, color: "var(--idf-text)" }}>
        <thead>
          <tr style={{ background: "var(--idf-bg-subtle, #f9fafb)" }}>
            <th style={cellH}>Column</th>
            <th style={cellH}>Data Type</th>
            <th style={cellH}>Default Value</th>
            <th style={cellH}>Not Null</th>
            <th style={cellH}>Auto Increment</th>
            <th style={cellH}>Comment</th>
            <th style={cellH}>Action</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((c, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--idf-border)" }}>
              <td style={cellTd}>
                <input type="text" value={c.name} onChange={e => update(i, { name: e.target.value })}
                  placeholder="column name" style={smallInput} />
              </td>
              <td style={cellTd}>
                <select value={c.type} onChange={e => update(i, { type: e.target.value })} style={smallInput}>
                  {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </td>
              <td style={cellTd}>
                <input type="text" value={c.defaultValue ?? ""} onChange={e => update(i, { defaultValue: e.target.value || null })}
                  placeholder="NULL" style={smallInput} />
              </td>
              <td style={cellTd}>
                <Toggle on={!c.nullable} onChange={(v) => update(i, { nullable: !v })} />
              </td>
              <td style={cellTd}>
                <Toggle on={c.autoIncrement} onChange={(v) => update(i, { autoIncrement: v })} />
              </td>
              <td style={cellTd}>
                <input type="text" value={c.comment} onChange={e => update(i, { comment: e.target.value })}
                  placeholder="column comment" style={smallInput} />
              </td>
              <td style={{ ...cellTd, textAlign: "center" }}>
                <button type="button" onClick={() => remove(i)} aria-label="Remove column"
                  style={iconBtn}>−</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ textAlign: "center", padding: 10 }}>
        <button type="button" onClick={add} style={addBtn}>+ Add Column</button>
      </div>
    </div>
  );
}

function IndexesEditor({ indexes, update, add, remove }) {
  return (
    <div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ background: "var(--idf-bg-subtle)" }}>
            <th style={cellH}>Name</th>
            <th style={cellH}>Type</th>
            <th style={cellH}>Fields (CSV)</th>
            <th style={cellH}>Action</th>
          </tr>
        </thead>
        <tbody>
          {indexes.map((ix, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--idf-border)" }}>
              <td style={cellTd}>
                <input type="text" value={ix.name} onChange={e => update(i, { name: e.target.value })}
                  placeholder="index name" style={smallInput} />
              </td>
              <td style={cellTd}>
                <select value={ix.type} onChange={e => update(i, { type: e.target.value })} style={smallInput}>
                  <option value="PRIMARY_KEY">PRIMARY_KEY</option>
                  <option value="UNIQUE">UNIQUE</option>
                  <option value="BTREE">BTREE</option>
                </select>
              </td>
              <td style={cellTd}>
                <input type="text"
                  value={(ix.fieldNames || []).map(f => Array.isArray(f) ? f.join(".") : f).join(", ")}
                  onChange={e => update(i, { fieldNames: e.target.value.split(",").map(s => [s.trim()]) })}
                  placeholder="field1, field2" style={smallInput} />
              </td>
              <td style={{ ...cellTd, textAlign: "center" }}>
                <button type="button" onClick={() => remove(i)} aria-label="Remove index" style={iconBtn}>−</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ textAlign: "center", padding: 10 }}>
        <button type="button" onClick={add} style={addBtn}>+ Add Index</button>
      </div>
    </div>
  );
}

function Toggle({ on, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!on)}
      aria-pressed={on}
      style={{
        width: 32, height: 18, padding: 0, borderRadius: 10, cursor: "pointer",
        border: "1px solid var(--idf-border)",
        background: on ? "var(--idf-primary, #6478f7)" : "var(--idf-bg-subtle)",
        position: "relative",
      }}>
      <span style={{
        position: "absolute", top: 2, left: on ? 16 : 2,
        width: 12, height: 12, borderRadius: "50%",
        background: "white", transition: "left 0.15s",
      }} />
    </button>
  );
}

const inputStyle = { display: "block", width: "100%", padding: "6px 8px", fontSize: 13, border: "1px solid var(--idf-border)", borderRadius: 4, background: "var(--idf-surface, #fff)", color: "var(--idf-text)", boxSizing: "border-box" };
const smallInput = { ...inputStyle, padding: "4px 6px", fontSize: 12 };
const cellH = { padding: "6px 8px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--idf-text-muted)", borderBottom: "1px solid var(--idf-border)" };
const cellTd = { padding: "5px 8px", verticalAlign: "middle" };
const iconBtn = { padding: "2px 8px", fontSize: 14, border: "1px solid var(--idf-border)", background: "transparent", color: "var(--idf-text-muted)", borderRadius: 4, cursor: "pointer" };
const addBtn = { padding: "6px 14px", fontSize: 12, fontWeight: 500, border: "1px dashed var(--idf-primary, #6478f7)", background: "transparent", color: "var(--idf-primary, #6478f7)", borderRadius: 4, cursor: "pointer" };
