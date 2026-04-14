/**
 * Ant Design UI-адаптер (§17 манифеста — адаптивный слой).
 *
 * Fintech-ориентированный адаптер для домена invest (4-й адаптер после
 * Mantine, shadcn, Apple visionOS-glass). Родной для enterprise/банкинга:
 * Statistic, ProTable, @ant-design/charts. Регистрируется через
 * registerUIAdapter(antdAdapter) + оборачивается ConfigProvider'ом.
 *
 * Категории:
 *   - parameter / button / shell / primitive / icon (как у остальных)
 *   - chart (НОВАЯ): первая категория primitive, выходящая за
 *     текст/картинка/контейнер. Декларативный spec проекции → AntD Charts.
 */

import {
  Input,
  InputNumber,
  Select,
  DatePicker,
  TimePicker,
  Button as AntButton,
  Modal,
  Tabs,
  Typography,
  Tag,
  Avatar,
  Card,
  Dropdown,
  Statistic,
} from "antd";
import {
  EditOutlined,
  DeleteOutlined,
  PlusOutlined,
  CheckOutlined,
  CloseOutlined,
  SendOutlined,
  PaperClipOutlined,
  AudioOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  EnvironmentOutlined,
  PushpinOutlined,
  CopyOutlined,
  TranslationOutlined,
  BellOutlined,
  PhoneOutlined,
  SearchOutlined,
  MoreOutlined,
  SwapOutlined,
  SettingOutlined,
  TeamOutlined,
  UserOutlined,
  NotificationOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  KeyOutlined,
  LogoutOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  EyeOutlined,
  EyeInvisibleOutlined,
  LockOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  SaveOutlined,
  LinkOutlined,
  ScissorOutlined,
  DragOutlined,
  MessageOutlined,
  WarningOutlined,
  StopFilled,
  StarOutlined,
  FilterOutlined,
  DownloadOutlined,
  UploadOutlined,
  LineChartOutlined,
  RiseOutlined,
  FallOutlined,
  DollarOutlined,
  PieChartOutlined,
  FundOutlined,
  StockOutlined,
  WalletOutlined,
  BankOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import Icon from "../Icon.jsx";
import { humanLabel } from "../labels.js";
import { AntdChart, AntdSparkline } from "./charts.jsx";

const { Title, Text } = Typography;

// ============================================================
// Icon map: emoji → AntD icon component
// ============================================================

const EMOJI_TO_ANTD = {
  "✎": EditOutlined,
  "🗑": DeleteOutlined,
  "➕": PlusOutlined,
  "+": PlusOutlined,
  "✓": CheckOutlined,
  "✕": CloseOutlined,
  "×": CloseOutlined,
  "📤": SendOutlined,
  "📎": PaperClipOutlined,
  "🎤": AudioOutlined,
  "🎙": AudioOutlined,
  "🖼": PictureOutlined,
  "🎬": VideoCameraOutlined,
  "📍": EnvironmentOutlined,
  "📌": PushpinOutlined,
  "🗳": CheckOutlined,
  "↗": SendOutlined,
  "⭐": StarOutlined,
  "☆": StarOutlined,
  "⎘": CopyOutlined,
  "🌐": TranslationOutlined,
  "🔇": BellOutlined,
  "🔔": BellOutlined,
  "📞": PhoneOutlined,
  "📹": VideoCameraOutlined,
  "📵": PhoneOutlined,
  "🔍": SearchOutlined,
  "⋯": MoreOutlined,
  "…": MoreOutlined,
  "⇅": SwapOutlined,
  "⚙": SettingOutlined,
  "👤": UserOutlined,
  "👥": TeamOutlined,
  "📢": NotificationOutlined,
  "✉": SendOutlined,
  "⬆": ArrowUpOutlined,
  "⬇": ArrowDownOutlined,
  "🔑": KeyOutlined,
  "🚪": LogoutOutlined,
  "←": LogoutOutlined,
  "→": LogoutOutlined,
  "ℹ": InfoCircleOutlined,
  "⚡": ThunderboltOutlined,
  "●": EyeOutlined,
  "💬": MessageOutlined,
  "🔒": LockOutlined,
  "💡": BulbOutlined,
  "⏰": ClockCircleOutlined,
  "🔄": ReloadOutlined,
  "▶": PlayCircleOutlined,
  "⏸": PauseCircleOutlined,
  "⏹": StopOutlined,
  "💾": SaveOutlined,
  "🔗": LinkOutlined,
  "✂": ScissorOutlined,
  "✥": DragOutlined,
  "🚫": StopFilled,
  "⚠": WarningOutlined,
  "📦": WalletOutlined,
  "🔥": ThunderboltOutlined,
  "📊": LineChartOutlined,
  "📈": RiseOutlined,
  "📉": FallOutlined,
  "💰": DollarOutlined,
  "💵": DollarOutlined,
  "🥧": PieChartOutlined,
  "📉": FallOutlined,
  "🏦": BankOutlined,
  "💼": FundOutlined,
  "📊": LineChartOutlined,
  "🕯": StockOutlined,
  "👁": EyeOutlined,
  "🙈": EyeInvisibleOutlined,
  "🗂": FilterOutlined,
  "📥": DownloadOutlined,
  "📤": UploadOutlined,
};

function resolveAntdIcon(emoji) {
  return EMOJI_TO_ANTD[emoji] || null;
}

// Normalize: emoji-string → React node (для leftSection кнопок)
function normalizeIcon(icon) {
  if (!icon) return undefined;
  if (typeof icon === "string") return <Icon emoji={icon} size={14} />;
  return icon;
}

// ============================================================
// Parameter controls
// ============================================================

function labelWrap(label, children) {
  if (!label) return children;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 13, color: "rgba(0,0,0,0.65)" }}>{label}</label>
      {children}
    </div>
  );
}

