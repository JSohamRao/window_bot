import assert from "node:assert/strict";
import test from "node:test";
import { CURSOR_CONFIG } from "../src/renderer/config/cursorConfig";
import {
  CursorAwarenessController,
  calculateCursorNoticeChance,
  calculateMouseChaseChance,
  calculateMouseChaseSpeed,
  type CursorPositionSample
} from "../src/renderer/engine/CursorAwarenessController";
import type { PersonalitySnapshot } from "../src/renderer/engine/PersonalityController";

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

const personality: PersonalitySnapshot = {
  irritation: 15,
  energy: 75,
  boredom: 20,
  chaos: 30
};

test("idle awareness samples at its interval instead of every update", async () => {
  let calls = 0;
  const controller = new CursorAwarenessController(
    {
      getCursorPosition: async () => {
        calls += 1;
        return { x: 190, y: 160, sameDisplay: true };
      }
    },
    () => ({ windowX: 0, windowY: 0 }),
    { next: () => 0 }
  );
  controller.enableIdleAwareness();
  for (let index = 0; index < 100; index += 1) controller.update(10);
  await settle();
  assert.equal(calls, 0);
  controller.update(CURSOR_CONFIG.idleSampleMinMs - 1_000);
  await settle();
  assert.equal(calls, 1);
});

test("watch and chase modes obey configured active sample rates", async () => {
  let calls = 0;
  const controller = new CursorAwarenessController(
    {
      getCursorPosition: async () => {
        calls += 1;
        return { x: 190, y: 160, sameDisplay: true };
      }
    },
    () => ({ windowX: 0, windowY: 0 }),
    { next: () => 0 }
  );
  controller.enableWatching();
  controller.update(1);
  await settle();
  for (let index = 0; index < 7; index += 1) {
    controller.update(CURSOR_CONFIG.watchSampleIntervalMs);
    await settle();
  }
  assert.equal(controller.getSnapshot().queryCounts.WATCH, 8);
  assert.equal(controller.getSnapshot().sampleRateHz, 8);

  controller.enableChasing();
  controller.update(1);
  await settle();
  for (let index = 0; index < 9; index += 1) {
    controller.update(CURSOR_CONFIG.chaseSampleIntervalMs);
    await settle();
  }
  assert.equal(controller.getSnapshot().queryCounts.CHASE, 10);
  assert.equal(controller.getSnapshot().sampleRateHz, 10);
});

test("disabled tracking performs zero cursor queries", async () => {
  let calls = 0;
  const controller = new CursorAwarenessController(
    { getCursorPosition: async () => { calls += 1; return { x: 0, y: 0, sameDisplay: true }; } },
    () => ({ windowX: 0, windowY: 0 })
  );
  controller.update(100_000);
  await settle();
  assert.equal(calls, 0);
  assert.equal(controller.getSnapshot().mode, "OFF");
});

test("distance uses pet-stage center and reports direction and proximity", async () => {
  let sample: CursorPositionSample = { x: 190, y: 160, sameDisplay: true };
  const controller = new CursorAwarenessController(
    { getCursorPosition: async () => sample },
    () => ({ windowX: 0, windowY: 0 }),
    { next: () => 0 }
  );
  controller.enableChasing();
  controller.update(1);
  await settle();
  let snapshot = controller.getSnapshot();
  assert.equal(snapshot.horizontalDeltaPx, 100);
  assert.equal(snapshot.distancePx, 100);
  assert.equal(snapshot.cursorDirection, "right");
  assert.equal(snapshot.isNearby, true);

  sample = { x: 0, y: 160, sameDisplay: true };
  controller.update(CURSOR_CONFIG.chaseSampleIntervalMs);
  await settle();
  snapshot = controller.getSnapshot();
  assert.equal(snapshot.horizontalDeltaPx, -90);
  assert.equal(snapshot.cursorDirection, "left");
});

test("display mismatch is never nearby and cannot suggest chase movement", async () => {
  const controller = new CursorAwarenessController(
    { getCursorPosition: async () => ({ x: 90, y: 160, sameDisplay: false }) },
    () => ({ windowX: 0, windowY: 0 })
  );
  controller.enableChasing();
  controller.update(1);
  await settle();
  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.sameDisplay, false);
  assert.equal(snapshot.isNearby, false);
  assert.equal(snapshot.suggestedDirection, null);
});

test("dead zone and direction hysteresis prevent flip spam", async () => {
  let sample: CursorPositionSample = { x: 190, y: 160, sameDisplay: true };
  const controller = new CursorAwarenessController(
    { getCursorPosition: async () => sample },
    () => ({ windowX: 0, windowY: 0 })
  );
  controller.enableChasing();
  controller.update(1);
  await settle();
  assert.equal(controller.getSnapshot().suggestedDirection, "right");

  sample = { x: 20, y: 160, sameDisplay: true };
  controller.update(CURSOR_CONFIG.chaseSampleIntervalMs);
  await settle();
  assert.equal(controller.getSnapshot().suggestedDirection, "right");

  sample = { x: 0, y: 160, sameDisplay: true };
  controller.update(CURSOR_CONFIG.chaseSampleIntervalMs);
  await settle();
  assert.equal(controller.getSnapshot().suggestedDirection, "left");

  sample = { x: 100, y: 160, sameDisplay: true };
  controller.update(CURSOR_CONFIG.chaseSampleIntervalMs);
  await settle();
  assert.equal(controller.getSnapshot().isInsideDeadZone, true);
  assert.equal(controller.getSnapshot().suggestedDirection, null);
});

test("a provider error disables tracking without a runaway retry loop", async () => {
  let calls = 0;
  let failures = 0;
  const controller = new CursorAwarenessController(
    { getCursorPosition: async () => { calls += 1; throw new Error("unavailable"); } },
    () => ({ windowX: 0, windowY: 0 }),
    { next: () => 0 },
    undefined,
    () => { failures += 1; }
  );
  controller.enableChasing();
  controller.update(1);
  await settle();
  controller.update(100_000);
  await settle();
  assert.equal(calls, 1);
  assert.equal(failures, 1);
  assert.equal(controller.getSnapshot().mode, "OFF");
  assert.equal(controller.getSnapshot().failed, true);
});

test("personality biases notice chance, chase chance, and chase speed", () => {
  const bored = { ...personality, boredom: 100 };
  const content = { ...personality, boredom: 0 };
  assert.equal(calculateCursorNoticeChance(bored) > calculateCursorNoticeChance(content), true);
  assert.equal(calculateMouseChaseChance(bored) > calculateMouseChaseChance(content), true);
  assert.equal(
    calculateMouseChaseChance({ ...personality, energy: 100 }) >
      calculateMouseChaseChance({ ...personality, energy: 0 }),
    true
  );
  const chaosDifference =
    calculateMouseChaseChance({ ...personality, energy: 50, boredom: 0, chaos: 100 }) -
    calculateMouseChaseChance({ ...personality, energy: 50, boredom: 0, chaos: 0 });
  assert.equal(chaosDifference > 0 && chaosDifference <= 0.1, true);
  assert.equal(
    calculateMouseChaseSpeed({ ...personality, energy: 100, boredom: 100 }) <=
      CURSOR_CONFIG.maxChaseSpeedPxPerSecond,
    true
  );
});
