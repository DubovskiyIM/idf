/**
 * In-memory реестр полных ontology-объектов по domain-key.
 *
 * Клиент POST'ит ontology при монтировании домена через POST /api/ontology.
 * Агент-роут читает из реестра (GET /api/agent/:domain/schema).
 *
 * Данные теряются при рестарте сервера — это acceptable для демо,
 * при реальном использовании reg'истрация происходит при первом
 * подключении клиента.
 */

const REGISTRY = {};

function registerOntology(domain, ontology) {
  if (!domain || !ontology) return false;
  REGISTRY[domain] = ontology;
  return true;
}

function getOntology(domain) {
  return REGISTRY[domain] || null;
}

function getAllDomains() {
  return Object.keys(REGISTRY);
}

function getAllOntologies() {
  return { ...REGISTRY };
}

module.exports = { registerOntology, getOntology, getAllDomains, getAllOntologies };
