/**
 * openapiAttach — file upload для PM/CTO authoring flow.
 *
 * 1) saveAttachment   — multipart buffer → файл на диске (staging),
 *                       проверка размер/extension/YAML-валидность.
 * 2) uploadToAnthropic — отправляет файл в Anthropic Files API (beta).
 * 3) removeAttachment  — cleanup staging-файла.
 */

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const yaml = require("js-yaml");

const ALLOWED_EXT = [".yaml", ".yml", ".json"];
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024; // 10MB

function safeFilename(originalName, sessionId) {
  const ext = path.extname(originalName).toLowerCase() || ".yaml";
  const ts = Date.now();
  return `attach_${sessionId}_${ts}${ext}`;
}

async function saveAttachment({ stagingDir, sessionId, originalName, buffer, maxBytes = DEFAULT_MAX_BYTES }) {
  const ext = path.extname(originalName).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    throw new Error(`unsupported extension "${ext}", allowed: ${ALLOWED_EXT.join(",")}`);
  }
  if (buffer.length > maxBytes) {
    throw new Error(`file too_large: ${buffer.length} > ${maxBytes}`);
  }
  const text = buffer.toString("utf8");
  try {
    if (ext === ".json") {
      JSON.parse(text);
    } else {
      yaml.load(text);
    }
  } catch (e) {
    throw new Error(`yaml/json parse failed: ${e.message}`);
  }
  await fsp.mkdir(stagingDir, { recursive: true });
  const fileName = safeFilename(originalName, sessionId);
  const filePath = path.join(stagingDir, fileName);
  await fsp.writeFile(filePath, buffer);
  const mediaType = ext === ".json" ? "application/json" : "application/yaml";
  return { path: filePath, name: fileName, size: buffer.length, mediaType };
}

async function uploadToAnthropic({ filePath, client, apiKey }) {
  if (!client) {
    if (!apiKey) apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("uploadToAnthropic: ANTHROPIC_API_KEY required");
    const Anthropic = require("@anthropic-ai/sdk").default || require("@anthropic-ai/sdk");
    client = new Anthropic({
      apiKey,
      defaultHeaders: { "anthropic-beta": "files-api-2025-04-14" },
    });
  }
  const buffer = await fsp.readFile(filePath);
  const mediaType = filePath.endsWith(".json") ? "application/json" : "application/yaml";
  const result = await client.beta.files.upload({
    file: {
      name: path.basename(filePath),
      data: buffer,
      type: mediaType,
    }
  });
  return { fileId: result.id, name: result.filename || path.basename(filePath) };
}

async function removeAttachment(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}

module.exports = { saveAttachment, uploadToAnthropic, removeAttachment, ALLOWED_EXT, DEFAULT_MAX_BYTES };
