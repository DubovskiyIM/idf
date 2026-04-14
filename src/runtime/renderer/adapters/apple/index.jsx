/**
 * Apple visionOS-glass UI-адаптер.
 * Третий после Mantine + shadcn-doodle.
 */
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as SelectPrimitive from "@radix-ui/react-select";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import {
  Pencil, Trash2, Plus, Check, X, MoreHorizontal, Search,
  ChevronDown, Pin, Reply, Send, Star, Bell, BellOff,
  Archive, Copy, Eye, Lock, Unlock, Settings, User, LogOut,
  Play, Square, Save, Download, Upload, RefreshCw, Filter,
  Calendar, Clock, Heart, ThumbsUp, ThumbsDown, Flag,
  MessageSquare, Phone, Video, Mic, MicOff, Volume2, VolumeX,
  Link, Unlink, Move, Maximize2, AlertTriangle, Info, HelpCircle,
  ArrowRight, ArrowLeft, Home, Target, Award, TrendingUp,
  Flame, Zap, BookOpen, Dumbbell, DollarSign, Briefcase, Users,
  Smile, Palette, Umbrella, Globe, Compass, CheckSquare,
  BarChart3, LineChart, PieChart, Lightbulb,
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
  "📊": BarChart3, "📉": LineChart, "🔬": PieChart, "💡": Lightbulb,
};

function resolveLucide(emoji) {
  if (!emoji) return null;
  return EMOJI_TO_LUCIDE[emoji] || null;
}

// ─── Shared input style ───
const inputStyle = {
  width: "100%",
  borderRadius: "var(--radius-apple-input)",
  border: "0.5px solid var(--color-apple-divider)",
  background: "rgba(255, 255, 255, 0.6)",
  padding: "10px 14px",
  fontFamily: "var(--font-apple)",
  fontSize: 15,
  color: "var(--color-apple-text)",
  outline: "none",
  transition: "all 0.2s",
};

const labelStyle = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--color-apple-text-secondary)",
  fontFamily: "var(--font-apple)",
  marginBottom: 4,
};

// ─── Parameter Controls ───

function AppleTextInput({ spec, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {spec.label && <label style={labelStyle}>{spec.label}</label>}
      <input
        type={spec.type === "email" ? "email" : spec.type === "url" ? "url" : spec.type === "tel" ? "tel" : "text"}
        style={inputStyle}
        placeholder={spec.placeholder || ""}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        required={spec.required}
      />
    </div>
  );
}

function AppleTextarea({ spec, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {spec.label && <label style={labelStyle}>{spec.label}</label>}
      <textarea
        style={{ ...inputStyle, minHeight: 80, resize: "vertical" }}
        placeholder={spec.placeholder || ""}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        rows={3}
      />
    </div>
  );
}

function AppleNumber({ spec, value, onChange }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {spec.label && <label style={labelStyle}>{spec.label}</label>}
      <input
        type="number"
        style={inputStyle}
        value={value ?? ""}
        onChange={e => onChange(e.target.value === "" ? null : Number(e.target.value))}
        min={spec.min}
        max={spec.max}
      />
    </div>
  );
}

function AppleDateTime({ spec, value, onChange }) {
  const isTimeOnly = spec.name && /time/i.test(spec.name) && !/date/i.test(spec.name);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {spec.label && <label style={labelStyle}>{spec.label}</label>}
      <input
        type={isTimeOnly ? "time" : "date"}
        style={inputStyle}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

function AppleSelect({ spec, value, onChange }) {
  const options = spec.options || [];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {spec.label && <label style={labelStyle}>{spec.label}</label>}
      <SelectPrimitive.Root value={value || ""} onValueChange={onChange}>
        <SelectPrimitive.Trigger
          style={{
            ...inputStyle,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer",
          }}
        >
          <SelectPrimitive.Value placeholder={spec.placeholder || "Выбрать..."} />
          <SelectPrimitive.Icon><ChevronDown size={16} color="var(--color-apple-text-secondary)" /></SelectPrimitive.Icon>
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            style={{
              background: "rgba(255,255,255,0.95)",
              backdropFilter: "blur(40px) saturate(180%)",
              WebkitBackdropFilter: "blur(40px) saturate(180%)",
              border: "0.5px solid var(--color-apple-divider)",
              borderRadius: "var(--radius-apple-input)",
              boxShadow: "var(--shadow-apple-glass)",
              zIndex: 9999,
              fontFamily: "var(--font-apple)",
              minWidth: 200,
            }}
            position="popper" sideOffset={4}
          >
            <SelectPrimitive.Viewport style={{ padding: 4 }}>
              {options.map(opt => (
                <SelectPrimitive.Item
                  key={opt.value || opt}
                  value={opt.value || opt}
                  style={{
                    padding: "8px 14px", borderRadius: 8, cursor: "pointer",
                    color: "var(--color-apple-text)", outline: "none", fontSize: 15,
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
  borderRadius: "var(--radius-apple-input)",
  fontFamily: "var(--font-apple)",
  cursor: "pointer",
  transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
  fontSize: 15,
  fontWeight: 600,
  border: "none",
};

function ApplePrimaryButton({ children, onClick, disabled, ...props }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        ...btnBase, padding: "10px 20px",
        background: "var(--color-apple-accent)", color: "white",
        boxShadow: "0 1px 3px rgba(0, 122, 255, 0.3)",
        opacity: disabled ? 0.4 : 1,
      }}
      {...props}
    >{children}</button>
  );
}

function AppleSecondaryButton({ children, onClick, disabled, ...props }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        ...btnBase, padding: "10px 20px",
        background: "rgba(0, 122, 255, 0.1)", color: "var(--color-apple-accent)",
        opacity: disabled ? 0.4 : 1,
      }}
      {...props}
    >{children}</button>
  );
}