function AntdTextInput({ spec, value, onChange, error }) {
  return labelWrap(
    humanLabel(spec.name, spec.label),
    <Input
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={spec.placeholder}
      status={error ? "error" : undefined}
    />
  );
}

function AntdEmail({ spec, value, onChange, error }) {
  return labelWrap(
    humanLabel(spec.name, spec.label),
    <Input
      type="email"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={spec.placeholder || "name@example.com"}
      status={error ? "error" : undefined}
    />
  );
}

function AntdUrl({ spec, value, onChange, error }) {
  return labelWrap(
    humanLabel(spec.name, spec.label),
    <Input
      type="url"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={spec.placeholder}
      status={error ? "error" : undefined}
    />
  );
}

function AntdTel({ spec, value, onChange, error }) {
  return labelWrap(
    humanLabel(spec.name, spec.label),
    <Input
      type="tel"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={spec.placeholder}
      status={error ? "error" : undefined}
    />
  );
}

function AntdTextarea({ spec, value, onChange, error }) {
  return labelWrap(
    humanLabel(spec.name, spec.label),
    <Input.TextArea
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder={spec.placeholder}
      autoSize={{ minRows: 2, maxRows: 6 }}
      status={error ? "error" : undefined}
    />
  );
}

function AntdNumber({ spec, value, onChange, error }) {
  // Финансовый number: форматтер по fieldRole (money/percentage). Пока —
  // базовый InputNumber с шириной 100%.
  const isMoney = spec.fieldRole === "money" || /price|amount|cost|fee|value/i.test(spec.name || "");
  const isPct = spec.fieldRole === "percentage" || /percent|rate|allocation/i.test(spec.name || "");

  return labelWrap(
    humanLabel(spec.name, spec.label),
    <InputNumber
      value={value === "" || value == null ? null : value}
      onChange={(v) => onChange(v == null ? "" : v)}
      placeholder={spec.placeholder}
      status={error ? "error" : undefined}
      style={{ width: "100%" }}
      prefix={isMoney ? "₽" : undefined}
      suffix={isPct ? "%" : undefined}
      formatter={isMoney ? (v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, " ") : undefined}
      parser={isMoney ? (v) => v?.replace(/\s/g, "") : undefined}
    />
  );
}

