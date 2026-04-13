/**
 * shadcn/ui адаптер — doodle-стилистика для lifequest.
 * Заменяет Mantine-адаптер через registerUIAdapter(shadcnAdapter).
 * Все компоненты стилизованы через Tailwind + doodle CSS variables.
 */
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { clsx } from "clsx";
import {
  Pencil, Trash2, Plus, Check, X, MoreHorizontal, Search,
  ChevronDown, Pin, PinOff, Reply, Send, Star, Bell, BellOff,
  Archive, Copy, Eye, Lock, Unlock, Settings, User, LogOut,
  Play, Square, Save, Download, Upload, RefreshCw, Filter,
  Calendar, Clock, Heart, ThumbsUp, ThumbsDown, Flag,
  MessageSquare, Phone, Video, Mic, MicOff, Volume2, VolumeX,
  Link, Unlink, Move, Maximize2, AlertTriangle, Info, HelpCircle,
  ArrowRight, ArrowLeft, Home, Target, Award, TrendingUp,
  Flame, Zap, BookOpen, Dumbbell, DollarSign, Briefcase, Users,
  Smile, Palette, Umbrella, Globe, Compass, CheckSquare,
} from "lucide-react";
import "./theme.css";

// ─── EMOJI → LUCIDE ───

const EMOJI_TO_LUCIDE = {
  "✎": Pencil, "✏️": Pencil, "🗑": Trash2, "🗑️": Trash2,
  "➕": Plus, "+": Plus, "✓": Check, "✔": Check, "✔️": Check,
  "✕": X, "✗": X, "❌": X, "⋯": MoreHorizontal, "…": MoreHorizontal,
  "🔍": Search, "📌": Pin, "📍": Pin, "↩": Reply, "↩️": Reply,
  "📤": Send, "⭐": Star, "🔔": Bell, "🔕": BellOff,
  "📦": Archive, "📋": Copy, "👁": Eye, "🔒": Lock, "🔓": Unlock,
  "⚙": Settings, "⚙️": Settings, "👤": User, "🚪": LogOut,
  "▶": Play, "⏹": Square, "💾": Save, "📥": Download, "📤": Upload,
  "🔄": RefreshCw, "🔃": RefreshCw, "🗂": Filter,
  "📅": Calendar, "🕐": Clock, "❤️": Heart, "👍": ThumbsUp, "👎": ThumbsDown,
  "🚩": Flag, "💬": MessageSquare, "📞": Phone, "📹": Video,
  "🎤": Mic, "🔇": MicOff, "🔊": Volume2, "🔈": VolumeX,
  "🔗": Link, "✂": Unlink, "↔": Move, "⤢": Maximize2,
  "⚠": AlertTriangle, "⚠️": AlertTriangle, "ℹ": Info, "ℹ️": Info, "❓": HelpCircle,
  "→": ArrowRight, "←": ArrowLeft, "🏠": Home,
  "🎯": Target, "🏆": Award, "📈": TrendingUp,
  "🔥": Flame, "⚡": Zap, "📚": BookOpen, "💪": Dumbbell,
  "💰": DollarSign, "💼": Briefcase, "🤝": Users,
  "🧘": Smile, "🎨": Palette, "🏖️": Umbrella, "🌍": Globe, "🧭": Compass,
  "✅": CheckSquare, "☐": CheckSquare,
};

function resolveLucide(emoji) {
  if (!emoji) return null;
  return EMOJI_TO_LUCIDE[emoji] || null;
}

// ─── Shared styles ───

const inputBase = [
  "w-full rounded-[var(--radius-doodle)] border-2 border-dashed",
  "border-[var(--color-doodle-border)] bg-[var(--color-doodle-bg)]",
  "px-3 py-2 font-[var(--font-doodle)] text-[var(--color-doodle-ink)]",
  "placeholder:text-[var(--color-doodle-ink-light)]/50",
  "focus:outline-none focus:border-[var(--color-doodle-accent)] transition-colors",
].join(" ");

// ─── Parameter Controls ───

