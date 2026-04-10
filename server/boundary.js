const { v4: uuid } = require("uuid");
const db = require("./db.js");
const { foldWorld } = require("./validator.js");

const EXTERNAL_URL = "http://localhost:3002/api/slots";
const SYNC_INTERVAL = 30000;

let broadcast = () => {};

function setBroadcast(fn) {
  broadcast = fn;
}

async function sync() {
  let externalSlots;
  try {
    const res = await fetch(EXTERNAL_URL);
    externalSlots = await res.json();
  } catch (e) {
    return; // внешний календарь недоступен
  }

  const world = foldWorld();
  const currentSlots = world.slots || [];
  const currentById = {};
  for (const s of currentSlots) currentById[s.id] = s;

  // Найти активные бронирования по slotId — источник истины для дрейфа
  const activeBookings = (world.bookings || []).filter(b => b.status === "confirmed");
  const bookedSlotIds = new Set(activeBookings.map(b => b.slotId));

  const externalById = {};
  for (const s of externalSlots) externalById[s.id] = s;

  const now = Date.now();
  const changes = [];

  // 1. Новые слоты снаружи (которых нет у нас совсем)
  for (const ext of externalSlots) {
    if (!currentById[ext.id]) {
      const effectId = uuid();
      insertForeignEffect({
        id: effectId, alpha: "add", target: "slots",
        context: { id: ext.id, specialistId: ext.specialistId, date: ext.date, startTime: ext.startTime, endTime: ext.endTime, status: ext.status, foreign: "external_calendar" },
        created_at: now
      });
      changes.push({ type: "add", slotId: ext.id });
      broadcast("effect:confirmed", { id: effectId });
    }
  }

  // 2. Слоты удалены снаружи
  for (const cur of currentSlots) {
    if (!externalById[cur.id]) {
      // Проверяем по бронированиям, а не по fold-статусу слота
      if (bookedSlotIds.has(cur.id)) {
        emitDrift(`Слот ${cur.date} ${cur.startTime} удалён извне, но у нас забронирован!`, now);
        changes.push({ type: "drift", slotId: cur.id, reason: "deleted_while_booked" });
        continue;
      }

      const effectId = uuid();
      insertForeignEffect({
        id: effectId, alpha: "remove", target: "slots",
        context: { id: cur.id, foreign: "external_calendar" },
        created_at: now
      });
      changes.push({ type: "remove", slotId: cur.id });
      broadcast("effect:confirmed", { id: effectId });
    }
  }

  // 3. Статус изменился снаружи
  for (const ext of externalSlots) {
    const cur = currentById[ext.id];
    if (!cur) continue;

    // Пропускаем если внешний статус совпадает с нашим
    if (cur.status === ext.status) continue;

    // Пропускаем если наш статус booked/held — внешний календарь не знает о наших бронях
    // (мок-API не получает наши бронирования, поэтому показывает free/blocked)

    // Шумный дрейф: у нас есть бронирование на этот слот, а снаружи blocked
    if (bookedSlotIds.has(ext.id) && ext.status !== "free") {
      emitDrift(`Слот ${cur.date} ${cur.startTime} стал "${ext.status}" извне, но у нас забронирован!`, now);
      changes.push({ type: "drift", slotId: cur.id, reason: `${ext.status}_while_booked` });
      continue;
    }

    // Если слот held у нас и blocked снаружи — дрейф
    if (cur.status === "held" && ext.status === "blocked") {
      emitDrift(`Слот ${cur.date} ${cur.startTime} заблокирован извне, клиент ждёт подтверждения!`, now);
      changes.push({ type: "drift", slotId: cur.id, reason: "blocked_while_held" });
      continue;
    }

    // Если у нас booked/held но нет в bookedSlotIds — sync уже обработал
    if (cur.status === "booked" || cur.status === "held") continue;

    // Обычное обновление — внешний авторитет побеждает
    const effectId = uuid();
    insertForeignEffect({
      id: effectId, alpha: "replace", target: "slot.status",
      value: ext.status,
      context: { id: ext.id, foreign: "external_calendar" },
      created_at: now
    });
    changes.push({ type: "update", slotId: ext.id, from: cur.status, to: ext.status });
    broadcast("effect:confirmed", { id: effectId });
  }

  if (changes.length > 0) {
    console.log(`  [sync] ${changes.length} изменений:`, changes.map(c => `${c.type} ${c.slotId}`).join(", "));
  } else {
    // Лог для отладки — показать расхождения
    let diffs = 0;
    for (const ext of externalSlots) {
      const cur = currentById[ext.id];
      if (cur && cur.status !== ext.status) diffs++;
    }
    if (diffs > 0) console.log(`  [sync] ${diffs} расхождений обнаружено, но пропущено (booked/held)`);
  }
}

function insertForeignEffect(ef) {
  db.prepare(`
    INSERT INTO effects (id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at, resolved_at)
    VALUES (?, '_sync', ?, ?, ?, 'shared', NULL, 'confirmed', NULL, ?, ?, ?)
  `).run(
    ef.id, ef.alpha, ef.target,
    ef.value != null ? JSON.stringify(ef.value) : null,
    JSON.stringify(ef.context),
    ef.created_at, ef.created_at
  );
}

function emitDrift(description, now) {
  broadcast("signal:drift", { description, time: now });
}

function startSync() {
  setTimeout(() => {
    sync();
    setInterval(sync, SYNC_INTERVAL);
  }, 5000);
  console.log(`  Синхронизация с внешним календарём: каждые ${SYNC_INTERVAL / 1000}с`);
}

module.exports = { startSync, setBroadcast };
