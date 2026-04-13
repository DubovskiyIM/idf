/**
 * IDF Core Types — интерфейсы парадигмы Intent-Driven Frontend.
 *
 * Источник истины для всех модулей: fold, engine, crystallize_v2, renderer.
 * Не экспортируется в рантайме — только для TypeScript type checking.
 */

// ============================================================
// §4 Атом системы: намерение и его частицы
// ============================================================

export interface IntentParticles {
  entities: string[];
  conditions: string[];
  effects: IntentEffect[];
  witnesses: string[];
  confirmation: "click" | "enter" | "form" | string;
}

export interface IntentEffect {
  α: "add" | "replace" | "remove" | "batch";
  target: string;
  σ?: "session" | "device" | "account" | "shared" | "global";
  value?: unknown;
}

export interface Intent {
  name: string;
  particles: IntentParticles;
  antagonist?: string | null;
  creates?: string | null;
  parameters?: IntentParameter[];
  irreversibility?: "low" | "medium" | "high";
  extended?: boolean;
  phase?: "investigation";
  control?: string;
}

export interface IntentParameter {
  name: string;
  type: string;
  entity?: string;
  required?: boolean;
  label?: string;
}

export type IntentsMap = Record<string, Intent>;

// ============================================================
// §10 Формальная нотация: эффект
// ============================================================

export interface Effect {
  id: string;
  intent_id: string;
  alpha: "add" | "replace" | "remove" | "batch";
  target: string;
  value: unknown;
  scope: string;
  parent_id: string | null;
  status: "proposed" | "confirmed" | "rejected";
  ttl: number | null;
  context: Record<string, unknown>;
  created_at: number;
  resolved_at?: number;
  desc?: string;
  time?: string;
}

// ============================================================
// §5 Проекции
// ============================================================

export interface Projection {
  name: string;
  kind: "feed" | "catalog" | "detail" | "form" | "canvas" | "dashboard";
  query?: string;
  entities: string[];
  mainEntity?: string;
  idParam?: string;
  routeEntities?: string[];
  filter?: string;
  sort?: string;
  witnesses?: string[];
  layout?: "list" | "grid";
  subCollections?: SubCollectionDef[];
  progress?: ProgressDef;
  footerIntents?: string[];
  widgets?: DashboardWidget[];
  sourceProjection?: string;
  editIntents?: string[];
  onItemClick?: NavigationAction;
}

export interface SubCollectionDef {
  collection?: string;
  entity: string;
  foreignKey: string;
  title?: string;
  label?: string;
  addable?: boolean;
  sort?: string;
}

export interface ProgressDef {
  type: "quorum";
  totalSource: string;
  currentSource: string;
  currentDistinct?: string;
  foreignKey: string;
  waitingField?: string;
}

export interface DashboardWidget {
  projection: string;
  title?: string;
  size?: "half" | "full";
}

export type ProjectionsMap = Record<string, Projection>;

// ============================================================
// §14 Онтология
// ============================================================

export interface OntologyField {
  type: string;
  read?: string[];
  write?: string[];
  required?: boolean;
  label?: string;
  values?: string[];
  valueLabels?: Record<string, string>;
}

export interface OntologyEntity {
  fields: Record<string, OntologyField> | string[];
  statuses?: string[];
  ownerField?: string;
  type?: "internal" | "mirror" | "hybrid";
  searchConfig?: {
    fields: string[];
    returnFields: string[];
    minQueryLength?: number;
    limit?: number;
  };
  quorum?: {
    closeWhen: string;  // "all_voted" | "quorum(N)" | "manual"
    absentVote?: "abstain" | "no" | "exclude";
  };
}

export interface OntologyRole {
  label: string;
  canExecute?: string[];
  visibleFields?: Record<string, string[]>;
  statusMapping?: Record<string, null>;
}

export interface Ontology {
  entities: Record<string, OntologyEntity>;
  predicates?: Record<string, string>;
  roles?: Record<string, OntologyRole>;
}

// ============================================================
// §16a Архетипы и слоты — артефакт v2
// ============================================================

export type ArchetypeKind = "feed" | "catalog" | "detail" | "form" | "canvas" | "dashboard";

export interface ArtifactSlots {
  header: SlotItem[];
  toolbar: SlotItem[];
  body: BodySpec;
  context: SlotItem[];
  fab: SlotItem[];
  overlay: OverlaySpec[];
  composer?: ComposerSpec;
  hero?: HeroSpec[];
}

export interface SlotItem {
  type: string;
  intentId?: string;
  label?: string;
  icon?: string;
  placeholder?: string;
  hint?: string;
  condition?: string;
  [key: string]: unknown;
}

export interface BodySpec {
  type: "list" | "formBody" | "canvas" | "dashboard" | string;
  items?: SlotItem[];
  onItemClick?: NavigationAction;
  emptyState?: string;
  widgets?: DashboardWidget[];
  mainEntity?: string;
  [key: string]: unknown;
}

export interface OverlaySpec {
  type: "formModal" | "confirmDialog" | "bulkWizard" | string;
  intentId: string;
  params?: IntentParameter[];
  [key: string]: unknown;
}

export interface ComposerSpec {
  intentId: string;
  params?: IntentParameter[];
  placeholder?: string;
}

export interface HeroSpec {
  intentId: string;
  type: "heroCreate";
  postCreate?: { navigateTo?: string; idParam?: string };
  [key: string]: unknown;
}

export interface NavigationAction {
  action: "navigate";
  to: string;
  params?: Record<string, string>;
}

export interface Artifact {
  projection: string;
  name: string;
  domain: string;
  layer: "canonical";
  archetype: ArchetypeKind;
  version: 2;
  generatedAt: number;
  generatedBy: "rules" | "llm-enriched";
  inputsHash: string;
  slots: ArtifactSlots;
  nav: {
    outgoing: NavEdge[];
    incoming: NavEdge[];
  };
  editProjection?: string | null;
  sourceProjection?: string | null;
}

export interface NavEdge {
  from: string;
  to: string;
  kind: "item-click" | "edit-action" | string;
  params?: Record<string, string>;
}

// ============================================================
// World — результат fold(Φ_confirmed)
// ============================================================

export type World = Record<string, Record<string, unknown>[]>;

// ============================================================
// Domain — определение домена
// ============================================================

export interface Domain {
  DOMAIN_ID: string;
  DOMAIN_NAME: string;
  INTENTS: IntentsMap;
  PROJECTIONS: ProjectionsMap;
  ONTOLOGY: Ontology;
  ROOT_PROJECTIONS: string[] | RootProjectionSection[];
  buildEffects: (intentId: string, ctx: Record<string, unknown>, world: World, drafts?: Record<string, unknown>) => Effect[] | null;
  describeEffect: (intentId: string, alpha: string, ctx: Record<string, unknown>, target?: string) => string;
  signalForIntent?: (intentId: string) => { κ: string; desc: string } | null;
  getSeedEffects?: () => Effect[];
}

export interface RootProjectionSection {
  section: string;
  icon: string;
  items: string[];
}

// ============================================================
// §12 Алгебра связей
// ============================================================

export interface IntentRelations {
  sequentialIn: string[];
  sequentialOut: string[];
  antagonists: string[];
  excluding: string[];
  parallel: string[];
}

export type AdjacencyMap = Record<string, IntentRelations>;
