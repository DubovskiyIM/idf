/**
 * documentMaterializer — §1 manifesto: «document» как равноправная
 * материализация проекции, наравне с pixels / voice / agent-API
 * (§26.3 закрытие).
 *
 * Работает поверх той же артефакт-модели v2 (projection + archetype +
 * slots), что и пиксельный рендер. Разный output, одинаковый вход.
 *
 * Output — нормализованный document-граф:
 *   {
 *     title, subtitle, meta: { date, viewer, domain, projection },
 *     sections: [
 *       { id, heading, kind: "paragraph"|"table"|"list"|"signature",
 *         ... kind-specific data ... }
 *     ],
 *     footer: { note, auditTrail }
 *   }
 *
 * HTML-рендер (renderDocumentHtml) — просто строка с inline-стилями для
 * print-ready вывода. Агент/клиент/сервер могут трансформировать
 * document-граф в свой формат (PDF через puppeteer, DOCX через docx-js,
 * plain text для голоса, и т.д.).
 *
 * Поддерживаемые архетипы:
 *   catalog  → таблица (колонки = witnesses, строки = filtered rows)
 *   detail   → section с witnesses как key-value, sub-collections как таблицы
 *   dashboard → multi-section: каждая embedded проекция = свой блок
 *   feed     → список записей (как catalog)
 *   canvas   → plain paragraph с placeholder (domain-specific)
 *   wizard   → не поддерживается (interactive flow)
 */

function pluralize(word) {
  if (!word) return word;
  if (word.endsWith("y")) return word.slice(0, -1) + "ies";
  if (word.endsWith("s")) return word + "es";
  return word + "s";
}

function findCollection(world, entityName) {
  if (!entityName) return [];
  const candidates = [pluralize(entityName.toLowerCase())];
  const segs = entityName.match(/[A-Z][a-z]*/g) || [];
  if (segs.length > 1) candidates.push(pluralize(segs[segs.length - 1].toLowerCase()));
  for (const c of candidates) {
    if (Array.isArray(world[c])) return world[c];
  }
  return [];
}

function evalFilter(expr, item, viewer) {
  if (!expr) return true;
  try {
    // Тот же паттерн, что в ArchetypeWizard/crystallize_v2 eval.js:
    // поля item передаются как именованные аргументы функции.
    // Строковые литералы в expression остаются нетронутыми (не парсим regex'ом).
    const keys = Object.keys(item);
    const fn = new Function(...keys, "viewer", `return !!(${expr})`);
    return fn(...keys.map(k => item[k]), viewer);
  } catch {
    return true; // permissive fallback
  }
}

function humanizeValue(val, fieldName) {
  if (val == null || val === "") return "—";
  // timestamp heuristic
  if (typeof val === "number" && val > 1e12 && /[Aa]t$|timestamp/.test(fieldName || "")) {
    return new Date(val).toLocaleString("ru");
  }
  if (typeof val === "number" && /[Aa]mount|[Pp]rice|[Tt]otal|pnl|fee|value/.test(fieldName || "")) {
    return `${val.toLocaleString("ru")} ₽`;
  }
  return String(val);
}

function humanizeFieldName(name) {
  // camelCase → "Camel Case"
  return name
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, c => c.toUpperCase())
    .trim();
}

function materializeCatalog(projection, world, viewer) {
  const rows = findCollection(world, projection.mainEntity);
  const filtered = projection.filter
    ? rows.filter(r => evalFilter(projection.filter, r, viewer))
    : rows;

  const witnesses = projection.witnesses || [];

  return {
    id: "catalog",
    heading: projection.name || "Список",
    kind: "table",
    columns: witnesses.map(w => ({ id: w, label: humanizeFieldName(w) })),
    rows: filtered.map(r => ({
      id: r.id,
      cells: witnesses.reduce((acc, w) => {
        acc[w] = humanizeValue(r[w], w);
        return acc;
      }, {}),
    })),
    rowCount: filtered.length,
  };
}

function materializeDetail(projection, world, viewer, routeParams = {}) {
  const rows = findCollection(world, projection.mainEntity);
  const idParam = projection.idParam;
  const targetId = routeParams[idParam];
  const mainRow = targetId ? rows.find(r => r.id === targetId) : rows[0];

  const sections = [];

  if (!mainRow) {
    sections.push({
      id: "not_found",
      heading: "Не найдено",
      kind: "paragraph",
      content: `Сущность ${projection.mainEntity} с ${idParam}=${targetId} не найдена.`,
    });
    return sections;
  }

  // 1. Основные поля через witnesses
  const witnesses = projection.witnesses || [];
  sections.push({
    id: "main",
    heading: projection.name || projection.mainEntity,
    kind: "table",
    columns: [
      { id: "field", label: "Поле" },
      { id: "value", label: "Значение" },
    ],
    rows: witnesses.map(w => ({
      id: w,
      cells: { field: humanizeFieldName(w), value: humanizeValue(mainRow[w], w) },
    })),
    rowCount: witnesses.length,
  });

  // 2. Sub-collections как отдельные таблицы
  const subColls = projection.subCollections || [];
  for (const sub of subColls) {
    const subRows = (world[sub.collection] || [])
      .filter(r => r[sub.foreignKey] === mainRow.id);
    if (subRows.length === 0) continue;
    const fields = Object.keys(subRows[0] || {}).filter(f => f !== "id").slice(0, 6);
    sections.push({
      id: `sub_${sub.collection}`,
      heading: sub.title || sub.collection,
      kind: "table",
      columns: fields.map(f => ({ id: f, label: humanizeFieldName(f) })),
      rows: subRows.map(r => ({
        id: r.id,
        cells: fields.reduce((acc, f) => { acc[f] = humanizeValue(r[f], f); return acc; }, {}),
      })),
      rowCount: subRows.length,
    });
  }

  return sections;
}

