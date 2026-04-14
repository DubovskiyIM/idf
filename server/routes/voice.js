/**
 * /api/voice/:domain/:projection — voice materialization (§1, §17).
 *
 * Выходы (Accept / ?format):
 *   text/plain        → plain text для debug / IVR baseline
 *   application/ssml+xml → SSML XML для TTS-engines
 *   application/json  → structured turns для voice-agent (Claude Voice, OpenAI realtime)
 *
 * Auth: JWT, viewer берётся из токена. Роль через ?as=role.
 * Реиспользует filterWorldForRole — voice viewer-scoped через role.scope/ownerField.
 */

const { Router } = require("express");
const { authMiddleware, getUser } = require("../auth.js");
const { getOntology } = require("../ontologyRegistry.cjs");
const { getDomainIntents } = require("../intents.js");
const { filterWorldForRole } = require("../schema/filterWorld.cjs");
const { materializeAsVoice, renderVoiceSsml, renderVoicePlain } = require("../schema/voiceMaterializer.cjs");
const { foldWorld } = require("../validator.js");

function makeVoiceRouter() {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

  router.get("/:projection", (req, res) => {
    const domain = req.params.domain;
    const projectionId = req.params.projection;
    const formatQuery = (req.query.format || "").toLowerCase();
    const format = formatQuery
      || (req.accepts(["json", "xml", "text"]) === "json" ? "json"
          : req.accepts(["json", "xml", "text"]) === "xml" ? "ssml"
          : "plain");
    const role = (req.query.as || "owner").toLowerCase();

    const ontology = getOntology(domain);
    if (!ontology) {
      return res.status(503).json({ error: "ontology_unavailable", domain });
    }

    const projections = ontology.projections || {};
    const projection = projections[projectionId];
    if (!projection) {
      return res.status(404).json({
        error: "projection_not_found",
        projection: projectionId, domain,
      });
    }

    const user = getUser(req);
    const viewer = { id: user.id, name: user.name, email: user.email };

    let scopedWorld;
    try {
      const fullWorld = foldWorld();
      scopedWorld = filterWorldForRole(fullWorld, ontology, role, viewer);
    } catch (err) {
      return res.status(400).json({ error: "filter_failed", reason: err.message });
    }

    // Подмешиваем intents для extractPrompts (опционально — не критично)
    const ontologyWithIntents = {
      ...ontology,
      intents: getDomainIntents(domain),
    };

    const routeParams = {};
    for (const [k, v] of Object.entries(req.query)) {
      if (["format", "as"].includes(k)) continue;
      routeParams[k] = v;
    }

    const script = materializeAsVoice(projection, scopedWorld, viewer, {
      ontology: ontologyWithIntents,
      allProjections: projections,
      routeParams, domain, viewerRole: role,
      locale: req.query.locale || "ru-RU",
    });

    console.log(`[voice] GET /${domain}/${projectionId} ${viewer.id} as=${role} → 200 ${format}`);

    if (format === "json") return res.json(script);
    if (format === "ssml" || format === "xml") {
      res.setHeader("Content-Type", "application/ssml+xml; charset=utf-8");
      return res.send(renderVoiceSsml(script));
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(renderVoicePlain(script));
  });

  return router;
}

module.exports = { makeVoiceRouter };
