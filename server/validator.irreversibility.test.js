import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import db from "./db.js";
import { validate } from "./validator.js";

describe("integrity: irreversibility-blocked removal", () => {
  beforeAll(() => {
    db.prepare("DELETE FROM effects WHERE id LIKE 'irr_test_%'").run();
  });

  beforeEach(() => {
    db.prepare("DELETE FROM effects WHERE id LIKE 'irr_test_%'").run();
  });

  it("remove на сущности без irreversible past → reject с reason 'не найдена' ИЛИ ok (зависит от existence)", () => {
    const now = Date.now();
    db.prepare(`
      INSERT INTO effects (id, intent_id, alpha, target, value, scope, status, context, created_at, resolved_at)
      VALUES ('irr_test_add', 'add_x', 'add', 'Thing', NULL, 'account', 'confirmed', ?, ?, ?)
    `).run(JSON.stringify({ id: "t1", name: "foo" }), now, now);

    const removeEf = {
      id: "irr_test_rm",
      intent_id: "remove_x",
      alpha: "remove",
      target: "Thing",
      value: null,
      scope: "account",
      parent_id: null,
      status: "proposed",
      ttl: null,
      context: JSON.stringify({ id: "t1" }),
      created_at: now + 1,
    };
    const r = validate(removeEf);
    // Либо valid, либо reject по причине НЕ 'irreversible_point_passed'
    if (!r.valid) {
      expect(r.reason).not.toContain("irreversible_point_passed");
    }
  });

  it("remove на сущности с past irreversible (high + at) → reject 'irreversible_point_passed'", () => {
    const now = Date.now();
    db.prepare(`
      INSERT INTO effects (id, intent_id, alpha, target, value, scope, status, context, created_at, resolved_at)
      VALUES
        ('irr_test_add', 'add_x', 'add', 'Thing', NULL, 'account', 'confirmed', ?, ?, ?),
        ('irr_test_irr', 'confirm_x', 'replace', 'Thing', NULL, 'account', 'confirmed', ?, ?, ?)
    `).run(
      JSON.stringify({ id: "t2", name: "bar" }), now, now,
      JSON.stringify({ id: "t2", __irr: { point: "high", at: now + 5, reason: "paid" } }), now + 5, now + 5,
    );

    const removeEf = {
      id: "irr_test_rm",
      intent_id: "remove_x",
      alpha: "remove",
      target: "Thing",
      value: null,
      scope: "account",
      parent_id: null,
      status: "proposed",
      ttl: null,
      context: JSON.stringify({ id: "t2" }),
      created_at: now + 10,
    };
    const r = validate(removeEf);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("irreversible_point_passed");
  });

  it("replace на сущности с past irreversible → разрешён (forward-correction)", () => {
    const now = Date.now();
    db.prepare(`
      INSERT INTO effects (id, intent_id, alpha, target, value, scope, status, context, created_at, resolved_at)
      VALUES
        ('irr_test_add', 'add_x', 'add', 'Thing', NULL, 'account', 'confirmed', ?, ?, ?),
        ('irr_test_irr', 'confirm_x', 'replace', 'Thing', NULL, 'account', 'confirmed', ?, ?, ?)
    `).run(
      JSON.stringify({ id: "t3", name: "bar" }), now, now,
      JSON.stringify({ id: "t3", __irr: { point: "high", at: now + 5, reason: "paid" } }), now + 5, now + 5,
    );

    const replaceEf = {
      id: "irr_test_rpl",
      intent_id: "correct_x",
      alpha: "replace",
      target: "Thing.note",
      value: JSON.stringify("refunded"),
      scope: "account",
      parent_id: null,
      status: "proposed",
      ttl: null,
      context: JSON.stringify({ id: "t3" }),
      created_at: now + 10,
    };
    const r = validate(replaceEf);
    // Forward correction разрешён
    expect(r.valid).toBe(true);
  });

  it("point=high но at=null — remove ещё разрешён (not yet irreversible)", () => {
    const now = Date.now();
    db.prepare(`
      INSERT INTO effects (id, intent_id, alpha, target, value, scope, status, context, created_at, resolved_at)
      VALUES
        ('irr_test_add', 'add_x', 'add', 'Thing', NULL, 'account', 'confirmed', ?, ?, ?),
        ('irr_test_hold', 'hold_x', 'replace', 'Thing', NULL, 'account', 'confirmed', ?, ?, ?)
    `).run(
      JSON.stringify({ id: "t4", name: "bar" }), now, now,
      JSON.stringify({ id: "t4", __irr: { point: "high", at: null, reason: "pending" } }), now + 5, now + 5,
    );

    const removeEf = {
      id: "irr_test_rm",
      intent_id: "remove_x",
      alpha: "remove",
      target: "Thing",
      value: null,
      scope: "account",
      parent_id: null,
      status: "proposed",
      ttl: null,
      context: JSON.stringify({ id: "t4" }),
      created_at: now + 10,
    };
    const r = validate(removeEf);
    // at=null → ещё не необратимо → если сущность существует, remove допустим
    if (!r.valid) {
      expect(r.reason).not.toContain("irreversible_point_passed");
    }
  });
});
