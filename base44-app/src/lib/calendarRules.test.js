import test from "node:test";
import assert from "node:assert/strict";

import {
  currentCycleMonth,
  isUserAssignmentWindow,
  needsMonthlyOnboarding,
} from "./calendarRules.js";

test("user assignment window starts on day 24", () => {
  assert.equal(isUserAssignmentWindow(new Date(2026, 1, 23, 12)), false);
  assert.equal(isUserAssignmentWindow(new Date(2026, 1, 24, 12)), true);
});

test("cycle changes from the current month to the next month on day 24", () => {
  assert.equal(currentCycleMonth(new Date(2026, 1, 23, 12)), "2026-02");
  assert.equal(currentCycleMonth(new Date(2026, 1, 24, 12)), "2026-03");
});

test("onboarding completed on day 24 satisfies the current window", () => {
  const user = {
    onboarding_completed: true,
    onboarding_completed_at: new Date(2026, 1, 24, 12),
  };

  assert.equal(needsMonthlyOnboarding(user, new Date(2026, 1, 24, 18)), false);
});
