/**
 * Layered authoring — прототип на sales.
 *
 * Переписывает 4 canonical проекции (listing_detail, order_list, order_detail,
 * dispute_detail) + 3 renames (listing_feed, my_listings, my_bids) в формате
 * composeProjections(INTENTS, ONTOLOGY, OVERRIDES, EXTRA).
 *
 * Цель — измерить реальное сокращение авторского кода и убедиться, что
 * композированная проекция эквивалентна ручной по семантике (key-by-key).
 */
// Требует @intent-driven/core >= 0.17 (PR #61) с composeProjections + witness trail.
import { composeProjections, deriveProjections } from "@intent-driven/core";
import { INTENTS, PROJECTIONS, ONTOLOGY } from "../src/domains/sales/domain.js";

// ---------- Layer 1: OVERRIDES (косметика поверх деривации) ----------
const OVERRIDES = {
  // Canonical detail — rename не нужен, только косметика.
  listing_detail: {
    name: "Лот",
    query: "детали одного лота с историей ставок",
    entities: ["Listing", "Bid"],
    idParam: "listingId",
    routeEntities: ["Bid"],
    witnesses: [
      "title", "description", "currentPrice", "startPrice", "buyNowPrice",
      { field: "bidCount", compute: "count(bids, listingId=target.id)" },
      "auctionEnd", "condition", "images", "shippingCost", "shippingFrom", "status",
    ],
    subCollections: [
      { entity: "Bid", foreignKey: "listingId", sort: "-amount", label: "Ставки" },
    ],
  },

  order_list: {
    name: "Заказы",
    query: "заказы пользователя (покупки и продажи)",
    entities: ["Order", "Listing", "User"],
    routeEntities: ["Listing", "User"],
    filter: "buyerId === (viewer && viewer.id) || sellerId === (viewer && viewer.id)",
    sort: "-createdAt",
    witnesses: ["totalAmount", "status", "listing.title", "trackingNumber", "createdAt"],
    onItemClick: {
      action: "navigate",
      to: "order_detail",
      params: { orderId: "item.id" },
    },
  },

  order_detail: {
    name: "Заказ",
    query: "детали одного заказа",
    entities: ["Order", "Listing", "User", "Dispute"],
    idParam: "orderId",
    routeEntities: ["Listing", "User"],
    witnesses: [
      "totalAmount", "status", "listing.title", "listing.images",
      "trackingNumber", "shippingAddress", "paymentMethod", "buyerId", "sellerId", "createdAt",
    ],
  },

  dispute_detail: {
    name: "Спор",
    query: "детали спора по заказу",
    entities: ["Dispute", "Order"],
    idParam: "disputeId",
    routeEntities: ["Order"],
    witnesses: ["reason", "status", "description", "resolution", "order.totalAmount", "raisedBy", "createdAt"],
  },

  // Renames: derived id → authored id + дополнения.
  listing_list: {
    as: "listing_feed",
    name: "Лента",
    query: "публичная лента лотов",
    witnesses: ["title", "currentPrice", "auctionEnd", "bidCount", "images"],
    kind: "feed",  // override derived catalog → feed (presentational)
  },

  my_listing_list: {
    as: "my_listings",
    name: "Мои лоты",
    entities: ["Listing"],
    routeEntities: [],
    sort: "-createdAt",
    witnesses: ["title", "currentPrice", "bidCount", "status", "auctionEnd"],
  },

  my_bid_list: {
    as: "my_bids",
    name: "Мои ставки",
    entities: ["Bid", "Listing"],
    routeEntities: ["Listing"],
    sort: "-amount",
    witnesses: ["amount", "listing.title", "listing.currentPrice", "placedAt", "status"],
    onItemClick: {
      action: "navigate",
      to: "listing_detail",
      params: { listingId: "item.listingId" },
    },
  },
};

// ---------- Layer 2: EXTRA (архетипы без R-правил) ----------
const EXTRA = {
  sales_home: PROJECTIONS.sales_home,  // dashboard
  listing_detail_edit: PROJECTIONS.listing_detail_edit,  // form
};

// ---------- Компоновка + сравнение ----------
const composed = composeProjections(INTENTS, ONTOLOGY, OVERRIDES, EXTRA);

const CANONICAL_IDS = ["listing_detail", "order_list", "order_detail", "dispute_detail"];
const RENAME_IDS   = ["listing_feed", "my_listings", "my_bids"];

console.log(`# sales — Layered authoring прототип\n`);

console.log(`## Покрытие`);
console.log(`authored (PROJECTIONS):         ${Object.keys(PROJECTIONS).length}`);
console.log(`composed (OVERRIDES+EXTRA):     ${Object.keys(composed).length}`);
console.log(`переделано в Layer 1 format:    ${Object.keys(OVERRIDES).length}`);
console.log(`осталось EXTRA (архетип-free):  ${Object.keys(EXTRA).length}`);

console.log(`\n## Семантическая эквивалентность (composed vs authored)`);
const comparable = [...CANONICAL_IDS, ...RENAME_IDS];
for (const id of comparable) {
  const a = PROJECTIONS[id];
  const c = composed[id];
  if (!a) { console.log(`  ${id.padEnd(22)} — нет в authored`); continue; }
  if (!c) { console.log(`  ${id.padEnd(22)} — нет в composed`); continue; }

  const keys = new Set([...Object.keys(a), ...Object.keys(c).filter(k => k !== "derivedBy")]);
  const mismatched = [];
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(c[k])) mismatched.push(k);
  }
  if (mismatched.length === 0) {
    console.log(`  ${id.padEnd(22)} ✓ identical`);
  } else {
    console.log(`  ${id.padEnd(22)} ≠ mismatch on: ${mismatched.join(", ")}`);
  }
}

console.log(`\n## Witness origin преимущество composed`);
let withWitnesses = 0;
for (const id of comparable) {
  const c = composed[id];
  if (!c?.derivedBy) continue;
  withWitnesses++;
  const rules = c.derivedBy.map(w => w.ruleId).join(", ");
  console.log(`  ${id.padEnd(22)} derivedBy = [${rules}]`);
}
console.log(`\n  ${withWitnesses}/${comparable.length} проекций несут derivation origin — authored не имеет ни одного.`);

// LOC measure: JSON.stringify длина как proxy
function loc(obj) { return JSON.stringify(obj, null, 2).split("\n").length; }
let authoredLOC = 0, overrideLOC = 0;
for (const id of comparable) {
  authoredLOC += loc(PROJECTIONS[id] || {});
  overrideLOC += loc(OVERRIDES[id] || OVERRIDES[Object.keys(OVERRIDES).find(k => OVERRIDES[k].as === id)] || {});
}
console.log(`\n## LOC (строк pretty-print JSON)`);
console.log(`  authored:  ${authoredLOC}`);
console.log(`  overrides: ${overrideLOC}  (-${authoredLOC - overrideLOC} LOC, -${Math.round((1 - overrideLOC / authoredLOC) * 100)}%)`);

// Raw source lines check
const fs = await import("fs");
const authoredSrc = fs.readFileSync(new URL("../src/domains/sales/projections.js", import.meta.url), "utf8");
const authoredLines = authoredSrc.split("\n").length;
const overridesSrc = JSON.stringify(OVERRIDES, null, 2);
const overridesLines = overridesSrc.split("\n").length;
console.log(`\n## Raw source lines`);
console.log(`  sales/projections.js:             ${authoredLines} строк (весь файл)`);
console.log(`  OVERRIDES (7 проекций) pretty:    ${overridesLines} строк`);
