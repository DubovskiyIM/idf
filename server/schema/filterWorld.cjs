/**
 * @idf/core re-export (v0.2.0).
 *
 * Реализация мигрирована в SDK: packages/core/src/filterWorld.js.
 * Этот файл — thin wrapper для обратной совместимости с server-side
 * требованиями (`require()` из CommonJS).
 */
const { filterWorldForRole } = require("@idf/core");
module.exports = { filterWorldForRole };