function ShadcnTextInput({ spec, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {spec.label && <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-doodle-ink-light)", fontFamily: "var(--font-doodle)" }}>{spec.label}</label>}
      <input
        type={spec.type === "email" ? "email" : spec.type === "url" ? "url" : spec.type === "tel" ? "tel" : "text"}
        style={{
          width: "100%", borderRadius: "var(--radius-doodle)",
          border: "2px dashed var(--color-doodle-border)",
          background: "var(--color-doodle-bg)",
          padding: "8px 12px", fontFamily: "var(--font-doodle)",
          color: "var(--color-doodle-ink)", fontSize: 14,
          outline: "none",
        }}
        placeholder={spec.placeholder || ""}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        required={spec.required}
      />
    </div>
  );
}

function ShadcnTextarea({ spec, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {spec.label && <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-doodle-ink-light)", fontFamily: "var(--font-doodle)" }}>{spec.label}</label>}
      <textarea
        style={{
          width: "100%", borderRadius: "var(--radius-doodle)",
          border: "2px dashed var(--color-doodle-border)",
          background: "var(--color-doodle-bg)",
          padding: "8px 12px", fontFamily: "var(--font-doodle)",
          color: "var(--color-doodle-ink)", fontSize: 14,
          minHeight: 80, resize: "vertical", outline: "none",
        }}
        placeholder={spec.placeholder || ""}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        rows={3}
      />
    </div>
  );
}

function ShadcnNumber({ spec, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {spec.label && <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-doodle-ink-light)", fontFamily: "var(--font-doodle)" }}>{spec.label}</label>}
      <input
        type="number"
        style={{
          width: "100%", borderRadius: "var(--radius-doodle)",
          border: "2px dashed var(--color-doodle-border)",
          background: "var(--color-doodle-bg)",
          padding: "8px 12px", fontFamily: "var(--font-doodle)",
          color: "var(--color-doodle-ink)", fontSize: 14, outline: "none",
        }}
        value={value ?? ""}
        onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
        min={spec.min}
        max={spec.max}
      />
    </div>
  );
}

function ShadcnDateTime({ spec, value, onChange }) {
  const isTimeOnly = spec.name && /time/i.test(spec.name) && !/date/i.test(spec.name);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {spec.label && <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-doodle-ink-light)", fontFamily: "var(--font-doodle)" }}>{spec.label}</label>}
      <input
        type={isTimeOnly ? "time" : "date"}
        style={{
          width: "100%", borderRadius: "var(--radius-doodle)",
          border: "2px dashed var(--color-doodle-border)",
          background: "var(--color-doodle-bg)",
          padding: "8px 12px", fontFamily: "var(--font-doodle)",
          color: "var(--color-doodle-ink)", fontSize: 14, outline: "none",
        }}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function ShadcnSelect({ spec, value, onChange }) {
  const options = spec.options || [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {spec.label && <label style={{ fontSize: 13, fontWeight: 500, color: "var(--color-doodle-ink-light)", fontFamily: "var(--font-doodle)" }}>{spec.label}</label>}
      <SelectPrimitive.Root value={value || ""} onValueChange={onChange}>
        <SelectPrimitive.Trigger
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", borderRadius: "var(--radius-doodle)",
            border: "2px dashed var(--color-doodle-border)",
            background: "var(--color-doodle-bg)",
            padding: "8px 12px", fontFamily: "var(--font-doodle)",
            color: "var(--color-doodle-ink)", fontSize: 14, cursor: "pointer",
          }}
        >
          <SelectPrimitive.Value placeholder={spec.placeholder || "Выбрать..."} />
          <SelectPrimitive.Icon><ChevronDown size={16} /></SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            style={{
              background: "var(--color-doodle-bg)",
              border: "2px solid var(--color-doodle-border)",
              borderRadius: "var(--radius-doodle)",
              boxShadow: "4px 4px 0 var(--color-doodle-border)",
              zIndex: 50, fontFamily: "var(--font-doodle)",
            }}
            position="popper" sideOffset={4}
          >
            <SelectPrimitive.Viewport style={{ padding: 4 }}>
              {options.map(opt => (
                <SelectPrimitive.Item
                  key={opt.value || opt}
                  value={opt.value || opt}
                  style={{
                    padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                    color: "var(--color-doodle-ink)", outline: "none", fontSize: 14,
                  }}
                >
                  <SelectPrimitive.ItemText>{opt.label || opt}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
    </div>
  );
}

// ─── Buttons ───

const btnBase = {
  borderRadius: "var(--radius-doodle)",
  fontFamily: "var(--font-doodle)",
  cursor: "pointer",
  transition: "all 0.15s",
  border: "2px solid",
  fontSize: 14,
};

function ShadcnPrimaryButton({ children, onClick, disabled, ...props }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        ...btnBase, padding: "8px 16px", fontWeight: 700,
        background: "var(--color-doodle-accent)", color: "white",
        borderColor: "var(--color-doodle-accent)",
        boxShadow: "2px 2px 0 var(--color-doodle-ink)",
        opacity: disabled ? 0.5 : 1,
      }}
      {...props}
    >{children}</button>
  );
}

