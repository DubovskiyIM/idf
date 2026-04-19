/**
 * freelance-accounts — создаёт/обновляет auth-аккаунты для 5 seed-пользователей
 * freelance-домена, чтобы e2e-прохождение в UI не требовало ручной регистрации
 * и id логина совпадали с id в seed (иначе пользователь не увидит свои задачи,
 * сделки, отклики).
 *
 * Идемпотентно: INSERT OR REPLACE в auth_users + INSERT OR IGNORE _user_register
 * в effects (seed User-ы и так приходят через domain.getSeedEffects()).
 *
 * Запуск (сервер на 3001 может быть не поднят — пишем напрямую в SQLite):
 *   node scripts/freelance-accounts.mjs
 */

import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, "..", "server", "idf.db");

const PASSWORD = "password";

const ACCOUNTS = [
  {
    id: "u_customer_1", email: "alisa@freelance.local", name: "Алиса Заказчикова",
    role: "customer", note: "создаёт задачи, публикует, апрувит отклики, принимает работу",
  },
  {
    id: "u_customer_2", email: "boris@freelance.local", name: "Борис Клиентов",
    role: "customer", note: "второй заказчик — для тестов с несколькими клиентами",
  },
  {
    id: "u_executor_1", email: "viktor@freelance.local", name: "Виктор Разработчиков",
    role: "executor", note: "откликается, берёт работу, сдаёт результат",
  },
  {
    id: "u_executor_2", email: "galya@freelance.local", name: "Галина Дизайнова",
    role: "executor", note: "второй исполнитель",
  },
  {
    id: "u_universal", email: "dima@freelance.local", name: "Дима Универсалов",
    role: "universal", note: "обе роли — для проверки toolbar-переключателя ролей",
  },
];

const db = new Database(DB_PATH);
const now = Date.now();
const hash = bcrypt.hashSync(PASSWORD, 10);

// auth_users таблица уже создана server/auth.js при первом запуске — на всякий
// случай дублируем DDL, чтобы скрипт можно было гонять до первого старта.
db.exec(`
  CREATE TABLE IF NOT EXISTS auth_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    avatar TEXT DEFAULT '',
    created_at INTEGER NOT NULL
  );
`);

const upsert = db.prepare(`
  INSERT INTO auth_users (id, email, name, password_hash, avatar, created_at)
  VALUES (?, ?, ?, ?, '', ?)
  ON CONFLICT(id) DO UPDATE SET
    email = excluded.email,
    name = excluded.name,
    password_hash = excluded.password_hash
`);

const ensureUserRegister = db.prepare(`
  INSERT OR IGNORE INTO effects (id, intent_id, alpha, target, value, scope, parent_id, status, ttl, context, created_at, resolved_at)
  VALUES (?, '_user_register', 'add', 'users', NULL, 'account', NULL, 'confirmed', NULL, ?, ?, ?)
`);

for (const acc of ACCOUNTS) {
  upsert.run(acc.id, acc.email, acc.name, hash, now);
  ensureUserRegister.run(
    `_user_register_${acc.id}`,
    JSON.stringify({ id: acc.id, name: acc.name, email: acc.email, avatar: "", createdAt: now }),
    now, now
  );
}

console.log(`\n✓ Создано/обновлено ${ACCOUNTS.length} freelance-аккаунтов. Пароль у всех: "${PASSWORD}"\n`);
console.log("Логины:");
for (const acc of ACCOUNTS) {
  console.log(`  • ${acc.email.padEnd(24)} (${acc.role.padEnd(9)}) — ${acc.name}\n     ${acc.note}`);
}
console.log("\nE2E-прогон happy-path:");
console.log("  1. Алиса → Мои задачи → + Опубликовать задачу → заполнить форму → submit (status=draft)");
console.log("  2. Алиса → кликнуть задачу → publish_task (status=published)");
console.log("  3. Logout → Login Виктор → Каталог задач → кликнуть опубликованную → submit_response");
console.log("  4. Logout → Login Алиса → Мои задачи → кликнуть → Отклики → select_executor → confirm_deal");
console.log("  5. Logout → Login Виктор → Мои сделки → submit_work_result");
console.log("  6. Logout → Login Алиса → Мои сделки → accept_result → leave_review");
console.log("  7. Login Дима — переключатель роли в тулбаре (Заказчик ↔ Исполнитель)\n");

db.close();
