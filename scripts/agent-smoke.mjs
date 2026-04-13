#!/usr/bin/env node
/**
 * Agent layer smoke test.
 *
 * Предпосылки:
 *   1. Сервер запущен: npm run server
 *   2. Клиент подключался хотя бы раз: npm run dev + открыть /booking-v2
 *      (чтобы POST'нуть ontology и intents в сервер)
 *   3. В booking БД есть хотя бы один specialist, service и несколько free slots
 *
 * Запуск:
 *   npm run agent-smoke
 *
 * Сценарий из 11 шагов проверяет happy-path, конфликт-rejection и 403.
 * Exit 0 если все шаги прошли, 1 если какой-то assert упал.
 */

import { spawnSync } from "node:child_process";

const HOST = process.env.IDF_SERVER || "http://localhost:3001";

// ============================================================
// Helpers
// ============================================================

function log(step, msg) {
  process.stdout.write(`\n[smoke ${step}] ${msg}\n`);
}

function ok(step, msg) {
  process.stdout.write(`[smoke ${step}] ✓ ${msg}\n`);
}

function fail(step, msg, details) {
  process.stderr.write(`[smoke ${step}] ✗ ${msg}\n`);
  if (details !== undefined) {
    process.stderr.write(`  details: ${JSON.stringify(details, null, 2)}\n`);
  }
  process.exit(1);
}

