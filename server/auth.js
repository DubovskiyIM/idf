const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const db = require("./db.js");

const JWT_SECRET = process.env.JWT_SECRET || "idf-messenger-secret-dev";
const JWT_EXPIRES = "7d";

// Таблица пользователей (отдельная от effects — auth не в Φ)
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

function register(email, password, name) {
  if (!email?.trim() || !password || password.length < 4 || !name?.trim()) {
    throw new Error("Email, пароль (мин. 4 символа) и имя обязательны");
  }
  const existing = db.prepare("SELECT id FROM auth_users WHERE email = ?").get(email.trim().toLowerCase());
  if (existing) throw new Error("Email уже занят");

  const id = `user_${uuid().slice(0, 8)}`;
  const hash = bcrypt.hashSync(password, 10);
  const now = Date.now();

  db.prepare("INSERT INTO auth_users (id, email, name, password_hash, avatar, created_at) VALUES (?, ?, ?, ?, '', ?)")
    .run(id, email.trim().toLowerCase(), name.trim(), hash, now);

  const token = jwt.sign({ userId: id, email: email.trim().toLowerCase() }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return { user: { id, email: email.trim().toLowerCase(), name: name.trim(), avatar: "" }, token };
}

function login(email, password) {
  if (!email || !password) throw new Error("Email и пароль обязательны");
  const user = db.prepare("SELECT * FROM auth_users WHERE email = ?").get(email.trim().toLowerCase());
  if (!user) throw new Error("Пользователь не найден");
  if (!bcrypt.compareSync(password, user.password_hash)) throw new Error("Неверный пароль");

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  return { user: { id: user.id, email: user.email, name: user.name, avatar: user.avatar }, token };
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function getUser(userId) {
  const user = db.prepare("SELECT id, email, name, avatar, created_at FROM auth_users WHERE id = ?").get(userId);
  return user || null;
}

function getAllUsers() {
  return db.prepare("SELECT id, email, name, avatar, created_at FROM auth_users").all();
}

// Express middleware
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "Токен не предоставлен" });
  const payload = verifyToken(header.slice(7));
  if (!payload) return res.status(401).json({ error: "Невалидный токен" });
  req.userId = payload.userId;
  req.userEmail = payload.email;
  next();
}

module.exports = { register, login, verifyToken, getUser, getAllUsers, authMiddleware, JWT_SECRET };
