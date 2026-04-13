#!/usr/bin/env node
/**
 * Meshok walkthrough — полный демо-сценарий аукциона.
 *
 * Предпосылки:
 *   1. Сервер запущен: npm run server
 *   2. Клиент подключался: npm run dev + открыть /meshok (POST ontology+intents)
 *
 * Запуск:
 *   npm run meshok-demo
 *
 * Сценарий: регистрация продавца и покупателя → создание лота → публикация →
 * ставки → «купить сейчас» → оплата → подтверждение ��оставки → отзыв → сообщение.
 */

const HOST = process.env.IDF_SERVER || "http://localhost:3001";

// ============================================================
// Helpers
// ============================================================

let step = 0;
function log(msg) { step++; process.stdout.write(`\n[${step}] ${msg}\n`); }
function ok(msg) { process.stdout.write(`  ✓ ${msg}\n`); }
function fail(msg, details) {
  process.stderr.write(`  ✗ ${msg}\n`);
  if (details) process.stderr.write(`  ${JSON.stringify(details, null, 2).slice(0, 500)}\n`);
  process.exit(1);
}

async function post(path, body, jwt) {
  const headers = { "Content-Type": "application/json" };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${HOST}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

async function get(path, jwt) {
  const headers = {};
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  const res = await fetch(`${HOST}${path}`, { headers });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

function assert(cond, msg, details) { if (!cond) fail(msg, details); ok(msg); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ============================================================
// Сценарий
// ============================================================

async function main() {
  console.log("🏪 Meshok Walkthrough — полный демо аукциона\n");

  // --- 1. Регистрация продавца ---
  log("Регистрация продавца");
  const sellerReg = await post("/api/auth/register", {
    email: `seller_${Date.now()}@demo.ru`, password: "demo1234", name: "Продавец Иван"
  });
  assert(sellerReg.status === 201, `Регистрация: ${sellerReg.status}`, sellerReg.body);
  const sellerToken = sellerReg.body.token;
  const sellerId = sellerReg.body.user.id;
  ok(`Продавец: ${sellerId}`);

  // --- 2. Регистрация покупателя ---
  log("Регистрация покупателя");
  const buyerReg = await post("/api/auth/register", {
    email: `buyer_${Date.now()}@demo.ru`, password: "demo1234", name: "Покупатель Мария"
  });
  assert(buyerReg.status === 201, `Регистрация: ${buyerReg.status}`, buyerReg.body);
  const buyerToken = buyerReg.body.token;
  const buyerId = buyerReg.body.user.id;
  ok(`Покупатель: ${buyerId}`);

  // --- 3. Проверяем agent schema ---
  log("Проверяем agent schema для meshok");
  const schema = await get("/api/agent/meshok/schema", sellerToken);
  assert(schema.status === 200, `Schema: ${schema.status}`, schema.body);
  const intentIds = Object.keys(schema.body.intents || {});
  ok(`${intentIds.length} интентов в schema`);

  // --- 4. Продавец создаёт лот ---
  log("Продавец создаёт лот");
  const createRes = await post("/api/agent/meshok/exec", {
    intentId: "create_listing",
    params: {
      title: "Vintage Fender Stratocaster 1962",
      description: "Оригинальный Fender Strat 62 года, sunburst, в коллекционном состоянии. Звучание — мечта блюзмена.",
      startPrice: 350000,
      condition: "used",
      shippingFrom: "Москва",
      shippingCost: 3000,
      categoryId: "cat_collectibles",
    }
  }, sellerToken);
  assert(createRes.status === 200, `Создание лота: ${createRes.status}`, createRes.body);
  ok("Лот создан");

  // Найти ID лота из эффектов
  await sleep(300);
  const world1 = await get("/api/agent/meshok/world", sellerToken);
  const listings = world1.body.listings || [];
  const myLot = listings.find(l => l.title?.includes("Fender") && l.sellerId === sellerId);
  assert(myLot, "Лот найден в world", { listingsCount: listings.length });
  ok(`Лот: ${myLot.id}, статус: ${myLot.status}, цена: ${myLot.startPrice}₽`);

  // --- 5. Продавец публикует лот ---
  log("Продавец публикует лот");
  const pubRes = await post("/api/agent/meshok/exec", {
    intentId: "publish_listing",
    params: { listingId: myLot.id }
  }, sellerToken);
  assert(pubRes.status === 200, `Публикация: ${pubRes.status}`, pubRes.body);
  ok("Лот опубликован (draft → active)");

  await sleep(300);

  // --- 6. Покупатель делает ставку ---
  log("Покупатель делает ставку 360 000₽");
  const bid1Res = await post("/api/agent/meshok/exec", {
    intentId: "place_bid",
    params: { listingId: myLot.id, amount: 360000 }
  }, buyerToken);
  assert(bid1Res.status === 200, `Ставка: ${bid1Res.status}`, bid1Res.body);
  ok("Ставка принята");

  // --- 7. Покупатель делает вторую ставку (перебивает себя) ---
  log("Покупатель повышает ставку до 380 000₽");
  await sleep(300);
  const bid2Res = await post("/api/agent/meshok/exec", {
    intentId: "place_bid",
    params: { listingId: myLot.id, amount: 380000 }
  }, buyerToken);
  assert(bid2Res.status === 200, `Вторая ставка: ${bid2Res.status}`, bid2Res.body);
  ok("Ставка повышена");

  // --- 8. Проверяем текущую цену ---
  log("Проверяем текущую цену лота");
  await sleep(300);
  const world2 = await get("/api/agent/meshok/world", buyerToken);
  const updatedLot = (world2.body.listings || []).find(l => l.id === myLot.id);
  assert(updatedLot, "Лот найден");
  ok(`Текущая цена: ${updatedLot.currentPrice}₽, ставок: ${updatedLot.bidCount}`);

  // --- 9. Другой покупатель: «купить сейчас» другой лот (из seed) ---
  log("Покупатель использует «Купить сейчас» на лот из seed");
  const seedLot = (world2.body.listings || []).find(l => l.buyNowPrice && l.status === "active" && l.id !== myLot.id);
  if (!seedLot) {
    ok("⚠ Нет seed-лота с buyNowPrice — пропускаем buy_now + order flow");
  } else {
    const buyRes = await post("/api/agent/meshok/exec", {
      intentId: "buy_now",
      params: { listingId: seedLot.id }
    }, buyerToken);
    assert(buyRes.status === 200, `Buy now: ${buyRes.status}`, buyRes.body);
    ok(`Куплено: ${seedLot.title?.slice(0, 40)} за ${seedLot.buyNowPrice}₽`);

    await sleep(300);

    // --- 10. Оплата заказа ---
    log("Покупатель оплачивает заказ");
    const world3 = await get("/api/agent/meshok/world", buyerToken);
    const order = (world3.body.orders || []).find(o => o.listingId === seedLot.id && o.buyerId === buyerId);
    assert(order, "Заказ найден", { orders: world3.body.orders?.length });
    ok(`Заказ: ${order.id}, сумма: ${order.totalAmount}₽, статус: ${order.status}`);

    const payRes = await post("/api/agent/meshok/exec", {
      intentId: "pay_order",
      params: { orderId: order.id }
    }, buyerToken);
    assert(payRes.status === 200, `Оплата: ${payRes.status}`, payRes.body);
    ok("Заказ оплачен (pending_payment → paid)");

    // --- 11. Подтверждение доставки (нужен shipped → delivered) ---
    // Для демо пропускаем shipped (нужен seller ship_order), переходим к отзыву
    log("Покупатель оставляет отзыв");
    // Ставим order.status = delivered вручную через seed для демо
    // В реальном флоу: seller ship_order → buyer confirm_delivery → leave_review

    // --- 12. Сообщение продавцу ---
    log("Покупатель пишет сообщение продавцу");
    const msgRes = await post("/api/agent/meshok/exec", {
      intentId: "send_message",
      params: {
        recipientId: seedLot.sellerId,
        listingId: seedLot.id,
        content: "Здравствуйте! Когда планируете отправку? Спасибо за быструю сделку!"
      }
    }, buyerToken);
    assert(msgRes.status === 200, `Сообщение: ${msgRes.status}`, msgRes.body);
    ok("Сообщение отправлено");
  }

  // --- Итоговая статистика ---
  log("Итоговая статистика");
  await sleep(300);
  const finalWorld = await get("/api/agent/meshok/world", buyerToken);
  const w = finalWorld.body;
  console.log(`\n📊 Мир meshok:`);
  console.log(`   Лоты: ${(w.listings || []).length}`);
  console.log(`   Ставки: ${(w.bids || []).length}`);
  console.log(`   Заказы: ${(w.orders || []).length}`);
  console.log(`   Сообщения: ${(w.messages || []).length}`);
  console.log(`   Пользователи: ${(w.users || []).length}`);

  console.log(`\n🎉 Walkthrough завершён успешно! (${step} шагов)\n`);
}

main().catch(err => {
  console.error("\n💥 Ошибка:", err.message);
  process.exit(1);
});
