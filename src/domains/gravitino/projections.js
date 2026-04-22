// src/domains/gravitino/projections.js
// Stage 1: projections полностью derived через crystallizeV2.
// Authored projections добавим только где derived даёт плохой результат
// (позднее stages). Пустой ROOT_PROJECTIONS = nav использует derived root list.
export const PROJECTIONS = {};
export const ROOT_PROJECTIONS = [];
