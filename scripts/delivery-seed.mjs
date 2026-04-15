/**
 * delivery-seed — bootstrap demo данные для delivery-домена.
 *
 * ~40 эффектов для заполнения пустого Φ реалистичным миром:
 * - 4 курьера (User с role="courier")
 * - 3 мерчанта (Merchant + ownerUser)
 * - 10 MenuItem (3-4 на мерчанта)
 * - 2 Zone (центр + восток Москвы)
 * - 2 DispatcherAssignment (активные смены)
 * - 1 Order в статусе "ready" для демо
 * - 3 OrderItem для этого заказа
 * - 1 Payment hold
 * - Address lookups для заказа
 */

import { randomUUID } from "node:crypto";

const MAIN_SERVER = process.env.IDF_MAIN_SERVER || "http://localhost:3001";
const now = Date.now();
const effects = [];

const ef = (props) => effects.push({
  id: randomUUID(),
  intent_id: "_seed",
  alpha: "add",
  scope: "account",
  parent_id: null,
  status: "confirmed",
  ttl: null,
  created_at: now,
  resolved_at: now,
  ...props,
});

// ── Couriers (4)
const COURIERS = ["courier_1", "courier_2", "courier_3", "courier_4"];
COURIERS.forEach((id, i) => {
  ef({ target: "User", context: { id, name: `Курьер ${i+1}`, email: `${id}@delivery.local`, role: "courier", rating: 4.5 + Math.random() * 0.5, createdAt: now } });
});

// ── Merchants (3)
const MERCHANTS = [
  { id: "merch_1", ownerId: "m_user_1", name: "Пицца-бар", type: "pizza" },
  { id: "merch_2", ownerId: "m_user_2", name: "Суши-мастер", type: "sushi" },
  { id: "merch_3", ownerId: "m_user_3", name: "Бургер-кинг-фуд", type: "burgers" },
];
MERCHANTS.forEach(m => {
  ef({ target: "User", context: { id: m.ownerId, name: `Владелец ${m.name}`, email: `${m.ownerId}@delivery.local`, role: "merchant", createdAt: now } });
  ef({ target: "Merchant", context: { id: m.id, ownerId: m.ownerId, name: m.name, type: m.type, rating: 4.5, status: "active", createdAt: now } });
});

// ── MenuItem (10)
const MENU = [
  { merch: "merch_1", name: "Маргарита", price: 590 },
  { merch: "merch_1", name: "Четыре сыра", price: 690 },
  { merch: "merch_1", name: "Пепперони", price: 650 },
  { merch: "merch_2", name: "Сет Филадельфия", price: 1290 },
  { merch: "merch_2", name: "Сет Калифорния", price: 990 },
  { merch: "merch_2", name: "Мисо-суп", price: 290 },
  { merch: "merch_3", name: "Чизбургер", price: 390 },
  { merch: "merch_3", name: "Двойной бургер", price: 590 },
  { merch: "merch_3", name: "Картофель фри", price: 190 },
  { merch: "merch_3", name: "Милкшейк", price: 290 },
];
MENU.forEach((item, i) => {
  ef({ target: "MenuItem", context: {
    id: `item_${i+1}`, merchantId: item.merch, name: item.name,
    price: item.price, category: "main", available: true, createdAt: now
  } });
});

// ── Zones (2)
const ZONES = [
  { id: "zone_center", name: "Центр", city: "Москва",
    polygon: [
      { lat: 55.760, lng: 37.600 }, { lat: 55.760, lng: 37.640 },
      { lat: 55.745, lng: 37.640 }, { lat: 55.745, lng: 37.600 },
    ] },
  { id: "zone_east", name: "Восток", city: "Москва",
    polygon: [
      { lat: 55.760, lng: 37.640 }, { lat: 55.760, lng: 37.680 },
      { lat: 55.745, lng: 37.680 }, { lat: 55.745, lng: 37.640 },
    ] },
];
ZONES.forEach(z => {
  ef({ target: "Zone", context: { ...z, createdAt: now } });
});

// ── Dispatcher + assignments (1 dispatcher на обе зоны)
ef({ target: "User", context: { id: "disp_1", name: "Диспетчер Иван", email: "disp_1@delivery.local", role: "dispatcher", createdAt: now } });
ef({ target: "DispatcherAssignment", context: {
  id: "dassign_1", dispatcherId: "disp_1", zoneId: "zone_center",
  status: "active", shiftStart: now - 3600_000, shiftEnd: now + 18000_000
} });
ef({ target: "DispatcherAssignment", context: {
  id: "dassign_2", dispatcherId: "disp_1", zoneId: "zone_east",
  status: "active", shiftStart: now - 3600_000, shiftEnd: now + 18000_000
} });

// ── Customer + demo Order (ready, ждёт курьера)
ef({ target: "User", context: { id: "cust_1", name: "Клиент Анна", email: "anna@delivery.local", role: "customer", createdAt: now } });

// Address (mirror-like)
ef({ target: "Address", context: {
  id: "addr_demo", text: "Тверская 10", lat: 55.7648, lng: 37.6053, placeId: "pl_tv10",
  source: "seed"
} });

// Order
ef({ target: "Order", context: {
  id: "order_demo", customerId: "cust_1", merchantId: "merch_1",
  status: "ready", totalAmount: 1240, addressId: "addr_demo",
  etaCook: now - 600_000, etaDelivery: now + 1800_000, createdAt: now - 1200_000
} });

// OrderItems (3 позиции на 1240р)
ef({ target: "OrderItem", context: { id: "oi_1", orderId: "order_demo", menuItemId: "item_1", quantity: 1, price: 590 } });
ef({ target: "OrderItem", context: { id: "oi_2", orderId: "order_demo", menuItemId: "item_2", quantity: 1, price: 650 } });

// Payment (hold, не captured — потенциал для irreversibility демо)
ef({ target: "Payment", context: {
  id: "pay_demo", orderId: "order_demo", customerId: "cust_1",
  amount: 1240, status: "held", holdAt: now - 1200_000
} });

// ── POST batch
console.log(`[delivery-seed] подготовлено ${effects.length} эффектов`);

const res = await fetch(`${MAIN_SERVER}/api/effects/seed`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(effects),
});

if (!res.ok) {
  console.error(`[delivery-seed] failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const json = await res.json();
console.log(`[delivery-seed] ✓ загружено ${json.count || effects.length} эффектов в ${MAIN_SERVER}`);
