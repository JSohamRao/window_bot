import assert from "node:assert/strict";
import test from "node:test";
import { PERSONALITY_DEFAULTS } from "../src/renderer/config/personalityConfig";
import { PersonalityController } from "../src/renderer/engine/PersonalityController";

const approximatelyEqual = (
  actual: number,
  expected: number,
  tolerance = 0.000_001
): void => {
  assert.equal(Math.abs(actual - expected) <= tolerance, true);
};

test("PersonalityController starts with centralized defaults", () => {
  const personality = new PersonalityController();
  assert.deepEqual(personality.getSnapshot(), PERSONALITY_DEFAULTS);
});

test("personality values clamp at zero and one hundred", () => {
  const personality = new PersonalityController();
  personality.setValues({ irritation: -50, energy: 500 });
  personality.adjustBoredom(-500);
  personality.adjustChaos(500);
  assert.deepEqual(personality.getSnapshot(), {
    irritation: 0,
    energy: 100,
    boredom: 0,
    chaos: 100
  });
});

test("idle drift increases boredom and slowly reduces energy and irritation", () => {
  const personality = new PersonalityController();
  personality.update(60_000, "IDLE");
  const snapshot = personality.getSnapshot();
  approximatelyEqual(snapshot.irritation, 14.4);
  approximatelyEqual(snapshot.energy, 74.3);
  approximatelyEqual(snapshot.boredom, 22);
});

test("sleep restores energy while crawling consumes it", () => {
  const sleeping = new PersonalityController();
  const crawling = new PersonalityController();
  sleeping.update(60_000, "SLEEPING");
  crawling.update(60_000, "CRAWLING");
  assert.equal(sleeping.getSnapshot().energy, 81);
  assert.equal(crawling.getSnapshot().energy, 73);
});

test("clicks and combo thresholds raise irritation without resetting", () => {
  const personality = new PersonalityController();
  personality.onClick();
  personality.onAnnoyedCombo();
  personality.onAngryCombo();
  assert.equal(personality.getSnapshot().irritation, 32);
  assert.equal(personality.getSnapshot().boredom, 18.5);
});

test("long drag raises irritation more than a normal drag", () => {
  const normal = new PersonalityController();
  const long = new PersonalityController();
  normal.onDragComplete(false);
  long.onDragComplete(true);
  assert.equal(
    long.getSnapshot().irritation > normal.getSnapshot().irritation,
    true
  );
  assert.equal(long.getSnapshot().boredom < normal.getSnapshot().boredom, true);
});

test("Rage raises irritation and applies relief only after an actual Rage event", () => {
  const personality = new PersonalityController();
  personality.onRage();
  assert.equal(personality.getSnapshot().irritation, 35);
  personality.onStateExited("RAGE");
  assert.equal(personality.getSnapshot().irritation, 27);
  personality.onStateExited("RAGE");
  assert.equal(personality.getSnapshot().irritation, 27);
});

test("personality drift is frame-rate independent", () => {
  const coarse = new PersonalityController();
  const fine = new PersonalityController();
  for (let index = 0; index < 60; index += 1) {
    coarse.update(1_000, "IDLE");
  }
  for (let index = 0; index < 600; index += 1) {
    fine.update(100, "IDLE");
  }
  const coarseSnapshot = coarse.getSnapshot();
  const fineSnapshot = fine.getSnapshot();
  approximatelyEqual(coarseSnapshot.irritation, fineSnapshot.irritation);
  approximatelyEqual(coarseSnapshot.energy, fineSnapshot.energy);
  approximatelyEqual(coarseSnapshot.boredom, fineSnapshot.boredom);
  approximatelyEqual(coarseSnapshot.chaos, fineSnapshot.chaos);
});

test("invalid inputs never produce NaN or Infinity", () => {
  const personality = new PersonalityController();
  personality.setValues({ irritation: Number.NaN, energy: Number.POSITIVE_INFINITY });
  personality.adjustBoredom(Number.NEGATIVE_INFINITY);
  personality.update(Number.NaN, "IDLE");
  personality.update(Number.POSITIVE_INFINITY, "SLEEPING");
  for (const value of Object.values(personality.getSnapshot())) {
    assert.equal(Number.isFinite(value), true);
  }
});

test("mouse watching and chasing apply their bounded personality effects", () => {
  const controller = new PersonalityController();
  const before = controller.getSnapshot();
  controller.onCursorWatch();
  controller.onMouseChase();
  const after = controller.getSnapshot();
  assert.equal(after.boredom, before.boredom - 1.5);
  assert.equal(after.chaos, before.chaos + 0.2);

  controller.setValues({ boredom: 0, chaos: 100 });
  controller.onMouseChase();
  const clamped = controller.getSnapshot();
  assert.equal(clamped.boredom, 0);
  assert.equal(clamped.chaos, 100);
});

test("mouse chase consumes more energy and boredom than crawling", () => {
  const crawling = new PersonalityController();
  const chasing = new PersonalityController();
  crawling.update(60_000, "CRAWLING");
  chasing.update(60_000, "CHASE_MOUSE");
  assert.equal(chasing.getSnapshot().energy < crawling.getSnapshot().energy, true);
  assert.equal(chasing.getSnapshot().boredom < crawling.getSnapshot().boredom, true);
});

test("rare-event semantic effects are modest, finite, and clamped", () => {
  const controller = new PersonalityController();
  const before = controller.getSnapshot();
  controller.onRareEventFinished("SPRINT");
  controller.onRareEventFinished("CHAOS_RUN");
  controller.onRareEventFinished("DOMAIN_EXPANSION");
  const after = controller.getSnapshot();
  assert.equal(after.energy < before.energy, true);
  assert.equal(after.boredom < before.boredom, true);
  assert.equal(after.irritation < before.irritation, true);
  assert.equal(Object.values(after).every(Number.isFinite), true);

  controller.setValues({ irritation: 0, energy: 0, boredom: 0, chaos: 0 });
  controller.onRareEventFinished("DOMAIN_EXPANSION");
  assert.equal(controller.getSnapshot().irritation, 0);
  assert.equal(controller.getSnapshot().chaos, 0);
});

test("Sprint and Chaos Run passive costs exceed ordinary crawling", () => {
  const crawling = new PersonalityController();
  const sprinting = new PersonalityController();
  const chaosRunning = new PersonalityController();
  crawling.update(60_000, "CRAWLING");
  sprinting.update(60_000, "SPRINT");
  chaosRunning.update(60_000, "CHAOS_RUN");
  assert.equal(sprinting.getSnapshot().energy < crawling.getSnapshot().energy, true);
  assert.equal(chaosRunning.getSnapshot().energy < sprinting.getSnapshot().energy, true);
  assert.equal(chaosRunning.getSnapshot().boredom < sprinting.getSnapshot().boredom, true);
});
