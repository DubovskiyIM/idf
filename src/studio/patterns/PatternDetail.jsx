import React from "react";

// Stub: наполнение в следующих тасках (B6+).
export default function PatternDetail({ pattern }) {
  if (!pattern) {
    return (
      <div style={{ padding: 20, color: "#888" }}>Select a pattern</div>
    );
  }
  return <div style={{ padding: 20 }}>{pattern.id}</div>;
}
