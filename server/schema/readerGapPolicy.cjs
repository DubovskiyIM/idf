/**
 * Φ schema-versioning Phase 4/5 — reader gap policy + drift detector.
 * Thin re-export из @intent-driven/core для CJS совместимости.
 *
 * Spec: idf/docs/manifesto-v2.1-ontology-evolution.md §E-§F.
 * Реализация: @intent-driven/core@0.112.0+ (PR idf-sdk #451 + #453).
 */
const {
  DEFAULT_READER_POLICIES,
  DEFAULT_PLACEHOLDER,
  getReaderPolicy,
  detectFieldGap,
  resolveGap,
  resolveFieldGap,
  scanEntityGaps,
  computeCanonicalGapSet,
  compareReaderObservations,
  detectReaderEquivalenceDrift,
} = require("@intent-driven/core");

module.exports = {
  DEFAULT_READER_POLICIES,
  DEFAULT_PLACEHOLDER,
  getReaderPolicy,
  detectFieldGap,
  resolveGap,
  resolveFieldGap,
  scanEntityGaps,
  computeCanonicalGapSet,
  compareReaderObservations,
  detectReaderEquivalenceDrift,
};
