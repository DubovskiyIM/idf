/**
 * Mantine UI-адаптер (§17 манифеста — адаптивный слой).
 *
 * Мапит declarative control-specs в компоненты @mantine/core и @mantine/dates.
 * Регистрируется один раз при bootstrap приложения через
 * `registerUIAdapter(mantineAdapter)`.
 *
 * Категории (ключи adapter'а):
 *   - parameter: text/textarea/datetime/email/... — формы
 *   - button:    primary/secondary/danger — кнопки
 */

import {
  TextInput,
  Textarea,
  NumberInput,
  Select,
  Button,
  ActionIcon,
  Modal,
  Tabs,
  Title,
  Text,
  Badge,
  Avatar,
  Paper,
  Menu,
} from "@mantine/core";
import { DateInput, TimeInput } from "@mantine/dates";
import Icon from "../Icon.jsx";
import {
  Pencil,
  Trash2,
  Plus,
  Check,
  X,
  Send,
  Paperclip,
  Mic,
  Image as ImageIcon,
  Video,
  MapPin,
  Vote,
  CornerUpRight,
  BookmarkPlus,
  Bookmark,
  Pin,
  PinOff,
  Copy,
  Languages,
  BellOff,
  Bell,
  Phone,
  PhoneOff,
  Star,
  Search,
  Filter,
  ArrowUpDown,
  MessageCircle,
  Users,
  Megaphone,
  UserPlus,
  LogOut,
  ArrowUp,
  ArrowDown,
  Key,
  Settings,
  Download,
  Upload,
  Info,
  CircleSlash,
  AlertTriangle,
  Play,
  Pause,
  Square,
  Save,
  Unplug,
  Plug,
  Link2,
  Scissors,
  Move,
  MessageSquare,
  Lock,
  Lightbulb,
  Clock,
  RotateCcw,
  Smile,
  Eye,
  EyeOff,
  Share,
  Zap,
  MoreHorizontal,
} from "lucide-react";
import { humanLabel } from "../labels.js";

// ============================================================
// Icon map: emoji → Lucide component
// ============================================================

/**
 * Маппинг emoji-кодов (из getIntentIcon) в компоненты lucide-react.
 * Позволяет рендерить профессиональные SVG-иконки вместо emoji, сохраняя
 * backward-совместимость с декларативным spec.icon = "✎" / "🗑".
 *
 * Не покрытые emoji рендерятся как fallback-текст в <Icon>.
 */
const EMOJI_TO_LUCIDE = {
  "✎": Pencil,
  "🗑": Trash2,
  "➕": Plus,
  "+": Plus,
  "✓": Check,
  "✕": X,
  "×": X,
  "📤": Send,
  "📎": Paperclip,
  "🎤": Mic,
  "🎙": Mic,
  "🖼": ImageIcon,
  "🎬": Video,
  "📍": MapPin,
  "📌": Pin,
  "🗳": Vote,
  "↗": CornerUpRight,
  "⭐": Star,
  "☆": BookmarkPlus,
  "⎘": Copy,
  "🌐": Languages,
  "🔇": BellOff,
  "🔔": Bell,
  "📞": Phone,
  "📹": Video,
  "📵": PhoneOff,
  "🔍": Search,
  "⋯": MoreHorizontal,
  "…": MoreHorizontal,
  "⇅": ArrowUpDown,
  "⚙": Settings,
  "👤": Users,
  "👥": Users,
  "📢": Megaphone,
  "✉": Send,
  "⬆": ArrowUp,
  "⬇": ArrowDown,
  "🔑": Key,
  "←": LogOut,
  "→": LogOut,
  "ℹ": Info,
  "⚡": Zap,
  "●": Eye,
  "💬": MessageCircle,
  "🔒": Lock,
  "💡": Lightbulb,
  "⏰": Clock,
  "🔄": RotateCcw,
  "▶": Play,
  "⏸": Pause,
  "⏹": Square,
  "💾": Save,
  "🔗": Link2,
  "✂": Scissors,
  "✥": Move,
  "🚫": CircleSlash,
  "⚠": AlertTriangle,
  "📦": BookmarkPlus,
  "😊": Smile,
  "📊": Vote,
  "📅": Clock,
  "🎵": Play,
  "🎉": Star,
  "🔥": Zap,
};

