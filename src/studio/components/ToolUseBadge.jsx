import React, { useState } from "react";
import ReactDiffViewer from "react-diff-viewer-continued";

export default function ToolUseBadge({ use, result }) {
  const [open, setOpen] = useState(false);
  const file = use.input?.file_path || use.input?.path;
  const short = file ? file.split("/").slice(-2).join("/") : "";
  const isEdit = use.name === "Edit";
  const ok = result?.success !== false;

  return (
    <div style={{ margin: "4px 0", padding: "4px 8px", background: "#0f172a", border: "1px solid #334155", borderRadius: 3, fontSize: 11 }}>
      <div style={{ display: "flex", justifyContent: "space-between", cursor: isEdit ? "pointer" : "default" }} onClick={() => isEdit && setOpen(!open)}>
        <span>{ok ? "✓" : "✗"} <b>{use.name}</b> {short}</span>
        {isEdit && <span style={{ color: "#64748b" }}>{open ? "▼" : "▶"}</span>}
      </div>
      {open && isEdit && use.input?.old_string !== undefined && (
        <div style={{ marginTop: 6, maxHeight: 220, overflow: "auto" }}>
          <ReactDiffViewer
            oldValue={use.input.old_string}
            newValue={use.input.new_string || ""}
            splitView={false}
            useDarkTheme={true}
            hideLineNumbers={true}
          />
        </div>
      )}
    </div>
  );
}