function AppleDangerButton({ children, onClick, disabled, ...props }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        ...btnBase, padding: "10px 20px",
        background: "var(--color-apple-danger)", color: "white",
        boxShadow: "0 1px 3px rgba(255, 59, 48, 0.3)",
        opacity: disabled ? 0.4 : 1,
      }}
      {...props}
    >{children}</button>
  );
}

function AppleIntentButton({ spec, onClick, disabled }) {
  const Icon = spec.icon ? resolveLucide(spec.icon) : null;
  const label = spec.label || spec.intentId;
  const isDanger = spec.irreversibility === "high" || spec.variant === "danger";
  const isPrimary = spec.variant === "primary";

  const bg = isDanger ? "rgba(255, 59, 48, 0.1)"
           : isPrimary ? "var(--color-apple-accent)"
           : "rgba(0, 122, 255, 0.08)";
  const color = isDanger ? "var(--color-apple-danger)"
              : isPrimary ? "white"
              : "var(--color-apple-accent)";

  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{
        ...btnBase, display: "inline-flex", alignItems: "center", gap: 6,
        padding: "8px 14px", fontSize: 14,
        background: bg, color: color,
        opacity: disabled ? 0.4 : 1,
      }}
      title={label}
    >
      {Icon && <Icon size={16} />}
      <span>{label}</span>
    </button>
  );
}