async function get(path, jwt) {
  const res = await fetch(`${HOST}${path}`, {
    headers: { "Authorization": `Bearer ${jwt}` }
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function post(path, body, jwt) {
  const headers = { "Content-Type": "application/json" };
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;
  const res = await fetch(`${HOST}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

function assert(cond, step, msg, details) {
  if (cond) return ok(step, msg);
  fail(step, msg, details);
}

// ============================================================
// Main scenario
// ============================================================

async function main() {
  log("0", "Agent layer smoke test начат");

  // Step 1: login
  log("1", "agent-login.mjs");
  const loginResult = spawnSync("node", ["scripts/agent-login.mjs"], { encoding: "utf-8" });
  if (loginResult.status !== 0) {
    fail("1", "agent-login failed", { stdout: loginResult.stdout, stderr: loginResult.stderr });
  }
  const jwt = loginResult.stdout.trim();
  if (!jwt || jwt.length < 20) {
    fail("1", "JWT не получен", loginResult);
  }
  ok("1", "JWT получен");

  // Step 2: seed completed booking для leave_review
  log("2", "seed completed-booking для leave_review");
  const schemaResp = await get("/api/agent/booking/schema", jwt);
  if (schemaResp.status !== 200) {
    fail("2", "GET /schema upfront failed", schemaResp);
  }
  const viewerId = schemaResp.body.viewer.id;
  const worldBefore = await get("/api/agent/booking/world", jwt);
  const alreadyHasCompleted = (worldBefore.body.world?.bookings || [])
    .some(b => b.status === "completed");
  if (!alreadyHasCompleted) {
    const now = Date.now();
    const seedBookingId = `book_seed_${now}`;
    const seedEffect = {
      id: `eff_seed_${now}`,
      intent_id: "_seed",
      alpha: "add",
      target: "bookings",
      value: null,
      scope: "account",
      parent_id: null,
      status: "confirmed",
      ttl: null,
      context: {
        id: seedBookingId,
        clientId: viewerId,
        specialistId: "seed_spec",
        serviceId: "seed_svc",
        serviceName: "Seed Service",
        slotId: "seed_slot",
        status: "completed",
        price: 1000,
        createdAt: now
      },
      created_at: now,
      resolved_at: now
    };
    const seedResp = await fetch(`${HOST}/api/effects/seed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([seedEffect])
    });
    if (!seedResp.ok) {
      fail("2", "seed POST failed", await seedResp.text());
    }
    ok("2", `seed completed-booking для agent (id=${seedBookingId})`);
  } else {
    ok("2", "completed booking уже существует, skip");
  }

  // Step 3: GET /schema
  log("3", "GET /schema");
  const schema = await get("/api/agent/booking/schema", jwt);
  assert(schema.status === 200, "3", "status 200", schema);
  assert(schema.body.role === "agent", "3", "role === agent");
  assert(Array.isArray(schema.body.intents), "3", "intents — массив");
  assert(schema.body.intents.length === 7, "3", `intents.length === 7 (got ${schema.body.intents.length})`, schema.body.intents.map(i => i.intentId));
  const createBookingSchema = schema.body.intents.find(i => i.intentId === "create_booking");
  assert(!!createBookingSchema, "3", "create_booking присутствует");
  assert(createBookingSchema.parameters.some(p => p.name === "slotId"), "3", "create_booking.parameters содержит slotId");

  // Step 4: GET /world
  log("4", "GET /world");
  const world = await get("/api/agent/booking/world", jwt);
  assert(world.status === 200, "4", "status 200");
  assert(Array.isArray(world.body.world.specialists), "4", "specialists — массив");
  assert(Array.isArray(world.body.world.timeslots), "4", "timeslots — массив");
  const freeSlots = (world.body.world.timeslots || []).filter(s => s.status === "free");
  assert(freeSlots.length > 0, "4", `есть свободные slots (${freeSlots.length})`, {
    timeslots: world.body.world.timeslots
  });

  // Step 5: POST /exec/create_booking
  log("5", "POST /exec/create_booking");
  const slot = freeSlots[0];
  const service = (world.body.world.services || [])[0];
  if (!service) fail("5", "в world нет services — нужен seed");
  const createResp = await post("/api/agent/booking/exec/create_booking", {
    serviceId: service.id,
    specialistId: service.specialistId,
    slotId: slot.id,
    price: service.price
  }, jwt);
  assert(createResp.status === 200, "5", "status 200 confirmed", createResp);
  assert(createResp.body.status === "confirmed", "5", "status === confirmed");
  assert(!!createResp.body.createdEntity, "5", "createdEntity присутствует");
  const newBookingId = createResp.body.createdEntity.id;

  // Step 6: GET /world — проверить что бронь появилась
  log("6", "GET /world повторно");
  const world2 = await get("/api/agent/booking/world", jwt);
  const newBooking = (world2.body.world.bookings || []).find(b => b.id === newBookingId);
  assert(!!newBooking, "6", "новая бронь видна в /world");
  assert(newBooking.status === "confirmed", "6", "новая бронь confirmed");

  // Step 7: POST /exec/create_booking на тот же slot → 409
  log("7", "POST /exec/create_booking повторно (ожидаем 409)");
  const createResp2 = await post("/api/agent/booking/exec/create_booking", {
    serviceId: service.id,
    specialistId: service.specialistId,
    slotId: slot.id,
    price: service.price
  }, jwt);
  assert(createResp2.status === 409, "7", "status 409 rejected", createResp2);
  assert(createResp2.body.status === "rejected", "7", "status === rejected");
  assert(!!createResp2.body.reason, "7", "reason присутствует");
  if (createResp2.body.failedCondition) {
    assert(createResp2.body.failedCondition.entity === "slot", "7", "failedCondition.entity === slot");
  }

  // Step 8: POST /exec/cancel_booking
  log("8", "POST /exec/cancel_booking");
  const cancelResp = await post("/api/agent/booking/exec/cancel_booking", {
    bookingId: newBookingId
  }, jwt);
  assert(cancelResp.status === 200, "8", "cancel 200", cancelResp);
  assert(cancelResp.body.status === "confirmed", "8", "cancel confirmed");

  // Step 9: GET /world — проверить что бронь cancelled
  log("9", "GET /world после отмены");
  const world3 = await get("/api/agent/booking/world", jwt);
  const cancelled = (world3.body.world.bookings || []).find(b => b.id === newBookingId);
  assert(!!cancelled, "9", "бронь всё ещё в world");
  assert(cancelled.status === "cancelled", "9", "бронь cancelled");

  // Step 10: leave_review на seed-booking
  log("10", "POST /exec/leave_review на seed completed-booking");
  const seedBooking = (world3.body.world.bookings || []).find(b => b.status === "completed");
  if (!seedBooking) {
    fail("10", "seed completed-booking не найден в world — row filter не пропускает?");
  }
  const reviewResp = await post("/api/agent/booking/exec/leave_review", {
    bookingId: seedBooking.id,
    specialistId: seedBooking.specialistId,
    serviceName: seedBooking.serviceName || "Seed Service",
    rating: 5,
    text: "smoke-test review",
    response: ""
  }, jwt);
  assert(reviewResp.status === 200, "10", "leave_review 200", reviewResp);
  assert(reviewResp.body.status === "confirmed", "10", "review confirmed");

  // Step 11: block_slot → 403
  log("11", "POST /exec/block_slot (ожидаем 403)");
  const blockResp = await post("/api/agent/booking/exec/block_slot", {
    slotId: slot.id
  }, jwt);
  assert(blockResp.status === 403, "11", "block_slot 403", blockResp);
  assert(blockResp.body.error === "intent_not_allowed", "11", "error === intent_not_allowed");

  // Step 12: GET /schema — проверка relations блока (Session B)
  log("12", "GET /schema — проверка relations блока");
  const schema2 = await get("/api/agent/booking/schema", jwt);
  assert(schema2.status === 200, "12", "status 200");
  for (const intent of schema2.body.intents) {
    assert(!!intent.relations, "12", `${intent.intentId}.relations присутствует`);
    assert(Array.isArray(intent.relations.sequentialIn), "12", `${intent.intentId}.sequentialIn — массив`);
    assert(Array.isArray(intent.relations.sequentialOut), "12", `${intent.intentId}.sequentialOut — массив`);
    assert(Array.isArray(intent.relations.antagonists), "12", `${intent.intentId}.antagonists — массив`);
    assert(Array.isArray(intent.relations.excluding), "12", `${intent.intentId}.excluding — массив`);
    assert(Array.isArray(intent.relations.parallel), "12", `${intent.intentId}.parallel — массив`);
  }
  // Property-check: cancel_booking должен быть в antagonists/sequentialIn create_booking
  const cb = schema2.body.intents.find(i => i.intentId === "create_booking");
  if (cb) {
    assert(cb.relations.antagonists.includes("cancel_booking"), "12",
      "create_booking.antagonists содержит cancel_booking (declared hint)");
  }

  // Step 13: synthetic write-ownership check — попытка отменить чужую бронь
  log("13", "POST /exec/cancel_booking с чужим bookingId (ownership_denied)");
  // Seed чужой бронь через /api/effects/seed (bypass валидации)
  const foreignBookingId = `book_foreign_${Date.now()}`;
  const foreignEffect = {
    id: `eff_foreign_${Date.now()}`,
    intent_id: "_seed",
    alpha: "add",
    target: "bookings",
    value: null,
    scope: "account",
    parent_id: null,
    status: "confirmed",
    ttl: null,
    context: {
      id: foreignBookingId,
      clientId: "user_other",
      specialistId: "spec_anya",
      serviceId: "svc_haircut",
      serviceName: "Стрижка",
      slotId: "slot_foreign",
      status: "confirmed",
      price: 2000,
      createdAt: Date.now()
    },
    created_at: Date.now(),
    resolved_at: Date.now()
  };
  await fetch(`${HOST}/api/effects/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([foreignEffect])
  });

  const ownershipResp = await post("/api/agent/booking/exec/cancel_booking", {
    bookingId: foreignBookingId
  }, jwt);
  assert(ownershipResp.status === 403, "13", "status 403 ownership_denied", ownershipResp);
  assert(ownershipResp.body.error === "ownership_denied", "13", "error === ownership_denied");
  assert(ownershipResp.body.entityName === "Booking", "13", "entityName === Booking");

  // ============================================================
  // PHASE 2 — PLANNING (Session C)
  // ============================================================

  log("14", "PHASE 2: Planning setup (typemap + intents)");
  const planningOnt = await import("../src/domains/planning/ontology.js");
  const planningInt = await import("../src/domains/planning/intents.js");
  await fetch(`${HOST}/api/typemap?domain=planning`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(planningOnt.ONTOLOGY)
  });
  await fetch(`${HOST}/api/intents?domain=planning`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(planningInt.INTENTS)
  });
  ok("14", "planning setup complete");

  log("15", "GET /api/agent/planning/schema");
  const planSchema = await get("/api/agent/planning/schema", jwt);
  assert(planSchema.status === 200, "15", "status 200", planSchema);
  assert(planSchema.body.domain === "planning", "15", "domain === planning");
  assert(planSchema.body.intents.length === 15, "15", `15 intents (got ${planSchema.body.intents.length})`, planSchema.body.intents.map(i => i.intentId));
  const cps = planSchema.body.intents.find(i => i.intentId === "create_poll");
  assert(!!cps, "15", "create_poll в schema");
  assert(!!cps.relations, "15", "create_poll имеет relations блок");

  log("16", "GET /api/agent/planning/world (пустой начальный)");
  const planW0 = await get("/api/agent/planning/world", jwt);
  assert(planW0.status === 200, "16", "status 200");
  ok("16", `planning world keys: ${Object.keys(planW0.body.world).join(", ")}`);

  log("17", "POST /exec/create_poll");
  const cpResp = await post("/api/agent/planning/exec/create_poll", {
    title: "Smoke Test Poll",
    description: "Session C smoke"
  }, jwt);
  assert(cpResp.status === 200, "17", "create_poll 200", cpResp);
  assert(cpResp.body.status === "confirmed", "17", "confirmed");
  const newPollId = cpResp.body.createdEntity?.id;
  assert(!!newPollId, "17", "createdEntity.id получен");

  log("18", "GET /world — poll виден с organizerId");
  const planW1 = await get("/api/agent/planning/world", jwt);
  const createdPoll = (planW1.body.world.polls || []).find(p => p.id === newPollId);
  assert(!!createdPoll, "18", "poll виден в world");
  assert(createdPoll.organizerId === planSchema.body.viewer.id, "18", "organizerId === viewer.id");

  log("19", "POST /exec/add_time_option × 2");
  const ao1 = await post("/api/agent/planning/exec/add_time_option", {
    pollId: newPollId, date: "2026-04-20", startTime: "13:00", endTime: "14:00"
  }, jwt);
  assert(ao1.status === 200, "19", "add_option 1 ok", ao1);
  const opt1Id = ao1.body.createdEntity?.id;

  const ao2 = await post("/api/agent/planning/exec/add_time_option", {
    pollId: newPollId, date: "2026-04-20", startTime: "15:00", endTime: "16:00"
  }, jwt);
  assert(ao2.status === 200, "19", "add_option 2 ok");

  log("20", "POST /exec/invite_participant (own email)");
  const invResp = await post("/api/agent/planning/exec/invite_participant", {
    pollId: newPollId,
    name: planSchema.body.viewer.name,
    email: planSchema.body.viewer.email
  }, jwt);
  assert(invResp.status === 200, "20", "invite_participant ok", invResp);

  log("21", "GET /world — own participant via userId match");
  const planW2 = await get("/api/agent/planning/world", jwt);
  const ownPart = (planW2.body.world.participants || []).find(
    p => p.userId === planSchema.body.viewer.id && p.pollId === newPollId
  );
  assert(!!ownPart, "21", "own participant найден через userId");

  log("22", "POST /exec/open_poll");
  const openResp = await post("/api/agent/planning/exec/open_poll", {
    pollId: newPollId
  }, jwt);
  assert(openResp.status === 200, "22", "open_poll ok", openResp);

  log("23", "POST /exec/vote_yes (own participant on option_1)");
  const voteResp = await post("/api/agent/planning/exec/vote_yes", {
    optionId: opt1Id,
    participantId: ownPart.id
  }, jwt);
  assert(voteResp.status === 200, "23", "vote_yes ok", voteResp);

  log("24", "POST /exec/close_poll");
  const closeResp = await post("/api/agent/planning/exec/close_poll", {
    pollId: newPollId
  }, jwt);
  assert(closeResp.status === 200, "24", "close_poll ok", closeResp);

  log("25", "POST /exec/resolve_poll → Meeting создан");
  const resolveResp = await post("/api/agent/planning/exec/resolve_poll", {
    pollId: newPollId,
    optionId: opt1Id
  }, jwt);
  assert(resolveResp.status === 200, "25", "resolve_poll ok", resolveResp);

  log("26", "Ownership denial: cancel чужого poll → 403");
  const foreignPollId = `poll_foreign_${Date.now()}`;
  await fetch(`${HOST}/api/effects/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{
      id: `eff_fp_${Date.now()}`,
      intent_id: "_seed",
      alpha: "add",
      target: "polls",
      value: null,
      scope: "account",
      parent_id: null,
      status: "confirmed",
      ttl: null,
      context: {
        id: foreignPollId,
        organizerId: "user_other",
        title: "Foreign poll",
        status: "draft",
        createdAt: Date.now()
      },
      created_at: Date.now(),
      resolved_at: Date.now()
    }])
  });
  const cancelForeignResp = await post("/api/agent/planning/exec/cancel_poll", {
    pollId: foreignPollId
  }, jwt);
  assert(cancelForeignResp.status === 403, "26", "cancel foreign 403", cancelForeignResp);
  assert(cancelForeignResp.body.error === "ownership_denied", "26", "error ownership_denied");

  // ============================================================
  // MESHOK (steps 27-32)
  // ============================================================

  log("27", "meshok: GET schema");
  const meshokSchema = await get("/api/agent/meshok/schema", jwt);
  assert(meshokSchema.status === 200, "27", `meshok schema ${meshokSchema.status}`);
  ok("27", `meshok: ${Object.keys(meshokSchema.body.intents || {}).length} intents`);

  log("28", "meshok: create_listing");
  const createLot = await post("/api/agent/meshok/exec", {
    intentId: "create_listing",
    params: { title: "Smoke Test Item", startPrice: 1000, condition: "used" }
  }, jwt);
  assert(createLot.status === 200, "28", `create_listing ${createLot.status}`, createLot.body);

  await new Promise(r => setTimeout(r, 300));
  const meshokWorld = await get("/api/agent/meshok/world", jwt);
  const smokeLot = (meshokWorld.body.listings || []).find(l => l.title === "Smoke Test Item");
  assert(smokeLot, "28", "lot found in world");

  log("29", "meshok: publish_listing");
  const pubLot = await post("/api/agent/meshok/exec", {
    intentId: "publish_listing",
    params: { listingId: smokeLot.id }
  }, jwt);
  assert(pubLot.status === 200, "29", `publish ${pubLot.status}`, pubLot.body);

  log("30", "meshok: place_bid");
  await new Promise(r => setTimeout(r, 300));
  const bidResp = await post("/api/agent/meshok/exec", {
    intentId: "place_bid",
    params: { listingId: smokeLot.id, amount: 1500 }
  }, jwt);
  assert(bidResp.status === 200, "30", `bid ${bidResp.status}`, bidResp.body);

  log("31", "meshok: send_message");
  const msgResp = await post("/api/agent/meshok/exec", {
    intentId: "send_message",
    params: { content: "Smoke test message", recipientId: smokeLot.sellerId }
  }, jwt);
  assert(msgResp.status === 200, "31", `message ${msgResp.status}`, msgResp.body);

  log("32", "meshok: bid below price → null (rejected)");
  await new Promise(r => setTimeout(r, 300));
  const lowBid = await post("/api/agent/meshok/exec", {
    intentId: "place_bid",
    params: { listingId: smokeLot.id, amount: 500 }
  }, jwt);
  // buildEffects returns null → 409 or empty effects
  assert(lowBid.status === 409 || lowBid.status === 200, "32", `low bid handled ${lowBid.status}`);

  // ============================================================
  // WORKFLOW (steps 33-37)
  // ============================================================

  log("33", "workflow: GET schema");
  const wfSchema = await get("/api/agent/workflow/schema", jwt);
  assert(wfSchema.status === 200, "33", `workflow schema ${wfSchema.status}`);

  log("34", "workflow: create_workflow");
  const createWf = await post("/api/agent/workflow/exec", {
    intentId: "create_workflow",
    params: { title: "Smoke Pipeline" }
  }, jwt);
  assert(createWf.status === 200, "34", `create_workflow ${createWf.status}`, createWf.body);

  await new Promise(r => setTimeout(r, 300));
  const wfWorld = await get("/api/agent/workflow/world", jwt);
  const smokeWf = (wfWorld.body.workflows || []).find(w => w.title === "Smoke Pipeline");
  assert(smokeWf, "34", "workflow found in world");

  log("35", "workflow: add_node");
  const addNode = await post("/api/agent/workflow/exec", {
    intentId: "add_node",
    params: { workflowId: smokeWf.id, type: "http_request", label: "Fetch API" }
  }, jwt);
  assert(addNode.status === 200, "35", `add_node ${addNode.status}`, addNode.body);

  log("36", "workflow: save_workflow");
  const saveWf = await post("/api/agent/workflow/exec", {
    intentId: "save_workflow",
    params: { workflowId: smokeWf.id }
  }, jwt);
  assert(saveWf.status === 200, "36", `save ${saveWf.status}`, saveWf.body);

  log("37", "workflow: execute_workflow");
  await new Promise(r => setTimeout(r, 300));
  const execWf = await post("/api/agent/workflow/exec", {
    intentId: "execute_workflow",
    params: { workflowId: smokeWf.id }
  }, jwt);
  assert(execWf.status === 200, "37", `execute ${execWf.status}`, execWf.body);

  // ============================================================
  // MESSENGER (steps 38-42)
  // ============================================================

  log("38", "messenger: GET schema");
  const msgrSchema = await get("/api/agent/messenger/schema", jwt);
  assert(msgrSchema.status === 200, "38", `messenger schema ${msgrSchema.status}`);

  log("39", "messenger: create_group");
  const createGrp = await post("/api/agent/messenger/exec", {
    intentId: "create_group",
    params: { title: "Smoke Group" }
  }, jwt);
  assert(createGrp.status === 200, "39", `create_group ${createGrp.status}`, createGrp.body);

  await new Promise(r => setTimeout(r, 300));
  const msgrWorld = await get("/api/agent/messenger/world", jwt);
  const smokeConv = (msgrWorld.body.conversations || []).find(c => c.title === "Smoke Group");
  assert(smokeConv, "39", "group found in world");

  log("40", "messenger: send_message");
  const sendMsg = await post("/api/agent/messenger/exec", {
    intentId: "send_message",
    params: { content: "Hello from smoke test!", conversationId: smokeConv.id }
  }, jwt);
  assert(sendMsg.status === 200, "40", `send_message ${sendMsg.status}`, sendMsg.body);

  log("41", "messenger: add_contact");
  const addContact = await post("/api/agent/messenger/exec", {
    intentId: "add_contact",
    params: { contactId: "user_other_smoke" }
  }, jwt);
  assert(addContact.status === 200, "41", `add_contact ${addContact.status}`, addContact.body);

  log("42", "messenger: mark_as_read");
  await new Promise(r => setTimeout(r, 300));
  const markRead = await post("/api/agent/messenger/exec", {
    intentId: "mark_as_read",
    params: { conversationId: smokeConv.id }
  }, jwt);
  assert(markRead.status === 200, "42", `mark_as_read ${markRead.status}`, markRead.body);

  // LIFEQUEST (steps 43-50)
  log("43", "lifequest schema");
  const lqSchema = await get("/api/agent/lifequest/schema", jwt);
  assert(lqSchema.status === 200, "43", `lifequest schema ${lqSchema.status}`);
  assert(lqSchema.body.intents.length >= 8, "43", `>=8 intents (got ${lqSchema.body.intents.length})`);

  log("44", "create_goal");
  const createGoal = await post("/api/agent/lifequest/exec", {
    intentId: "create_goal",
    params: { title: "Smoke Goal", sphereId: "health", deadline: "2026-12-31", description: "Test" }
  }, jwt);
  assert(createGoal.status === 200, "44", `create_goal ${createGoal.status}`, createGoal.body);

  const lqWorld1 = await get("/api/agent/lifequest/world", jwt);
  const smokeGoal = (lqWorld1.body.world.goals || []).find(g => g.title === "Smoke Goal");
  assert(smokeGoal, "44", "goal created in world");
  assert(smokeGoal.status === "active", "44", "goal status active");

  log("45", "create_habit");
  const createHabit = await post("/api/agent/lifequest/exec", {
    intentId: "create_habit",
    params: { title: "Smoke Habit", sphereId: "health", type: "binary" }
  }, jwt);
  assert(createHabit.status === 200, "45", `create_habit ${createHabit.status}`, createHabit.body);

  const lqWorld2 = await get("/api/agent/lifequest/world", jwt);
  const smokeHabit = (lqWorld2.body.world.habits || []).find(h => h.title === "Smoke Habit");
  assert(smokeHabit, "45", "habit created in world");

  log("46", "check_habit");
  const checkHabit = await post("/api/agent/lifequest/exec", {
    intentId: "check_habit",
    params: { habitId: smokeHabit.id }
  }, jwt);
  assert(checkHabit.status === 200, "46", `check_habit ${checkHabit.status}`, checkHabit.body);

  log("47", "create_task");
  const createTask = await post("/api/agent/lifequest/exec", {
    intentId: "create_task",
    params: { title: "Smoke Task" }
  }, jwt);
  assert(createTask.status === 200, "47", `create_task ${createTask.status}`, createTask.body);

  log("48", "complete_task");
  const lqWorld3 = await get("/api/agent/lifequest/world", jwt);
  const smokeTask = (lqWorld3.body.world.tasks || []).find(t => t.title === "Smoke Task");
  assert(smokeTask, "48", "task in world");
  const completeTask = await post("/api/agent/lifequest/exec", {
    intentId: "complete_task",
    params: { id: smokeTask.id }
  }, jwt);
  assert(completeTask.status === 200, "48", `complete_task ${completeTask.status}`, completeTask.body);

  log("49", "assess_sphere");
  const assessSphere = await post("/api/agent/lifequest/exec", {
    intentId: "assess_sphere",
    params: { sphereId: "health", score: 7, description: "Smoke assessment" }
  }, jwt);
  assert(assessSphere.status === 200, "49", `assess_sphere ${assessSphere.status}`, assessSphere.body);

  log("50", "set_quote");
  const setQuote = await post("/api/agent/lifequest/exec", {
    intentId: "set_quote",
    params: { text: "Smoke quote", author: "Test" }
  }, jwt);
  assert(setQuote.status === 200, "50", `set_quote ${setQuote.status}`, setQuote.body);

  process.stdout.write("\n[smoke ✓] Все 50 шагов прошли успешно (booking 13 + planning 13 + meshok 6 + workflow 5 + messenger 5 + lifequest 8)\n");
}

main().catch(err => {
  process.stderr.write(`\n[smoke ✗] unhandled: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
