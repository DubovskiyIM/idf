const { Router } = require("express");
const { foldWorld } = require("../validator.js");

const router = Router();

/**
 * Реестр онтологий доменов. Клиент POST'ит онтологию через /api/typemap?domain=...,
 * сервер использует её для конфигурации поиска (searchConfig) и фильтрации
 * возвращаемых полей.
 *
 * Аналогично intents.js реестру, это часть универсальной серверной
 * инфраструктуры — сервер не знает доменов, но знает как читать их онтологии.
 */
const ONTOLOGIES = {};

function registerOntology(domainId, ontology) {
  ONTOLOGIES[domainId] = ontology;
  return Object.keys(ontology.entities || {}).length;
}

/**
 * GET /api/entities/:collection/search?q=...&domain=...
 *
 * Ищет сущности по searchConfig из онтологии домена. Для messenger'а
 * типичный кейс — EntityPicker для create_direct_chat, forward_message.
 *
 * Конфиг живёт в ontology.entities[X].searchConfig:
 *   - fields: по каким полям искать (case-insensitive substring)
 *   - returnFields: что возвращать (проекция, скрывает приватные поля)
 *   - minQueryLength: минимум символов для запуска поиска
 *   - limit: максимум результатов
 *
 * Фильтрация по viewer-роли пока не реализована — EntityPicker'у достаточно
 * публичного поиска. Расширим когда появится первый intent, которому нужна
 * privacy-aware выборка.
 */
router.get("/:collection/search", (req, res) => {
  const { collection } = req.params;
  const { q = "", domain = "unknown" } = req.query;

  const ontology = ONTOLOGIES[domain];
  if (!ontology) {
    return res.status(404).json({ error: `unknown domain: ${domain}` });
  }

  // singular ← plural, затем case-insensitive lookup по entities
  const singular = collection.replace(/s$/, "");
  const entityKey = Object.keys(ontology.entities || {}).find(
    k => k.toLowerCase() === singular.toLowerCase()
  );
  if (!entityKey) {
    return res.status(404).json({ error: `unknown entity: ${collection}` });
  }

  const entity = ontology.entities[entityKey];
  const config = entity.searchConfig || {
    fields: ["name", "title"],
    returnFields: null, // null → возвращать всё
    minQueryLength: 1,
    limit: 20,
  };

  if (q.length < (config.minQueryLength || 1)) {
    return res.json([]);
  }

  const world = foldWorld();
  const list = world[collection] || [];

  const queryLower = q.toLowerCase();
  const results = list
    .filter(item => {
      return (config.fields || []).some(f => {
        const val = item[f];
        return typeof val === "string" && val.toLowerCase().includes(queryLower);
      });
    })
    .slice(0, config.limit || 20)
    .map(item => {
      if (!config.returnFields) return item;
      const returned = {};
      for (const f of config.returnFields) {
        if (item[f] !== undefined) returned[f] = item[f];
      }
      return returned;
    });

  res.json(results);
});

module.exports = { router, registerOntology };