function resolveLucide(emoji) {
  return EMOJI_TO_LUCIDE[emoji] || null;
}

// ============================================================
// Parameter controls
// ============================================================

function MantineTextInput({ spec, value, onChange, error }) {
  return (
    <TextInput
      label={humanLabel(spec.name, spec.label)}
      value={value ?? ""}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={spec.placeholder}
      required={spec.required}
      error={error}
    />
  );
}

function MantineEmail({ spec, value, onChange, error }) {
  return (
    <TextInput
      type="email"
      label={humanLabel(spec.name, spec.label)}
      value={value ?? ""}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={spec.placeholder || "name@example.com"}
      required={spec.required}
      error={error}
    />
  );
}

function MantineUrl({ spec, value, onChange, error }) {
  return (
    <TextInput
      type="url"
      label={humanLabel(spec.name, spec.label)}
      value={value ?? ""}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={spec.placeholder}
      required={spec.required}
      error={error}
    />
  );
}

function MantineTel({ spec, value, onChange, error }) {
  return (
    <TextInput
      type="tel"
      label={humanLabel(spec.name, spec.label)}
      value={value ?? ""}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={spec.placeholder}
      required={spec.required}
      error={error}
    />
  );
}

function MantineTextarea({ spec, value, onChange, error }) {
  return (
    <Textarea
      label={humanLabel(spec.name, spec.label)}
      value={value ?? ""}
      onChange={(e) => onChange(e.currentTarget.value)}
      placeholder={spec.placeholder}
      required={spec.required}
      error={error}
      autosize
      minRows={2}
      maxRows={6}
    />
  );
}

function MantineNumber({ spec, value, onChange, error }) {
  return (
    <NumberInput
      label={humanLabel(spec.name, spec.label)}
      value={value === "" || value == null ? "" : value}
      onChange={(v) => onChange(v)}
      placeholder={spec.placeholder}
      required={spec.required}
      error={error}
    />
  );
}

/**
 * DateTime control — две стратегии по spec.name:
 *   - pure time (startTime/endTime/time) → TimeInput (HH:MM)
 *   - date и остальное → DateInput с календарём
 *
 * Mantine 9: DateInput использует string ("YYYY-MM-DD"), TimeInput —
 * обычный <input type="time">. Value передаём/принимаем как string.
 */
function MantineDateTime({ spec, value, onChange, error }) {
  const name = spec.name || "";
  const label = humanLabel(name, spec.label);
  const isTimeOnly = /time/i.test(name) && !/date/i.test(name);

  if (isTimeOnly) {
    return (
      <TimeInput
        label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.currentTarget.value)}
        required={spec.required}
        error={error}
      />
    );
  }

  return (
    <DateInput
      label={label}
      value={value ?? null}
      onChange={(v) => onChange(v || "")}
      placeholder="Выберите дату"
      required={spec.required}
      error={error}
      valueFormat="DD.MM.YYYY"
      clearable
    />
  );
}

function MantineSelect({ spec, value, onChange, error }) {
  const data = (spec.options || []).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  return (
    <Select
      label={humanLabel(spec.name, spec.label)}
      data={data}
      value={value ?? null}
      onChange={(v) => onChange(v || "")}
      placeholder={spec.placeholder || "Выберите…"}
      required={spec.required}
      error={error}
      clearable
    />
  );
}

// ============================================================
// Buttons
// ============================================================

// Helper: icon может приехать как emoji-строка или как React-элемент.
// Приводим к React-узлу через <Icon> если строка.
function normalizeIcon(icon) {
  if (!icon) return undefined;
  if (typeof icon === "string") return <Icon emoji={icon} size={16} />;
  return icon;
}

