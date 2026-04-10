const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "idf.db");

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS effects (
    id          TEXT PRIMARY KEY,
    intent_id   TEXT NOT NULL,
    alpha       TEXT NOT NULL,
    target      TEXT NOT NULL,
    value       TEXT,
    scope       TEXT DEFAULT 'account',
    parent_id   TEXT REFERENCES effects(id),
    status      TEXT DEFAULT 'proposed',
    ttl         INTEGER,
    context     TEXT,
    created_at  INTEGER NOT NULL,
    resolved_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS artifacts (
    id           TEXT PRIMARY KEY,
    projection   TEXT NOT NULL,
    code         TEXT NOT NULL,
    intents_hash TEXT NOT NULL,
    created_at   INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ontology (
    id          TEXT PRIMARY KEY,
    kind        TEXT NOT NULL,
    name        TEXT NOT NULL,
    definition  TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    updated_at  INTEGER NOT NULL
  );
`);

module.exports = db;