function AntdDateTime({ spec, value, onChange, error }) {
  const name = spec.name || "";
  const label = humanLabel(name, spec.label);
  const isTimeOnly = /time/i.test(name) && !/date/i.test(name);

  if (isTimeOnly) {
    return labelWrap(
      label,
      <TimePicker
        value={value ? dayjs(value, "HH:mm") : null}
        onChange={(v) => onChange(v ? v.format("HH:mm") : "")}
        format="HH:mm"
        style={{ width: "100%" }}
        status={error ? "error" : undefined}
      />
    );
  }

  return labelWrap(
    label,
    <DatePicker
      value={value ? dayjs(value) : null}
      onChange={(v) => onChange(v ? v.format("YYYY-MM-DD") : "")}
      format="DD.MM.YYYY"
      style={{ width: "100%" }}
      placeholder="Выберите дату"
      status={error ? "error" : undefined}
    />
  );
}

function AntdSelect({ spec, value, onChange, error }) {
  const options = (spec.options || []).map((o) =>
    typeof o === "string" ? { value: o, label: o } : o
  );
  return labelWrap(
    humanLabel(spec.name, spec.label),
    <Select
      value={value ?? undefined}
      onChange={(v) => onChange(v ?? "")}
      options={options}
      placeholder={spec.placeholder || "Выберите…"}
      style={{ width: "100%" }}
      allowClear
      status={error ? "error" : undefined}
    />
  );
}

// ============================================================
// Buttons
// ============================================================

function AntdPrimaryButton({ label, icon, onClick, disabled, title, size }) {
  return (
    <AntButton
      type="primary"
      onClick={onClick}
      disabled={disabled}
      title={title}
      icon={normalizeIcon(icon)}
      size={size === "lg" ? "large" : size === "sm" ? "small" : "middle"}
    >
      {label}
    </AntButton>
  );
}

function AntdSecondaryButton({ label, icon, onClick, disabled, title, size }) {
  return (
    <AntButton
      onClick={onClick}
      disabled={disabled}
      title={title}
      icon={normalizeIcon(icon)}
      size={size === "lg" ? "large" : size === "sm" ? "small" : "middle"}
    >
      {label}
    </AntButton>
  );
}

function AntdDangerButton({ label, icon, onClick, disabled, title, size }) {
  return (
    <AntButton
      danger
      onClick={onClick}
      disabled={disabled}
      title={title}
      icon={normalizeIcon(icon)}
      size={size === "lg" ? "large" : size === "sm" ? "small" : "middle"}
    >
      {label}
    </AntButton>
  );
}

/**
 * IntentButton-адаптер. Зеркалит логику Mantine:
 *  - длинный label → icon-only (AntButton type="text" size="large" без label)
 *  - danger → type="primary" danger
 *  - primary variant → type="primary"
 *  - default → type="default"
 */
function AntdIntentButton({ spec, onClick, disabled }) {
  const label = spec.label || spec.intentId;
  const LABEL_MAX = 14;
  const showLabel = label.length <= LABEL_MAX;

  const isDanger = spec.variant === "danger" || spec.irreversibility === "high";
  const isPrimary = spec.variant === "primary";

  const type = isDanger || isPrimary ? "primary" : "default";
  const danger = isDanger || undefined;
  const iconNode = spec.icon ? <Icon emoji={spec.icon} size={14} /> : undefined;

  if (!showLabel || !label) {
    return (
      <AntButton
        type="text"
        shape="circle"
        onClick={onClick}
        disabled={disabled}
        title={label}
        danger={danger}
        icon={iconNode || <Icon emoji={spec.icon || "⋯"} size={16} />}
      />
    );
  }

  return (
    <AntButton
      type={type}
      danger={danger}
      onClick={onClick}
      disabled={disabled}
      title={label}
      size="middle"
      icon={iconNode}
    >
      {label}
    </AntButton>
  );
}

/**
 * Overflow menu — AntD Dropdown с items-API.
 * items: [{ key, label, icon, onClick }]
 */
function AntdOverflowMenu({ items, triggerIcon, triggerLabel }) {
  if (!items || items.length === 0) return null;

  const menuItems = items.map((item) => {
    if (item.divider) return { type: "divider", key: item.key };
    return {
      key: item.key,
      label: item.label,
      icon: item.icon ? <Icon emoji={item.icon} size={14} /> : undefined,
      onClick: item.onClick,
    };
  });

  return (
    <Dropdown menu={{ items: menuItems }} trigger={["click"]} placement="bottomRight">
      <AntButton
        type="text"
        shape="circle"
        size="large"
        title={triggerLabel || "Ещё"}
        icon={<Icon emoji={triggerIcon || "⋯"} size={16} />}
      />
    </Dropdown>
  );
}

