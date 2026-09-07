import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

import { getMatchingManagers } from "../src/lib/managerCandidates.js";
import {
  ensureManagerGoalSelectionMember,
  saveManagerGoalSelection,
} from "../src/lib/myGoal.js";

const NOW = new Date("2026-09-23T09:00:00.000Z");
const PLAN = {
  target: "sales",
  zone: "female",
  tasks: ["task 1", "task 2", "task 3", "task 4"],
  goalTitle: "September sales",
  rewardText: "Team dinner",
  rewardImage: "https://example.test/reward.png",
  now: NOW,
};

let vite;
let StepManager;

before(async () => {
  vite = await createServer({ appType: "custom", logLevel: "silent", server: { middlewareMode: true } });
  StepManager = (await vite.ssrLoadModule("/src/components/onboarding/StepManager.jsx")).default;
});

after(async () => {
  await vite?.close();
});

function makeApi(initialUser, initialMembers = []) {
  const state = {
    user: { ...initialUser },
    members: initialMembers.map((row) => ({ ...row })),
    goals: [],
    tasks: [],
    memberCreates: 0,
  };
  let nextId = 1;
  const id = (prefix) => `${prefix}-${nextId++}`;
  const match = (row, criteria) =>
    Object.entries(criteria).every(([key, value]) => String(row[key]) === String(value));

  const api = {
    auth: { me: async () => ({ ...state.user }) },
    entities: {
      Member: {
        filter: async (criteria) => state.members.filter((row) => match(row, criteria)),
        create: async (payload) => {
          state.memberCreates += 1;
          const row = { id: id("member"), ...payload };
          state.members.push(row);
          return row;
        },
        update: async (memberId, payload) => {
          const row = state.members.find((item) => item.id === memberId);
          Object.assign(row, payload);
          return row;
        },
      },
      Goal: {
        filter: async (criteria) => state.goals.filter((row) => match(row, criteria)),
        get: async (goalId) => state.goals.find((row) => row.id === goalId) || null,
        create: async (payload) => {
          const row = { id: id("goal"), ...payload };
          state.goals.push(row);
          return row;
        },
        update: async (goalId, payload) => {
          const row = state.goals.find((item) => item.id === goalId);
          Object.assign(row, payload);
          return row;
        },
      },
      Task: {
        filter: async (criteria) => state.tasks.filter((row) => match(row, criteria)),
        delete: async (taskId) => {
          state.tasks = state.tasks.filter((row) => row.id !== taskId);
        },
        bulkCreate: async (items) => {
          const rows = items.map((payload) => ({ id: id("task"), ...payload }));
          state.tasks.push(...rows);
          return rows;
        },
        update: async (taskId, payload) => {
          const row = state.tasks.find((item) => item.id === taskId);
          Object.assign(row, payload);
          return row;
        },
      },
      User: {
        update: async (_userId, payload) => Object.assign(state.user, payload),
      },
    },
  };
  return { api, state };
}

function assertCompleteAndSelectable(state, saved) {
  assert.equal(saved.member.role, "manager");
  assert.equal(saved.member.gender, PLAN.zone);
  assert.equal(saved.member.target, PLAN.target);
  assert.equal(saved.member.next_month_target, PLAN.target);
  assert.equal(saved.member.next_month_zone, PLAN.zone);
  assert.deepEqual(saved.member.next_month_tasks, PLAN.tasks);
  assert.equal(saved.member.next_month_reward, PLAN.rewardText);
  assert.equal(saved.member.goal_id, saved.goal.id);
  assert.equal(state.tasks.length, 4);

  const matches = getMatchingManagers(state.members, {
    gender: PLAN.zone,
    target: PLAN.target,
  });
  assert.deepEqual(matches.map((manager) => manager.user_id), [state.user.id]);
}

function assertStepManagerShowsFreshManager(state) {
  const html = renderToStaticMarkup(
    React.createElement(StepManager, {
      user: { subscription_status: "active" },
      managers: state.members,
      groups: [],
      gender: PLAN.zone,
      target: PLAN.target,
      manager: null,
      setManager: () => {},
    })
  );
  assert.match(html, new RegExp(state.user.full_name));
  assert.doesNotMatch(html, /צור\/י קשר עם שולי בן לולו/);
}

test("manager without Member opens ManagerGoalSelection and saves every plan field", async () => {
  const { api, state } = makeApi({
    id: "manager-1",
    role: "manager",
    full_name: "Fresh Manager",
  });

  const member = await ensureManagerGoalSelectionMember(api, state.user, null);
  const saved = await saveManagerGoalSelection(api, { member, ...PLAN });

  assert.equal(state.memberCreates, 1);
  assertCompleteAndSelectable(state, saved);
});

test("immediate promotion without prior onboarding becomes selectable in StepManager", async () => {
  const { api, state } = makeApi({ id: "manager-2", role: "user", full_name: "Immediate" });

  // Backend promote-immediate atomically creates this minimal Member before login.
  state.user.role = "manager";
  state.members.push({
    id: "promoted-member",
    user_id: state.user.id,
    name: state.user.full_name,
    role: "manager",
  });
  const member = await ensureManagerGoalSelectionMember(api, state.user, state.members[0], {
    resetStats: false,
  });
  const saved = await saveManagerGoalSelection(api, {
    member,
    ...PLAN,
    resetStats: false,
  });

  assert.equal(state.memberCreates, 0);
  assertCompleteAndSelectable(state, saved);
  assertStepManagerShowsFreshManager(state);
});

test("regular day-23 promotion without Member becomes selectable in StepManager", async () => {
  const { api, state } = makeApi({ id: "manager-3", role: "user", full_name: "Scheduled" });

  // The established day-23 activation changes the User role and may leave Member absent.
  state.user.role = "manager";
  const member = await ensureManagerGoalSelectionMember(api, state.user, null);
  const saved = await saveManagerGoalSelection(api, { member, ...PLAN });

  assert.equal(state.memberCreates, 1);
  assertCompleteAndSelectable(state, saved);
  assertStepManagerShowsFreshManager(state);
});
