/**
 * @idf/core — reference implementation of the Intent-Driven Framework specification.
 *
 * IDF Specification v1.0 — Part 1: Core Model
 * Conformance: Level 3 (Full)
 */

// Level 1: Core
export { fold, applyPresentation, foldDrafts, filterByStatus } from './fold.js';
export { causalSort } from './causalSort.js';
export { pluralize } from './pluralize.js';

// Level 2: Algebra
export { computeAlgebra, computeAlgebraWithEvidence } from './intentAlgebra.js';
export { parseCondition, parseConditions } from './conditionParser.js';
export { checkComposition } from './algebra.js';

// Level 3: Integrity
export { checkIntegrity } from './integrity.js';

// Derivation
export { deriveProjections, analyzeIntents, detectForeignKeys } from './deriveProjections.js';
export { mergeProjections } from './mergeProjections.js';
