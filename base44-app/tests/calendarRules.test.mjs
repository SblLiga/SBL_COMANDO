import assert from "node:assert/strict";
import test from "node:test";

// Namespace import so a missing export fails only its own test, not the whole file.
import * as rules from "../src/lib/calendarRules.js";

// All timestamps at 12:00Z so the local calendar day is stable from UTC−11 to UTC+11.
const at = (ymd) => new Date(`${ymd}T12:00:00.000Z`);

function managerWithPlan(selectedYmd) {
  return {
    role: "manager",
    next_month_target: "שיווק",
    next_month_zone: "female",
    next_month_tasks: ["task 1", "task 2", "task 3", "task 4"],
    next_month_reward: "reward",
    next_month_selected_at: at(selectedYmd).toISOString(),
  };
}

function completedUser(completedYmd) {
  return {
    role: "user",
    onboarding_completed: true,
    onboarding_completed_at: completedYmd ? at(completedYmd).toISOString() : null,
  };
}

// --- Managers: plan selection window 23–26, cycle rolls on the 23rd ---

test("M-1: plan picked mid-month (Sep 9) must be re-picked in the Sep 23 window", () => {
  assert.equal(rules.needsManagerNextMonthTarget(managerWithPlan("2026-09-09"), at("2026-09-23")), true);
});

test("M-2: mid-month promotion plan (Sep 20) must be re-picked on Sep 23", () => {
  assert.equal(rules.needsManagerNextMonthTarget(managerWithPlan("2026-09-20"), at("2026-09-23")), true);
});

test("M-3: year-end — plan picked Dec 9 must be re-picked on Dec 23", () => {
  assert.equal(rules.needsManagerNextMonthTarget(managerWithPlan("2026-12-09"), at("2026-12-23")), true);
});

test("M-4: plan picked inside the window (Sep 23) is not requested again on Sep 26", () => {
  assert.equal(rules.needsManagerNextMonthTarget(managerWithPlan("2026-09-23"), at("2026-09-26")), false);
});

test("M-5: plan from the previous window (Aug 24) is requested again on Sep 23", () => {
  assert.equal(rules.needsManagerNextMonthTarget(managerWithPlan("2026-08-24"), at("2026-09-23")), true);
});

test("M-6: Sep 28 and Oct 1 are the same manager cycle", () => {
  assert.equal(rules.sameManagerCycle(at("2026-09-28").toISOString(), at("2026-10-01")), true);
});

// --- Users: target + manager selection window 25–26 ---

test("U-1: completed Aug 24, not re-prompted after the window closes (Sep 27)", () => {
  assert.equal(rules.needsMonthlyOnboarding(completedUser("2026-08-24"), at("2026-09-27")), false);
});

test("U-2: completed with null completed_at, not re-prompted on Sep 27", () => {
  assert.equal(rules.needsMonthlyOnboarding(completedUser(null), at("2026-09-27")), false);
});

test("U-3: completed Aug 24 — not prompted Sep 23, prompted Sep 25", () => {
  const user = completedUser("2026-08-24");
  assert.equal(rules.needsMonthlyOnboarding(user, at("2026-09-23")), false);
  assert.equal(rules.needsMonthlyOnboarding(user, at("2026-09-25")), true);
});

test("U-4: joined mid-month (Sep 15) is prompted on Sep 25", () => {
  assert.equal(rules.needsMonthlyOnboarding(completedUser("2026-09-15"), at("2026-09-25")), true);
});

test("U-5: completed in the window (Sep 25) is not prompted on Sep 26 or Sep 27", () => {
  const user = completedUser("2026-09-25");
  assert.equal(rules.needsMonthlyOnboarding(user, at("2026-09-26")), false);
  assert.equal(rules.needsMonthlyOnboarding(user, at("2026-09-27")), false);
});

test("U-6: never completed onboarding is always prompted (Sep 27)", () => {
  const user = { role: "user", onboarding_completed: false, onboarding_completed_at: null };
  assert.equal(rules.needsMonthlyOnboarding(user, at("2026-09-27")), true);
});
