/**
 * Системные встроенные intent'ы — не привязаны к доменам.
 * Регистрируются автоматически в _system при require этого модуля.
 *
 * schedule_timer / revoke_timer — для timeEngine (§4 спеки).
 */
const { registerIntents } = require("./intents.js");

const SYSTEM_INTENTS = {
  schedule_timer: {
    name: "Запланировать таймер",
    α: "add",
    particles: {
      parameters: [
        { name: "id", type: "string", required: true },
        { name: "firesAt", type: "datetime", required: true },
        { name: "fireIntent", type: "string", required: true },
        { name: "fireParams", type: "json" },
        { name: "triggerEventKey", type: "string" },
        { name: "revokeOnEvents", type: "json" },
        { name: "guard", type: "string" },
      ],
      effects: [{
        α: "add",
        target: "ScheduledTimer",
      }],
    },
  },
  revoke_timer: {
    name: "Отменить таймер",
    α: "replace",
    particles: {
      parameters: [
        { name: "id", type: "string", required: true },
      ],
      effects: [{
        α: "replace",
        target: "ScheduledTimer",
      }],
    },
  },
};

registerIntents(SYSTEM_INTENTS, "_system");

module.exports = { SYSTEM_INTENTS };
