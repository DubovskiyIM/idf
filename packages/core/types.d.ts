/**
 * @idf/core — TypeScript type definitions
 *
 * IDF Specification v1.0 — Part 1: Core Model
 */

// ============================================================
// §3 Intention
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
// §4 Effect
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
}

// ============================================================
// §5 Projection
// ============================================================

export interface Projection {
  name?: string;
  kind: "feed" | "catalog" | "detail" | "form" | "canvas" | "dashboard";
  entities: string[];
  mainEntity?: string;
  idParam?: string;
  filter?: string | object;
  sort?: string;
  witnesses?: string[];
  layout?: "list" | "grid";
  subCollections?: SubCollectionDef[];
  progress?: ProgressDef;
  footerIntents?: string[];
  widgets?: DashboardWidget[];
}

export interface SubCollectionDef {
  collection?: string;
  entity: string;
  foreignKey: string;
  title?: string;
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
// §2 Ontology
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
    closeWhen: string;
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
// §5 World
// ============================================================

export type World = Record<string, Record<string, unknown>[]>;

// ============================================================
// §6 Intent Algebra
// ============================================================

export interface IntentRelations {
  sequentialIn: string[];
  sequentialOut: string[];
  antagonists: string[];
  excluding: string[];
  parallel: string[];
}

export type AdjacencyMap = Record<string, IntentRelations>;

// ============================================================
// §7 Integrity
// ============================================================

export interface IntegrityFinding {
  rule: string;
  intentId?: string;
  severity: "error" | "warning" | "info";
  message: string;
  classification?: string;
}

export interface IntegrityResult {
  passed: boolean;
  errors: number;
  warnings: number;
  infos: number;
  issues: IntegrityFinding[];
  summary: string;
}

// ============================================================
// Public API
// ============================================================

// Level 1: Core
export function fold(effects: Effect[], typeMap?: Record<string, string>): World;
export function applyPresentation(world: World, effects: Effect[], typeMap?: Record<string, string>): World;
export function foldDrafts(effects: Effect[]): Record<string, unknown>[];
export function filterByStatus(effects: Effect[], ...statuses: string[]): Effect[];
export function causalSort(effects: Effect[]): Effect[];
export function pluralize(name: string): string;

// Level 2: Algebra
export function computeAlgebra(intents: IntentsMap, ontology: Ontology): AdjacencyMap;
export function computeAlgebraWithEvidence(intents: IntentsMap, ontology: Ontology): AdjacencyMap;
export function parseCondition(condition: string): { entity: string; field: string; op: string; value: unknown };
export function parseConditions(conditions: string[]): Array<{ entity: string; field: string; op: string; value: unknown }>;
export function checkComposition(alpha1: string, alpha2: string): boolean;

// Level 3: Integrity
export function checkIntegrity(intents: IntentsMap, projections: ProjectionsMap, ontology: Ontology): IntegrityResult;

// Derivation
export function deriveProjections(intents: IntentsMap, ontology: Ontology): ProjectionsMap;
export function analyzeIntents(intents: IntentsMap, entityNames?: string[]): {
  creators: Record<string, string[]>;
  mutators: Record<string, string[]>;
  feedSignals: Record<string, string[]>;
};
export function detectForeignKeys(ontology: Ontology): Record<string, Array<{ field: string; references: string }>>;
export function mergeProjections(derived: ProjectionsMap, authored: Record<string, object | false>): ProjectionsMap;