function AppleOverflowMenu({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button style={{
          ...btnBase, padding: 8,
          background: "rgba(0, 0, 0, 0.04)", color: "var(--color-apple-text-secondary)",
          width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end" collisionPadding={16}
          style={{
            background: "rgba(255,255,255,0.95)",
            backdropFilter: "blur(40px) saturate(180%)",
            WebkitBackdropFilter: "blur(40px) saturate(180%)",
            border: "0.5px solid var(--color-apple-divider)",
            borderRadius: "var(--radius-apple-input)",
            boxShadow: "var(--shadow-apple-glass)",
            padding: 4, zIndex: 9999, fontFamily: "var(--font-apple)",
            minWidth: 180, maxWidth: "90vw",
          }}
          sideOffset={6}
        >
          {items.map((item, i) => {
            if (item.divider) return <DropdownMenu.Separator key={item.key} style={{ height: 0.5, background: "var(--color-apple-divider)", margin: "4px 0" }} />;
            const IconCmp = item.icon ? resolveLucide(item.icon) : null;
            return (
              <DropdownMenu.Item
                key={item.key || i}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 8, fontSize: 15,
                  color: "var(--color-apple-text)", outline: "none", cursor: "pointer",
                }}
                onSelect={() => item.onClick?.()}
              >
                {IconCmp && <IconCmp size={16} />}
                <span>{item.label}</span>
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

// ─── Shell ───

function AppleModalShell({ opened, onClose, title, children }) {
  return (
    <Dialog.Root open={opened} onOpenChange={v => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)", zIndex: 9999,
        }} />
        <Dialog.Content style={{
          position: "fixed", left: "50%", top: "50%",
          transform: "translate(-50%, -50%)", zIndex: 9999,
          width: "calc(100% - 32px)", maxWidth: 480, maxHeight: "85vh",
          overflowY: "auto",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          border: "1px solid var(--color-apple-glass-border)",
          borderRadius: "var(--radius-apple)",
          padding: 24,
          fontFamily: "var(--font-apple)",
          boxShadow: "var(--shadow-apple-glass)",
        }}>
          <Dialog.Title style={{
            fontSize: 22, fontWeight: 700,
            color: "var(--color-apple-text)",
            marginBottom: 16, marginTop: 0,
          }}>
            {title}
          </Dialog.Title>
          {children}
          <Dialog.Close asChild>
            <button style={{
              position: "absolute", top: 16, right: 16, background: "rgba(0,0,0,0.04)",
              border: "none", color: "var(--color-apple-text-secondary)", cursor: "pointer",
              padding: 6, borderRadius: 12, width: 28, height: 28,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <X size={16} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AppleTabs({ tabs, value, onChange }) {
  return (
    <TabsPrimitive.Root value={value} onValueChange={onChange}>
      <TabsPrimitive.List style={{
        display: "inline-flex",
        background: "rgba(0,0,0,0.05)",
        borderRadius: 10,
        padding: 2,
        fontFamily: "var(--font-apple)",
        gap: 0,
      }}>
        {tabs.map(tab => (
          <TabsPrimitive.Trigger
            key={tab.value}
            value={tab.value}
            style={{
              padding: "6px 14px", fontSize: 13, whiteSpace: "nowrap",
              background: "transparent", border: "none", cursor: "pointer",
              fontFamily: "inherit", borderRadius: 8,
              color: "var(--color-apple-text-secondary)",
              fontWeight: 500,
              transition: "all 0.2s",
            }}
            data-state-active-style="background: white; color: var(--color-apple-text); box-shadow: 0 1px 3px rgba(0,0,0,0.08);"
          >
            {tab.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
    </TabsPrimitive.Root>
  );
}

// ─── Primitives ───

function AppleHeading({ children, level = 2, ...props }) {
  const Tag = `h${Math.min(level, 6)}`;
  const sizes = { 1: 34, 2: 28, 3: 22, 4: 17, 5: 15, 6: 13 };
  return (
    <Tag style={{
      fontSize: sizes[level] || 22,
      fontWeight: 700,
      fontFamily: "var(--font-apple)",
      color: "var(--color-apple-text)",
      letterSpacing: "-0.02em",
      lineHeight: 1.2,
      margin: 0,
    }} {...props}>
      {children}
    </Tag>
  );
}

function AppleText({ children, preset, ...props }) {
  const colors = {
    dimmed: "var(--color-apple-text-secondary)",
    accent: "var(--color-apple-accent)",
    danger: "var(--color-apple-danger)",
    success: "var(--color-apple-success)",
  };
  return (
    <span style={{
      fontFamily: "var(--font-apple)",
      color: colors[preset] || "var(--color-apple-text)",
      fontSize: 15,
    }} {...props}>
      {children}
    </span>
  );
}

function AppleBadge({ children, color, ...props }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "3px 10px", borderRadius: 999,
      fontSize: 12, fontWeight: 600, fontFamily: "var(--font-apple)",
      background: color ? `${color}22` : "rgba(0, 122, 255, 0.1)",
      color: color || "var(--color-apple-accent)",
    }} {...props}>
      {children}
    </span>
  );
}

function AppleAvatar({ src, name, size = 32, ...props }) {
  const initials = (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <AvatarPrimitive.Root style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      borderRadius: "50%", overflow: "hidden",
      background: "linear-gradient(135deg, var(--color-apple-accent), var(--color-apple-violet))",
      fontFamily: "var(--font-apple)",
      width: size, height: size,
    }} {...props}>
      <AvatarPrimitive.Image src={src} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <AvatarPrimitive.Fallback style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        width: "100%", height: "100%",
        color: "white", fontSize: Math.round(size * 0.4), fontWeight: 600,
      }}>
        {initials}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

function ApplePaper({ children, ...props }) {
  return (
    <div style={{
      borderRadius: "var(--radius-apple)",
      border: "1px solid var(--color-apple-glass-border)",
      background: "var(--color-apple-glass-bg)",
      backdropFilter: "blur(40px) saturate(180%)",
      WebkitBackdropFilter: "blur(40px) saturate(180%)",
      padding: 20,
      boxShadow: "var(--shadow-apple-glass)",
    }} {...props}>
      {children}
    </div>
  );
}

// ─── Adapter Export ───

export const appleAdapter = {
  parameter: {
    text: AppleTextInput,
    textarea: AppleTextarea,
    email: AppleTextInput,
    url: AppleTextInput,
    tel: AppleTextInput,
    number: AppleNumber,
    datetime: AppleDateTime,
    select: AppleSelect,
  },
  button: {
    primary: ApplePrimaryButton,
    secondary: AppleSecondaryButton,
    danger: AppleDangerButton,
    intent: AppleIntentButton,
    overflow: AppleOverflowMenu,
  },
  shell: {
    modal: AppleModalShell,
    tabs: AppleTabs,
  },
  primitive: {
    heading: AppleHeading,
    text: AppleText,
    badge: AppleBadge,
    avatar: AppleAvatar,
    paper: ApplePaper,
  },
  icon: {
    resolve: resolveLucide,
  },
};