// ============================================================
// Primitives
// ============================================================

function AntdHeading({ level = 2, children }) {
  const lvl = Math.min(5, Math.max(1, level));
  return <Title level={lvl} style={{ marginBottom: 8 }}>{children}</Title>;
}

const TEXT_PRESETS = {
  body: {},
  secondary: { type: "secondary" },
  muted: { type: "secondary" },
  heading: { strong: true },
  accent: { strong: true },
  danger: { type: "danger" },
  success: { type: "success" },
};

function AntdText({ children, preset, style }) {
  const props = (preset && TEXT_PRESETS[preset]) || {};
  return <Text {...props} style={style}>{children}</Text>;
}

function AntdBadge({ children, color }) {
  return <Tag color={color || "blue"}>{children}</Tag>;
}

function AntdAvatar({ src, name, size = 40 }) {
  const initials = (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <Avatar src={src || undefined} size={size}>
      {!src && initials}
    </Avatar>
  );
}

function AntdPaper({ children, padding, withBorder, style }) {
  return (
    <Card
      size={padding === "sm" ? "small" : "default"}
      bordered={withBorder !== false}
      style={{ borderRadius: 8, ...(style || {}) }}
      styles={{ body: { padding: padding ?? 16 } }}
    >
      {children}
    </Card>
  );
}

/**
 * Statistic — финансовая метрика (value + prefix/suffix + trend).
 * Доменный код декларирует: { kind: "statistic", value, prefix, suffix, trend }
 * trend: "up" | "down" | null → зелёная/красная стрелка
 */
function AntdStatistic({ title, value, prefix, suffix, trend, precision = 0 }) {
  let valueStyle = undefined;
  let prefixNode = prefix;

  if (trend === "up") {
    valueStyle = { color: "#3f8600" };
    prefixNode = prefix ? <>{prefix} <ArrowUpOutlined /></> : <ArrowUpOutlined />;
  } else if (trend === "down") {
    valueStyle = { color: "#cf1322" };
    prefixNode = prefix ? <>{prefix} <ArrowDownOutlined /></> : <ArrowDownOutlined />;
  }

  return (
    <Statistic
      title={title}
      value={value}
      precision={precision}
      valueStyle={valueStyle}
      prefix={prefixNode}
      suffix={suffix}
    />
  );
}

// ============================================================
// Shell: Modal + Tabs
// ============================================================

function AntdModalShell({ onClose, children, title }) {
  return (
    <Modal open onCancel={onClose} title={title} footer={null} centered width={560} destroyOnClose>
      {children}
    </Modal>
  );
}

function AntdTabs({ items, active, onSelect, extra }) {
  const tabItems = items.map((it) => ({ key: it.value, label: it.label }));
  return (
    <Tabs
      activeKey={active || undefined}
      onChange={(k) => onSelect && onSelect(k)}
      items={tabItems}
      tabBarExtraContent={extra}
      style={{ paddingLeft: 16, paddingRight: 16 }}
    />
  );
}

// ============================================================
// Adapter export
// ============================================================

export const antdAdapter = {
  name: "antd",
  parameter: {
    text: AntdTextInput,
    textarea: AntdTextarea,
    email: AntdEmail,
    url: AntdUrl,
    tel: AntdTel,
    number: AntdNumber,
    datetime: AntdDateTime,
    select: AntdSelect,
  },
  button: {
    primary: AntdPrimaryButton,
    secondary: AntdSecondaryButton,
    danger: AntdDangerButton,
    intent: AntdIntentButton,
    overflow: AntdOverflowMenu,
  },
  shell: {
    modal: AntdModalShell,
    tabs: AntdTabs,
  },
  primitive: {
    heading: AntdHeading,
    text: AntdText,
    badge: AntdBadge,
    avatar: AntdAvatar,
    paper: AntdPaper,
    statistic: AntdStatistic,
    chart: AntdChart,
    sparkline: AntdSparkline,
  },
  icon: {
    resolve: resolveAntdIcon,
  },
};
