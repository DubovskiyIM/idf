/**
 * /api/document/:domain/:projection — равноправная материализация
 * проекции как документа (§1 manifesto, §26.3 закрытие).
 *
 * Тот же артефакт, что и pixel-рендер + agent-API. Разный output:
 *   Accept: text/html     → print-ready HTML (браузер → Save as PDF)
 *   Accept: application/json → structured document-граф
 *
 * Query-params: ?format=html|json (override Accept).
 * Route-params детали — query-params (например ?portfolioId=pf_balanced).
 *
 * Auth: JWT (reuse authMiddleware). Viewer — from token. Роль по query
 * `?as=investor|advisor|agent|observer`, дефолт — investor.
 */

const { Router } = require("express");
const { authMiddleware, getUser } = require("../auth.js");
const { getOntology } = require("../ontologyRegistry.cjs");
const { filterWorldForRole } = require("../schema/filterWorld.cjs");
const { materializeAsDocument, renderDocumentHtml } = require("../schema/documentMaterializer.cjs");
const { foldWorld } = require("../validator.js");

function makeDocumentRouter() {
  const router = Router({ mergeParams: true });

  router.use(authMiddleware);

  router.get("/:projection", (req, res) => {
    const domain = req.params.domain;
    const projectionId = req.params.projection;
    const format = (req.query.format || "").toLowerCase()
      || (req.accepts(["html", "json"]) === "json" ? "json" : "html");
    const role = (req.query.as || "investor").toLowerCase();

    const ontology = getOntology(domain);
    if (!ontology) {
      return res.status(503).json({ error: "ontology_unavailable", domain });
    }

    // Projections — не в ontology, а в domain.projections. Клиент должен
    // POST-нуть их отдельно. Для v1 — принимаем projection-spec по
    // имени из projections registry (ниже).
    const projections = ontology.projections || {};
    const projection = projections[projectionId];
    if (!projection) {
      return res.status(404).json({
        error: "projection_not_found",
        projection: projectionId,
        domain,
        hint: "Клиент должен публиковать ontology с projections через /api/typemap",
      });
    }

    const user = getUser(req);
    const viewer = { id: user.id, name: user.name, email: user.email };

    // Собираем scoped world через filterWorldForRole (reuses m2m/scope logic).
    let scopedWorld;
    try {
      const fullWorld = foldWorld();
      scopedWorld = filterWorldForRole(fullWorld, ontology, role, viewer);
    } catch (err) {
      return res.status(400).json({ error: "filter_failed", reason: err.message });
    }

    const routeParams = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (["format", "as"].includes(k)) continue;
      routeParams[k] = v;
    }

    const doc = materializeAsDocument(projection, scopedWorld, viewer, {
      ontology,
      allProjections: projections,
      routeParams,
      domain,
    });

    console.log(`[document] GET /${domain}/${projectionId} ${viewer.id} as=${role} → 200 ${format}`);

    if (format === "json") {
      return res.json(doc);
    }

    // HTML по умолчанию
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.send(renderDocumentHtml(doc));
  });

  return router;
}

module.exports = { makeDocumentRouter };
