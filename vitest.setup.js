/**
 * vitest setup — выполняется ОДИН РАЗ на worker до любых test-file import'ов.
 *
 * Проблема: server/db.js кэширует path через process.env.IDF_DB_PATH при
 * первом require. Если несколько test-файлов в одном worker делают require,
 * они получают один SQLite файл — race condition при parallel writes.
 *
 * Решение: каждый worker получает уникальный SQLite tmp-файл.
 * Тесты пишут в этот файл, на teardown — удаляется (os.tmpdir cleanup).
 */

import { randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";

const tmpDb = path.join(os.tmpdir(), `idf-test-${randomUUID()}.db`);
process.env.IDF_DB_PATH = tmpDb;

// Гарантируем очистку при завершении worker'а
process.on("exit", () => {
  try {
    fs.unlinkSync(tmpDb);
    fs.unlinkSync(`${tmpDb}-wal`);
    fs.unlinkSync(`${tmpDb}-shm`);
  } catch { /* ignore — DB может быть не создана */ }
});