function materializeDashboard(projection, world, viewer, allProjections) {
  const sections = [];
  const embedded = projection.embedded || [];
  for (const emb of embedded) {
    const subProj = allProjections?.[emb.projection];
    if (!subProj) continue;
    if (subProj.kind === "catalog" || subProj.kind === "feed") {
      sections.push(materializeCatalog(subProj, world, viewer));
    }
  }
  return sections;
}

/**
 * Главная точка входа.
 * @param projection {object} — decl из ontology.projections
 * @param world {object} — отфильтрованный world (viewer-scoped)
 * @param viewer {object} — { id, name, email? }
 * @param opts {object} — { ontology, allProjections, routeParams, domain }
 * @returns document-граф
 */
function materializeAsDocument(projection, world, viewer, opts = {}) {
  const { allProjections = {}, routeParams = {}, domain = "" } = opts;
  const now = new Date();

  const doc = {
    title: projection.name || projection.id || "Документ",
    subtitle: `${domain ? `Домен: ${domain}` : ""}`.trim(),
    meta: {
      date: now.toISOString(),
      dateFormatted: now.toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" }),
      viewer: viewer?.name || viewer?.id || "—",
      viewerEmail: viewer?.email || null,
      domain,
      projection: projection.id || null,
      materialization: "document",
      generator: "IDF documentMaterializer v1",
    },
    sections: [],
    footer: {
      note: "Документ сгенерирован из Φ-журнала причинно-упорядоченных эффектов (§10 Intent-Driven Manifesto).",
      auditTrail: "Каждая запись восстановима через parent_id-цепочку эффектов.",
    },
  };

  switch (projection.kind) {
    case "catalog":
    case "feed":
      doc.sections.push(materializeCatalog(projection, world, viewer));
      break;

    case "detail":
      doc.sections.push(...materializeDetail(projection, world, viewer, routeParams));
      break;

    case "dashboard":
      doc.sections.push(...materializeDashboard(projection, world, viewer, allProjections));
      break;

    case "canvas":
      doc.sections.push({
        id: "canvas",
        heading: projection.name || "Canvas",
        kind: "paragraph",
        content: `Canvas-проекция «${projection.name}» не имеет plain-text материализации. Смотрите pixel-рендер или запросите custom document-рендер для canvasType=${projection.canvasType}.`,
      });
      break;

    case "wizard":
      doc.sections.push({
        id: "wizard_not_supported",
        heading: "Wizard",
        kind: "paragraph",
        content: "Wizard — интерактивный flow. Document-материализация недоступна.",
      });
      break;

    default:
      doc.sections.push({
        id: "unknown",
        heading: "Unknown",
        kind: "paragraph",
        content: `Неизвестный архетип ${projection.kind}`,
      });
  }

  return doc;
}

/**
 * HTML-рендер document-графа. Print-ready inline styles, A4 layout.
 * Браузер может → «Save as PDF» через window.print().
 */
function renderDocumentHtml(doc) {
  const styles = `
    body { font-family: 'Times New Roman', Times, serif; color: #1a1a2e; background: #fff; margin: 0; padding: 40px 48px; }
    .header { border-bottom: 2px solid #1a1a2e; padding-bottom: 16px; margin-bottom: 24px; }
    .tag { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.1em; }
    h1 { font-size: 24px; margin: 8px 0 4px; font-weight: 700; }
    .meta { font-size: 13px; color: #6b7280; }
    h2 { font-size: 16px; margin-top: 24px; margin-bottom: 12px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 16px; }
    th, td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
    th { background: #f9fafb; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #6b7280; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; line-height: 1.5; }
    .empty { color: #9ca3af; font-style: italic; }
    @media print { body { padding: 0; } }
  `.replace(/\s+/g, " ");

  const escape = (s) => String(s == null ? "" : s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

  const renderSection = (s) => {
    if (s.kind === "paragraph") {
      return `<section><h2>${escape(s.heading)}</h2><p>${escape(s.content)}</p></section>`;
    }
    if (s.kind === "table") {
      if (!s.rows || s.rows.length === 0) {
        return `<section><h2>${escape(s.heading)}</h2><p class="empty">Нет данных</p></section>`;
      }
      const th = s.columns.map(c => `<th>${escape(c.label)}</th>`).join("");
      const body = s.rows.map(r =>
        `<tr>${s.columns.map(c => `<td>${escape(r.cells[c.id])}</td>`).join("")}</tr>`
      ).join("");
      return `<section><h2>${escape(s.heading)} <span style="font-weight:400;font-size:12px;color:#9ca3af">(${s.rowCount})</span></h2><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></section>`;
    }
    return "";
  };

  return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>${escape(doc.title)}</title><style>${styles}</style></head><body>
<div class="header">
  <div class="tag">Document materialization · ${escape(doc.meta.generator)}</div>
  <h1>${escape(doc.title)}</h1>
  <div class="meta">${escape(doc.subtitle)} · Клиент: ${escape(doc.meta.viewer)} · Дата: ${escape(doc.meta.dateFormatted)}</div>
</div>
${doc.sections.map(renderSection).join("\n")}
<div class="footer">${escape(doc.footer.note)}<br/>${escape(doc.footer.auditTrail)}</div>
</body></html>`;
}

module.exports = { materializeAsDocument, renderDocumentHtml };
