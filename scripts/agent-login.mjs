#!/usr/bin/env node
/**
 * Agent login helper.
 *
 * Usage:
 *   node scripts/agent-login.mjs [email]
 *
 * Idempotent: пытается login, если не получается — register, потом login снова.
 * Печатает только JWT в stdout для удобства shell-substitution:
 *
 *   JWT=$(node scripts/agent-login.mjs)
 *   curl -H "Authorization: Bearer $JWT" ...
 *
 * Все диагностические сообщения идут в stderr.
 */

const HOST = process.env.IDF_SERVER || "http://localhost:3001";
const email = process.argv[2] || "agent-demo@local";
const password = "agent-demo-password-v1";
const name = "agent-demo";

async function login() {
  const res = await fetch(`${HOST}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.token;
}

async function register() {
  const res = await fetch(`${HOST}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`register failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return data.token;
}

async function main() {
  try {
    let token = await login();
    if (!token) {
      process.stderr.write(`[agent-login] ${email} не существует, регистрирую...\n`);
      token = await register();
    } else {
      process.stderr.write(`[agent-login] ${email} уже зарегистрирован, login OK\n`);
    }
    process.stdout.write(token);
  } catch (err) {
    process.stderr.write(`[agent-login] ERROR: ${err.message}\n`);
    process.exit(1);
  }
}

main();
