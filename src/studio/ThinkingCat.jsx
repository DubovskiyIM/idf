import React, { useState, useEffect } from "react";

const SIZE = 180;

export default function ThinkingCat({ visible }) {
  const [imgBroken, setImgBroken] = useState(false);

  useEffect(() => {
    if (visible) setImgBroken(false);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        left: 16,
        width: SIZE,
        height: SIZE,
        zIndex: 9,
        borderRadius: 8,
        overflow: "hidden",
        background: "#0f172a",
        border: "1px solid #334155",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
      aria-label="агент думает"
    >
      {imgBroken ? (
        <div style={{ fontSize: 56, animation: "cat-pulse 1.2s ease-in-out infinite" }}>🐱</div>
      ) : (
        <img
          src="/cat.gif"
          alt="thinking cat"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          onError={() => setImgBroken(true)}
        />
      )}
      <style>{`
        @keyframes cat-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.15); }
        }
      `}</style>
    </div>
  );
}