function ShadcnSecondaryButton({ children, onClick, disabled, ...props }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        ...btnBase, padding: "8px 16px",
        background: "transparent", color: "var(--color-doodle-ink)",
        borderColor: "var(--color-doodle-border)", borderStyle: "dashed",
        opacity: disabled ? 0.5 : 1,
      }}
      {...props}
    >{children}</button>
  );
}

function ShadcnDangerButton({ children, onClick, disabled, ...props }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        ...btnBase, padding: "8px 16px", fontWeight: 700,
        background: "var(--color-doodle-warn)", color: "white",
        borderColor: "var(--color-doodle-warn)",
        boxShadow: "2px 2px 0 var(--color-doodle-ink)",
        opacity: disabled ? 0.5 : 1,
      }}
      {...props}
    >{children}</button>
  );
}

function ShadcnIntentButton({ spec, onClick, disabled }) {
  const Icon = spec.icon ? resolveLucide(spec.icon) : null;
  const label = spec.label || spec.intentId;
  const isDanger = spec.irreversibility === "high" || spec.variant === "danger";

  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        ...btnBase, display: "inline-flex", alignItems: "center", gap: 6,
        padding: "6px 12px", fontSize: 13,
        background: "transparent",
        color: isDanger ? "var(--color-doodle-warn)" : "var(--color-doodle-ink)",
        borderColor: isDanger ? "var(--color-doodle-warn)" : "var(--color-doodle-border)",
        borderStyle: isDanger ? "solid" : "dashed",
        opacity: disabled ? 0.5 : 1,
      }}
      title={label}
    >
      {Icon && <Icon size={16} />}
      <span>{label}</span>
    </button>
  );
}

