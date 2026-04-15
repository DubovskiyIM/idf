/**
 * Registry для серверных effect builders по domain.
 *
 * Используется routes/agent.js для dispatch `buildEffects(intentId,
 * params, viewer, world)` на правильный builder по req.params.domain.
 */

const { buildBookingEffects } = require("./buildBookingEffects.cjs");
const { buildPlanningEffects } = require("./buildPlanningEffects.cjs");
const { buildMeshokEffects } = require("./buildMeshokEffects.cjs");
const { buildWorkflowEffects } = require("./buildWorkflowEffects.cjs");
const { buildMessengerEffects } = require("./buildMessengerEffects.cjs");
const { buildLifequestEffects } = require("./buildLifequestEffects.cjs");
const { buildReflectEffects } = require("./buildReflectEffects.cjs");
const { buildInvestEffects } = require("./buildInvestEffects.cjs");
const { buildDeliveryEffects } = require("./buildDeliveryEffects.cjs");

const REGISTRY = {
  booking: buildBookingEffects,
  planning: buildPlanningEffects,
  meshok: buildMeshokEffects,
  workflow: buildWorkflowEffects,
  messenger: buildMessengerEffects,
  lifequest: buildLifequestEffects,
  reflect: buildReflectEffects,
  invest: buildInvestEffects,
  delivery: buildDeliveryEffects,
};

function getEffectBuilder(domain) {
  return REGISTRY[domain] || null;
}

function registerEffectBuilder(domain, builder) {
  REGISTRY[domain] = builder;
}

module.exports = { getEffectBuilder, registerEffectBuilder };
