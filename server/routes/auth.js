const { Router } = require("express");
const { register, login, getUser, getAllUsers, authMiddleware } = require("../auth.js");
const { getOnlineUsers } = require("../ws.js");

const router = Router();

router.post("/register", (req, res) => {
  try {
    const { email, password, name } = req.body;
    const result = register(email, password, name);
    console.log(`  [auth] Регистрация: ${result.user.name} (${result.user.email})`);
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/login", (req, res) => {
  try {
    const { email, password } = req.body;
    const result = login(email, password);
    console.log(`  [auth] Вход: ${result.user.name}`);
    res.json(result);
  } catch (e) {
    res.status(401).json({ error: e.message });
  }
});

router.get("/me", authMiddleware, (req, res) => {
  const user = getUser(req.userId);
  if (!user) return res.status(404).json({ error: "User not found" });
  const online = getOnlineUsers();
  res.json({ ...user, status: online.includes(user.id) ? "online" : "offline" });
});

// DEPRECATED: клиенты больше не используют для world.users — users из Φ через _user_register.
// Оставлен для online-статуса и legacy-клиентов.
router.get("/users", authMiddleware, (req, res) => {
  const users = getAllUsers();
  const online = getOnlineUsers();
  res.json(users.map(u => ({ ...u, status: online.includes(u.id) ? "online" : "offline" })));
});

module.exports = router;