function ShadcnOverflowMenu({ spec }) {
  const children = spec.children || [];
  if (children.length === 0) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button style={{
          ...btnBase, padding: 8, background: "transparent",
          color: "var(--color-doodle-ink)",
          borderColor: "var(--color-doodle-border)", borderStyle: "dashed",
        }}>
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          style={{
            background: "var(--color-doodle-bg)",
            border: "2px solid var(--color-doodle-border)",
            borderRadius: "var(--radius-doodle)",
            boxShadow: "4px 4px 0 var(--color-doodle-border)",
            padding: 4, zIndex: 50, fontFamily: "var(--font-doodle)",
            minWidth: 160,
          }}
          sideOffset={4}
        >
          {children.map((child, i) => {
            const Icon = child.icon ? resolveLucide(child.icon) : null;
            return (
              <DropdownMenu.Item
                key={child.intentId || i}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "8px 12px", borderRadius: 8, fontSize: 13,
                  color: "var(--color-doodle-ink)", outline: "none", cursor: "pointer",
                }}
                onSelect={() => child.onClick?.()}
              >
                {Icon && <Icon size={14} />}
                <span>{child.label || child.intentId}</span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ─── Shell ───

function ShadcnModalShell({ opened, onClose, title, children }) {
  return (
    <Dialog.Root open={opened} onOpenChange={v => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(4px)", zIndex: 50,
        }} />
        <Dialog.Content style={{
          position: "fixed", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)", zIndex: 50,
          width: "calc(100% - 32px)", maxWidth: 420, maxHeight: "85vh",
          overflowY: "auto",
          background: "var(--color-doodle-bg)",
          border: "2px solid var(--color-doodle-border)",
          borderRadius: "var(--radius-doodle)",
          padding: "var(--spacing-doodle)",
          fontFamily: "var(--font-doodle)",
          boxShadow: "4px 4px 0 var(--color-doodle-ink)",
        }}>
          <Dialog.Title style={{
            fontSize: 18, fontWeight: 700,
            color: "var(--color-doodle-ink)",
            textDecoration: "underline", textDecorationStyle: "wavy",
            textDecorationColor: "var(--color-doodle-border)",
            textUnderlineOffset: 4, marginBottom: 16,
          }}>
            {title}
          </Dialog.Title>
          {children}
          <Dialog.Close asChild>
            <button style={{
              position: "absolute", top: 12, right: 12, background: "none",
              border: "none", color: "var(--color-doodle-ink-light)", cursor: "pointer",
              padding: 4,
            }}>
              <X size={18} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ShadcnTabs({ tabs, value, onChange }) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onChange}>
      <TabsPrimitive.List style={{
        display: "flex", borderBottom: "2px dashed var(--color-doodle-border)",
        fontFamily: "var(--font-doodle)", overflowX: "auto", gap: 0,
      }}>
        {tabs.map(tab => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            style={{
              padding: "8px 16px", fontSize: 13, whiteSpace: "nowrap",
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "inherit",
              borderBottom: "2px solid transparent", marginBottom: -2,
              color: "var(--color-doodle-ink-light)",
            }}
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}

// ─── Primitives ───

function ShadcnHeading({ children, level = 2, ...props }) {
  const Tag = `h${Math.min(level, 6)}`;
  const sizes = { 1: 24, 2: 20, 3: 18, 4: 16, 5: 14, 6: 13 };
  return (
    <Tag style={{
      fontSize: sizes[level] || 18, fontWeight: 700,
      fontFamily: "var(--font-doodle)", color: "var(--color-doodle-ink)",
      textDecoration: "underline", textDecorationStyle: "wavy",
      textDecorationColor: "var(--color-doodle-border)",
      textUnderlineOffset: 4, margin: 0,
    }} {...props}>
      {children}
    </Tag>
  );
}

function ShadcnText({ children, preset, ...props }) {
  const colors = {
    dimmed: "var(--color-doodle-ink-light)",
    accent: "var(--color-doodle-accent)",
    danger: "var(--color-doodle-warn)",
    success: "var(--color-doodle-accent)",
  };
  return (
    <span style={{
      fontFamily: "var(--font-doodle)",
      color: colors[preset] || "var(--color-doodle-ink)",
    }} {...props}>
      {children}
    </span>
  );
}

function ShadcnBadge({ children, color, ...props }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 20,
      fontSize: 12, fontWeight: 700, fontFamily: "var(--font-doodle)",
      border: `2px solid ${color || "var(--color-doodle-border)"}`,
      background: "var(--color-doodle-highlight)",
      color: color || "var(--color-doodle-ink)",
    }} {...props}>
      {children}
    </span>
  );
}

function ShadcnAvatar({ src, name, size = 32, ...props }) {
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <AvatarPrimitive.Root style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      borderRadius: "50%", overflow: "hidden",
      border: "2px solid var(--color-doodle-border)",
      background: "var(--color-doodle-highlight)",
      fontFamily: "var(--font-doodle)",
      width: size, height: size,
    }} {...props}>
      <AvatarPrimitive.Image src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <AvatarPrimitive.Fallback style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "100%", height: "100%",
        color: "var(--color-doodle-ink)", fontSize: Math.round(size * 0.4), fontWeight: 700,
      }}>
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

function ShadcnPaper({ children, ...props }) {
  return (
    <div style={{
      borderRadius: "var(--radius-doodle)",
      border: "2px dashed var(--color-doodle-border)",
      background: "var(--color-doodle-bg)",
      padding: "var(--spacing-doodle)",
      boxShadow: "2px 2px 0 var(--color-doodle-border)",
    }} {...props}>
      {children}
    </div>
  );
}

// ─── Adapter Export ───

export const shadcnAdapter = {
  parameter: {
    text: ShadcnTextInput,
    textarea: ShadcnTextarea,
    email: ShadcnTextInput,
    url: ShadcnTextInput,
    tel: ShadcnTextInput,
    number: ShadcnNumber,
    datetime: ShadcnDateTime,
    select: ShadcnSelect,
  },
  button: {
    primary: ShadcnPrimaryButton,
    secondary: ShadcnSecondaryButton,
    danger: ShadcnDangerButton,
    intent: ShadcnIntentButton,
    overflow: ShadcnOverflowMenu,
  },
  shell: {
    modal: ShadcnModalShell,
    tabs: ShadcnTabs,
  },
  primitive: {
    heading: ShadcnHeading,
    text: ShadcnText,
    badge: ShadcnBadge,
    avatar: ShadcnAvatar,
    paper: ShadcnPaper,
  },
  icon: {
    resolve: resolveLucide,
  },
};
