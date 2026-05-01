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
const { synthesize: synthesizeTts } = require("../schema/ttsAdapter.cjs");
const { foldWorld } = require("../validator.js");

function makeVoiceRouter() {
  const router = Router({ mergeParams: true });
  router.use(authMiddleware);

  router.get("/:projection", async (req, res) => {
    const domain = req.params.domain;
    const projectionId = req.params.projection;
    const formatQuery = (req.query.format || "").toLowerCase();
    const format = formatQuery
      || (req.accepts(["json", "xml", "text"]) === "json" ? "json"
          : req.accepts(["json", "xml", "text"]) === "xml" ? "ssml"
          : "plain");
    const voice = req.query.voice || process.env.IDF_TTS_VOICE || "alloy";
    // Role identifier — case-sensitive (ontology может использовать camelCase).
    const role = req.query.as || "owner";

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

    const user = getUser(req.userId);
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
    if (format === "audio") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(501).json({
          error: "tts_not_configured",
          detail: "OPENAI_API_KEY не задан в окружении. TTS отключён.",
        });
      }
      try {
        const ssml = renderVoiceSsml(script);
        const { contentType, audio } = await synthesizeTts(ssml, { apiKey, voice });
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=3600");
        return res.end(audio);
      } catch (err) {
        console.error(`[voice] TTS upstream error: ${err.message}`);
        return res.status(502).json({ error: "tts_upstream", detail: err.message });
      }
    }
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.send(renderVoicePlain(script));
  });

  return router;
}

module.exports = { makeVoiceRouter };
