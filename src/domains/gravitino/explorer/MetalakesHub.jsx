/**
 * MetalakesHub — canvas root для metalake_list (U5.5).
 *
 * Заменяет SDK dataGrid: dialogs (SetOwner, typed-name Confirm),
 * inline toast (auto-dismiss 2.5s).
 *
 * Click name → navigate в /gravitino/metalake_workspace?metalakeId=<id>.
 *
 * U-backend-exec: Drop metalake через exec({intent:"dropMetalake"}) — generic
 * handler применяет particles.effects (Metalake op=remove). Локальный
 * deletedIds-state удалён.
 *
 * U-backend-exec-2: setOwner + enable/disable через exec — custom
 * buildEffects в gravitino/domain.js собирает full-entity overwrite
 * (α:'add' с тем же id) на metalakes коллекции. Локальные ownerOverrides
 * / inUseOverrides удалены — fold обновляет world.metalakes напрямую.
 */
import { useEffect, useState } from "react";
import MetalakesTable from "./MetalakesTable.jsx";
import SetOwnerDialog from "./SetOwnerDialog.jsx";

export default function MetalakesHub({ world = {}, ctx, navigate, exec = () => {} }) {
  const baseMetalakes = world.metalakes || [];
  const users = world.users || [];
  const groups = world.groups || [];

  const [setOwnerTarget, setSetOwnerTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null); // { msg, tone }

  const showToast = (msg, tone = "info") => {
    setToast({ msg, tone, ts: Date.now() });
  };

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const onSelect = (m) => {
    // Navigate в workspace через V2Shell navigate prop (если доступен)
    // либо ctx.navigate, либо window.location fallback.
    if (typeof navigate === "function") {
      navigate("metalake_workspace", { metalakeId: m.id });
    } else if (ctx?.navigate) {
      ctx.navigate("metalake_workspace", { metalakeId: m.id });
    } else if (typeof window !== "undefined") {
      window.location.href = `/gravitino/metalake_workspace?metalakeId=${encodeURIComponent(m.id)}`;
    }
  };

  const onToggleInUse = (id, next) => {
    const m = baseMetalakes.find(x => x.id === id);
    if (!m) return;
    exec({
      intent: next ? "enableMetalake" : "disableMetalake",
      params: { name: m.name },
      context: { entity: m },
    });
    showToast(`Metalake ${next ? "включён" : "приостановлен"}`, next ? "success" : "warning");
  };

  const handleSetOwner = ({ name }) => {
    if (!setOwnerTarget) return;
    const m = baseMetalakes.find(x => x.id === setOwnerTarget);
    if (!m) return;
    exec({
      intent: "setOwner",
      params: { metalake: m.name, metadataObjectType: "metalake", metadataObjectFullName: m.name },
      context: { entity: m, entityType: "metalakes", newOwnerName: name },
    });
    showToast(`Owner назначен: ${name}`, "success");
    setSetOwnerTarget(null);
  };

  const targetMetalake = setOwnerTarget && baseMetalakes.find(m => m.id === setOwnerTarget);

  return (
    <div style={{ padding: 16, height: "100%", overflow: "auto", color: "var(--idf-text)" }}>
      <h2 style={{ margin: "0 0 16px", fontSize: 18, fontWeight: 600, color: "var(--idf-text)" }}>
        Metalakes
      </h2>
      <MetalakesTable
        metalakes={baseMetalakes}
        onSelect={onSelect}
        onSetOwner={(id) => setSetOwnerTarget(id)}
        onToggleInUse={onToggleInUse}
        onDelete={(m) => setDeleteTarget(m)}
      />
      <SetOwnerDialog
        visible={!!setOwnerTarget}
        currentOwner={targetMetalake?.owner}
        users={users}
        groups={groups}
        onClose={() => setSetOwnerTarget(null)}
        onSubmit={handleSetOwner}
      />
      {deleteTarget && (
        <ConfirmDeleteDialog
          metalakeName={deleteTarget.name}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            const name = deleteTarget.name;
            exec({
              intent: "dropMetalake",
              params: { name },
              context: {},
            });
            showToast(`Metalake «${name}» удалён`, "error");
            setDeleteTarget(null);
          }}
        />
      )}
      {toast && <ToastBanner toast={toast} />}
    </div>
  );
}

/**
 * ConfirmDeleteDialog — typed-name confirm pattern (D6 ergonomic-laws).
 * Кнопка Confirm активна только когда введённое имя строго совпадает с
 * именем metalake — predator-protection от случайного click'а.
 */
function ConfirmDeleteDialog({ metalakeName, onCancel, onConfirm }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === metalakeName;
  return (
    <div
      role="dialog"
      aria-label="Delete metalake"
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.4)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onCancel}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--idf-card, #fff)",
          color: "var(--idf-text)",
          border: "1px solid var(--idf-border, #e5e7eb)",
          borderRadius: 8, padding: 18, width: 380,
          boxShadow: "0 16px 48px rgba(0,0,0,0.2)",
        }}
      >
        <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#FF3E1D" }}>Delete metalake</h3>
        <div style={{ fontSize: 13, marginBottom: 10 }}>
          Удаление metalake <b>«{metalakeName}»</b> — необратимое действие. Все каталоги и схемы внутри будут потеряны.
        </div>
        <div style={{ fontSize: 12, color: "var(--idf-text-muted)", marginBottom: 4 }}>
          Введите имя для подтверждения:
        </div>
        <input
          type="text"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          placeholder={metalakeName}
          autoFocus
          style={{
            width: "100%", padding: "5px 8px", fontSize: 12, marginBottom: 12,
            border: "1px solid var(--idf-border, #e5e7eb)", borderRadius: 4,
            background: "var(--idf-surface, #fff)", color: "var(--idf-text)",
            boxSizing: "border-box",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "5px 12px", fontSize: 11, borderRadius: 4,
              border: "1px solid var(--idf-border)", background: "transparent",
              cursor: "pointer", color: "var(--idf-text-muted)",
            }}
          >Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!matches}
            style={{
              padding: "5px 12px", fontSize: 11, borderRadius: 4, fontWeight: 600,
              border: "1px solid #FF3E1D",
              background: matches ? "#FF3E1D" : "rgba(255,62,29,0.4)",
              color: "white", cursor: matches ? "pointer" : "not-allowed",
            }}
          >Delete</button>
        </div>
      </div>
    </div>
  );
}

function ToastBanner({ toast }) {
  const colors = {
    success: { bg: "#71DD37", text: "#fff" },
    warning: { bg: "#FFAB00", text: "#fff" },
    error:   { bg: "#FF3E1D", text: "#fff" },
    info:    { bg: "#03C3EC", text: "#fff" },
  }[toast.tone] || { bg: "#03C3EC", text: "#fff" };
  return (
    <div
      role="status"
      style={{
        position: "fixed", bottom: 24, right: 24, zIndex: 300,
        padding: "8px 14px", fontSize: 13, fontWeight: 500,
        background: colors.bg, color: colors.text,
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
      }}
    >{toast.msg}</div>
  );
}
