/**
 * Registry для серверных effect builders по domain.
 *
 * Используется routes/agent.js для dispatch `buildEffects(intentId,
 * params, viewer, world)` на правильный builder по req.params.domain.
 */

const { buildBookingEffects } = require("./buildBookingEffects.cjs");
const { buildPlanningEffects } = require("./buildPlanningEffects.cjs");
const { buildSalesEffects } = require("./buildSalesEffects.cjs");
const { buildWorkflowEffects } = require("./buildWorkflowEffects.cjs");
const { buildMessengerEffects } = require("./buildMessengerEffects.cjs");
const { buildLifequestEffects } = require("./buildLifequestEffects.cjs");
const { buildReflectEffects } = require("./buildReflectEffects.cjs");
const { buildInvestEffects } = require("./buildInvestEffects.cjs");
const { buildDeliveryEffects } = require("./buildDeliveryEffects.cjs");
const { buildFreelanceEffects } = require("./buildFreelanceEffects.cjs");
const { buildComplianceEffects } = require("./buildComplianceEffects.cjs");
const { buildGravitinoEffects } = require("./buildGravitinoEffects.cjs");

const REGISTRY = {
  booking: buildBookingEffects,
  planning: buildPlanningEffects,
  sales: buildSalesEffects,
  workflow: buildWorkflowEffects,
  messenger: buildMessengerEffects,
  lifequest: buildLifequestEffects,
  reflect: buildReflectEffects,
  invest: buildInvestEffects,
  delivery: buildDeliveryEffects,
  freelance: buildFreelanceEffects,
  compliance: buildComplianceEffects,
  gravitino: buildGravitinoEffects,
};

function getEffectBuilder(domain) {
  return REGISTRY[domain] || null;
}

function registerEffectBuilder(domain, builder) {
  REGISTRY[domain] = builder;
}

module.exports = { getEffectBuilder, registerEffectBuilder };
