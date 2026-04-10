const { v4: uuid } = require("uuid");
const db = require("./db.js");

function seed() {
  const count = db.prepare("SELECT COUNT(*) as n FROM effects").get().n;
  if (count > 0) return;

  const now = Date.now();

  // Специалист
  const specialistId = "sp_anna";
  insertEffect({
    id: uuid(), intent_id: "_seed", alpha: "add", target: "specialists",
    value: null, scope: "account", context: {
      id: specialistId, name: "Анна Иванова", specialization: "Парикмахер"
    }, created_at: now
  });

  // Услуги
  const services = [
    { id: "svc_cut", name: "Стрижка", duration: 60, price: 2000 },
    { id: "svc_color", name: "Окрашивание", duration: 120, price: 5000 },
    { id: "svc_style", name: "Укладка", duration: 30, price: 1500 },
  ];
  for (const svc of services) {
    insertEffect({
      id: uuid(), intent_id: "_seed", alpha: "add", target: "services",
      value: null, scope: "account", context: {
        id: svc.id, specialistId, name: svc.name, duration: svc.duration, price: svc.price, active: true
      }, created_at: now
    });
  }

  // Слоты на 7 дней вперёд
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = 0; d < 7; d++) {
    const date = new Date(today.getTime() + d * 86400000);
    const dayOfWeek = date.getDay();

    let hours;
    if (dayOfWeek === 0) continue;
    else if (dayOfWeek === 6) hours = [10, 11, 12];
    else hours = [10, 11, 12, 14, 15, 16, 17];

    const dateStr = date.toISOString().slice(0, 10);

    for (const h of hours) {
      const slotId = `slot_${dateStr}_${h}`;
      insertEffect({
        id: uuid(), intent_id: "_seed", alpha: "add", target: "slots",
        value: null, scope: "shared", context: {
          id: slotId, specialistId, date: dateStr,
          startTime: `${String(h).padStart(2, "0")}:00`,
          endTime: `${String(h + 1).padStart(2, "0")}:00`,
          status: "free"
        }, created_at: now
      });
    }
  }

  console.log("  Seed: специалист, 3 услуги, слоты на неделю");
}

function insertEffect(ef) {
  db.prepare(`
    INSERT INTO effects (id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at, resolved_at)
    VALUES (?, ?, ?, ?, ?, ?, NULL, 'confirmed', NULL, ?, ?, ?)
  `).run(
    ef.id, ef.intent_id, ef.alpha, ef.target,
    ef.value != null ? JSON.stringify(ef.value) : null,
    ef.scope,
    JSON.stringify(ef.context),
    ef.created_at, ef.created_at
  );
}

module.exports = { seed };