function MantinePrimaryButton({ label, icon, onClick, disabled, title, size }) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      title={title}
      leftSection={normalizeIcon(icon)}
      color="indigo"
      size={size || "sm"}
    >
      {label}
    </Button>
  );
}

function MantineSecondaryButton({ label, icon, onClick, disabled, title, size }) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      title={title}
      leftSection={normalizeIcon(icon)}
      variant="default"
      size={size || "sm"}
    >
      {label}
    </Button>
  );
}

function MantineDangerButton({ label, icon, onClick, disabled, title, size }) {
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      title={title}
      leftSection={normalizeIcon(icon)}
      color="red"
      size={size || "sm"}
    >
      {label}
    </Button>
  );
}

/**
 * Overflow menu — Mantine Menu. trigger-кнопка = ActionIcon с "⋯",
 * при клике открывается dropdown c списком items (label + иконка).
 *
 * items: [{ key, label, icon, onClick }]
 */
function MantineOverflowMenu({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <Menu shadow="md" width={220} position="bottom-end" withArrow>
      <Menu.Target>
        <ActionIcon
          variant="default"
          size="lg"
          title="Ещё"
          aria-label="Ещё"
        >
          <Icon emoji="⋯" size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        {items.map((item) => (
          <Menu.Item
            key={item.key}
            leftSection={item.icon ? <Icon emoji={item.icon} size={14} /> : undefined}
            onClick={item.onClick}
          >
            {item.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}

/**
 * IntentButton-адаптер. Рендерит кнопку намерения через Mantine.
 *
 * Две формы рендера:
 *   - С текстовым label → Mantine Button (с leftSection-иконкой)
 *   - Только иконка (длинные label или без label) → Mantine ActionIcon
 *     (квадратная кнопка фиксированного размера, читабельная рядом)
 *
 * Variant выбирается по:
 *   - spec.variant (явный hint: "primary" | "secondary" | "danger")
 *   - spec.irreversibility (high → danger)
 *   - иначе default (subtle)
 */
function MantineIntentButton({ spec, onClick, disabled }) {
  const label = spec.label || spec.intentId;
  const icon = spec.icon;
  const LABEL_MAX = 14;
  const showLabel = label.length <= LABEL_MAX;

  const isDanger = spec.variant === "danger" || spec.irreversibility === "high";
  const isPrimary = spec.variant === "primary";

  // Default (не danger/primary): Mantine `variant="default"` без color —
  // использует theme-adaptive border/background/foreground, корректно
  // переключается в dark. Явный `color="gray"` — ломает это в dark mode.
  const color = isDanger ? "red" : isPrimary ? "indigo" : undefined;
  const variant = isDanger || isPrimary ? "light" : "default";

  // Только иконка → ActionIcon (квадратный, фиксированный размер)
  if (!showLabel || !label) {
    return (
      <ActionIcon
        onClick={onClick}
        disabled={disabled}
        title={label}
        size="lg"
        variant={variant}
        color={color}
      >
        <Icon emoji={icon} size={18} />
      </ActionIcon>
    );
  }

  // С label → Button
  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      title={label}
      size="sm"
      variant={variant}
      color={color}
      leftSection={icon ? <Icon emoji={icon} size={16} /> : undefined}
    >
      {label}
    </Button>
  );
}

// ============================================================
// Primitives: heading, text, badge, avatar, paper
// ============================================================

/**
 * Primitive-компоненты получают текст/значение и стилевые подсказки
 * напрямую (не через spec/ctx как parameter/button). Это самый низкий
 * слой — просто обёртки над Mantine типографикой.
 */

function MantineHeading({ level = 2, children }) {
  // Mantine Title: order 1/2/3/4/5/6 — HTML h1-h6 + стиль по размеру.
  const order = Math.min(6, Math.max(1, level));
  return <Title order={order}>{children}</Title>;
}

// Presets используют Mantine color tokens, которые автоматически
// адаптируются к темной теме (через CSS variables). Жёсткие оттенки
// типа "dark.9" — запрещены, они не переключаются.
const TEXT_PRESETS = {
  body: { size: "sm" },
  secondary: { size: "xs", c: "dimmed" },
  muted: { size: "xs", c: "dimmed" },
  heading: { fw: 700, size: "md" },
  accent: { fw: 600, c: "indigo" },
  danger: { c: "red" },
  success: { c: "green" },
};

function MantineText({ children, preset, style }) {
  const props = (preset && TEXT_PRESETS[preset]) || {};
  return <Text {...props} style={style}>{children}</Text>;
}

function MantineBadge({ children, color }) {
  return (
    <Badge color={color || "indigo"} variant="light" size="sm" radius="sm">
      {children}
    </Badge>
  );
}

function MantineAvatar({ src, name, size = 40 }) {
  // Mantine Avatar: если src пусто — показывает initials через name prop
  // (первые буквы). Если src — картинка. Mantine сам решает fallback.
  return (
    <Avatar
      src={src || undefined}
      name={name || "?"}
      color="initials"
      size={size}
      radius="xl"
    >
      {!src && name ? name[0]?.toUpperCase() : null}
    </Avatar>
  );
}

function MantinePaper({ children, padding, withBorder, style }) {
  return (
    <Paper
      p={padding ?? "md"}
      withBorder={withBorder !== false}
      radius="md"
      style={style}
    >
      {children}
    </Paper>
  );
}

// ============================================================
// Shell: Modal + Tabs
// ============================================================

/**
 * Обёртка Mantine Modal как ModalShell.
 *
 * Заменяет inline-стилизованную ModalShell в FormModal.jsx — через неё
 * автоматически улучшаются FormModal, ConfirmDialog, BulkWizard
 * (они все используют ModalShell).
 *
 * Props: { onClose, children, title? }
 */
function MantineModalShell({ onClose, children, title }) {
  return (
    <Modal
      opened
      onClose={onClose}
      title={title}
      centered
      size="md"
      padding="lg"
      radius="md"
      overlayProps={{ backgroundOpacity: 0.55, blur: 2 }}
    >
      {children}
    </Modal>
  );
}

/**
 * Mantine Tabs как shell.tabs.
 *
 * items: [{ value, label, active }]. onSelect(value) — клик по табу.
 * Кастом, потому что Mantine Tabs API немного отличается (controlled).
 */
function MantineTabs({ items, active, onSelect, extra }) {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      borderBottom: "1px solid var(--mantine-color-default-border)",
      background: "var(--mantine-color-default)",
    }}>
      <Tabs
        value={active || null}
        onChange={(v) => v && onSelect && onSelect(v)}
        variant="default"
        style={{ flex: 1 }}
      >
        <Tabs.List style={{ border: "none" }}>
          {items.map(item => (
            <Tabs.Tab key={item.value} value={item.value}>
              {item.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      {extra && <div style={{ marginRight: 8 }}>{extra}</div>}
    </div>
  );
}

// ============================================================
// Adapter export
// ============================================================

export const mantineAdapter = {
  name: "mantine",
  parameter: {
    text: MantineTextInput,
    textarea: MantineTextarea,
    email: MantineEmail,
    url: MantineUrl,
    tel: MantineTel,
    number: MantineNumber,
    datetime: MantineDateTime,
    select: MantineSelect,
    // image и file оставляем на built-in — у них специфичная логика
    // FileReader→data URL (ImageControl.jsx). Адаптируем позже через
    // Mantine FileButton / Dropzone.
  },
  button: {
    primary: MantinePrimaryButton,
    secondary: MantineSecondaryButton,
    danger: MantineDangerButton,
    intent: MantineIntentButton,
    overflow: MantineOverflowMenu,
  },
  shell: {
    modal: MantineModalShell,
    tabs: MantineTabs,
  },
  primitive: {
    heading: MantineHeading,
    text: MantineText,
    badge: MantineBadge,
    avatar: MantineAvatar,
    paper: MantinePaper,
  },
  icon: {
    // resolve — функция (не компонент), используется <Icon> для lookup.
    // Принимает emoji-строку, возвращает React-компонент или null.
    resolve: resolveLucide,
  },
};
