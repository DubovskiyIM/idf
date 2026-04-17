import React from "react";
import { Highlight, themes } from "prism-react-renderer";
import AppliesTo from "./AppliesTo.jsx";

// Inline-компонент подсветки синтаксиса через prism-react-renderer.
// Используется для trigger.match и structure.apply source. null-safe.
function CodeBlock({ code, language = "javascript" }) {
  if (!code) return null;
  return (
    <Highlight theme={themes.oneDark} code={code} language={language}>
      {({ className, style, tokens, getLineProps, getTokenProps }) => (
        <pre
          className={className}
          style={{
            ...style,
            padding: 12,
            fontSize: 12,
            borderRadius: 4,
            margin: 0,
            overflowX: "auto",
          }}
        >
          {tokens.map((line, i) => {
            const lineProps = getLineProps({ line });
            const { key: _lineKey, ...lineRest } = lineProps;
            return (
              <div key={i} {...lineRest}>
                {line.map((token, key) => {
                  const tokenProps = getTokenProps({ token });
                  const { key: _tokenKey, ...tokenRest } = tokenProps;
                  return <span key={key} {...tokenRest} />;
                })}
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
}

const SECTION_STYLE = { marginTop: 20 };
const H3_STYLE = {
  margin: "0 0 8px",
  fontSize: 13,
  color: "#e2e8f0",
  letterSpacing: 0.3,
  textTransform: "uppercase",
};
const H4_STYLE = {
  margin: "12px 0 6px",
  fontSize: 12,
  color: "#94a3b8",
  letterSpacing: 0.2,
};

// Средняя колонка: детальная карточка паттерна. Разделы:
// header | Trigger (таблица requires + match source) | Structure (slot +
// apply source) | Rationale (hypothesis + evidence + counterexample) |
// Falsification (shouldMatch/shouldNotMatch) | AppliesTo (live-скан).
// Скроллится независимо (overflowY:auto).
export default function PatternDetail({ pattern }) {
  if (!pattern) {
    return (
      <div style={{ padding: 20, color: "#64748b" }}>Select a pattern</div>
    );
  }

  const requires = pattern.trigger?.requires || [];
  const matchSource = pattern.trigger?.matchSource;
  const evidence = pattern.rationale?.evidence || [];
  const counterexample = pattern.rationale?.counterexample || [];
  const shouldMatch = pattern.falsification?.shouldMatch || [];
  const shouldNotMatch = pattern.falsification?.shouldNotMatch || [];

  return (
    <div
      style={{
        padding: 20,
        overflowY: "auto",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <h2 style={{ margin: 0, fontSize: 18, color: "#e0e7ff" }}>
        {pattern.id}{" "}
        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 400 }}>
          {pattern.status} / {pattern.archetype || "cross"} v{pattern.version}
        </span>
      </h2>

      <section style={SECTION_STYLE}>
        <h3 style={H3_STYLE}>Trigger</h3>
        {requires.length > 0 ? (
          <table
            style={{
              width: "100%",
              fontSize: 12,
              borderCollapse: "collapse",
              background: "#0b1220",
              border: "1px solid #1e293b",
            }}
          >
            <thead>
              <tr style={{ background: "#111827" }}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    color: "#94a3b8",
                    borderBottom: "1px solid #1e293b",
                    width: "30%",
                  }}
                >
                  kind
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "6px 8px",
                    color: "#94a3b8",
                    borderBottom: "1px solid #1e293b",
                  }}
                >
                  spec
                </th>
              </tr>
            </thead>
            <tbody>
              {requires.map((r, i) => (
                <tr key={i}>
                  <td
                    style={{
                      padding: "6px 8px",
                      borderBottom: "1px solid #1e293b",
                      verticalAlign: "top",
                    }}
                  >
                    <code style={{ color: "#fbbf24" }}>{r.kind}</code>
                  </td>
                  <td
                    style={{
                      padding: "6px 8px",
                      borderBottom: "1px solid #1e293b",
                      verticalAlign: "top",
                    }}
                  >
                    <code
                      style={{
                        color: "#cbd5e1",
                        fontSize: 11,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                      }}
                    >
                      {JSON.stringify(r)}
                    </code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ color: "#64748b", fontSize: 12 }}>
            Нет requires — триггер полностью в match().
          </div>
        )}
        {matchSource && (
          <>
            <h4 style={H4_STYLE}>match() source</h4>
            <CodeBlock code={matchSource} />
          </>
        )}
      </section>

      <section style={SECTION_STYLE}>
        <h3 style={H3_STYLE}>Structure</h3>
        <div>
          <b style={{ color: "#94a3b8" }}>slot:</b>{" "}
          <code style={{ color: "#fbbf24" }}>
            {pattern.structure?.slot ?? "—"}
          </code>
        </div>
        {pattern.structure?.description && (
          <div style={{ marginTop: 4, color: "#cbd5e1" }}>
            {pattern.structure.description}
          </div>
        )}
        {pattern.hasApply && (
          <>
            <h4 style={H4_STYLE}>apply() source</h4>
            <CodeBlock code={pattern.applySource} />
          </>
        )}
      </section>

      <section style={SECTION_STYLE}>
        <h3 style={H3_STYLE}>Rationale</h3>
        {pattern.rationale?.hypothesis && (
          <p style={{ margin: "0 0 6px" }}>
            <b style={{ color: "#94a3b8" }}>Hypothesis:</b>{" "}
            {pattern.rationale.hypothesis}
          </p>
        )}
        {evidence.length > 0 && (
          <>
            <h4 style={H4_STYLE}>Evidence</h4>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {evidence.map((e, i) => (
                <li key={i} style={{ marginBottom: 3 }}>
                  <b style={{ color: "#60a5fa" }}>{e.source}</b>
                  {e.reliability && (
                    <span style={{ color: "#64748b", fontSize: 11 }}>
                      {" "}
                      [{e.reliability}]
                    </span>
                  )}
                  {e.description && (
                    <span style={{ color: "#cbd5e1" }}>: {e.description}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {counterexample.length > 0 && (
          <>
            <h4 style={H4_STYLE}>Counterexample</h4>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {counterexample.map((e, i) => (
                <li key={i} style={{ marginBottom: 3 }}>
                  <b style={{ color: "#f87171" }}>{e.source}</b>
                  {e.reliability && (
                    <span style={{ color: "#64748b", fontSize: 11 }}>
                      {" "}
                      [{e.reliability}]
                    </span>
                  )}
                  {e.description && (
                    <span style={{ color: "#cbd5e1" }}>: {e.description}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section style={SECTION_STYLE}>
        <h3 style={H3_STYLE}>Falsification</h3>
        <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>
          <b>Should match:</b>
        </div>
        {shouldMatch.length > 0 ? (
          <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
            {shouldMatch.map((e, i) => (
              <li key={i} style={{ marginBottom: 3 }}>
                <code style={{ color: "#34d399" }}>
                  {e.domain}/{e.projection}
                </code>
                {e.reason && (
                  <span style={{ color: "#cbd5e1" }}>: {e.reason}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: "#64748b", fontSize: 12, marginBottom: 8 }}>—</div>
        )}
        <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>
          <b>Should not match:</b>
        </div>
        {shouldNotMatch.length > 0 ? (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {shouldNotMatch.map((e, i) => (
              <li key={i} style={{ marginBottom: 3 }}>
                <code style={{ color: "#f87171" }}>
                  {e.domain}/{e.projection}
                </code>
                {e.reason && (
                  <span style={{ color: "#cbd5e1" }}>: {e.reason}</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ color: "#64748b", fontSize: 12 }}>—</div>
        )}
      </section>

      <AppliesTo patternId={pattern.id} />
    </div>
  );
}
