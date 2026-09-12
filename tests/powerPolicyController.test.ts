import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THUKUNA_SETTINGS } from "../src/shared/settings";
import { PowerPolicyController, resolvePowerMode } from "../src/renderer/engine/PowerPolicyController";

const weights = [
  { value: "CRAWLING" as const, weight: 20 },
  { value: "STARING" as const, weight: 20 },
  { value: "LAUGHING" as const, weight: 20 },
  { value: "SLEEPING" as const, weight: 20 },
  { value: "ANGRY" as const, weight: 20 },
  { value: "IDLE" as const, weight: 20 }
];

test("Normal policy preserves existing behavior", () => {
  const policy = new PowerPolicyController(DEFAULT_THUKUNA_SETTINGS);
  const snapshot = policy.getSnapshot();
  assert.equal(snapshot.mode, "NORMAL");
  assert.equal(snapshot.mouseAwarenessAllowed, true);
  assert.equal(snapshot.rareEventsAllowed, true);
  assert.deepEqual(policy.applyBehaviorWeights(weights), weights);
});

test("Chaos policy applies bounded activity, cursor, and rare-event boosts", () => {
  const policy = new PowerPolicyController({ ...DEFAULT_THUKUNA_SETTINGS, chaosMode: true });
  const snapshot = policy.getSnapshot();
  assert.equal(snapshot.mode, "CHAOS");
  assert.equal(snapshot.rareEventIntervalMultiplier >= 0.65, true);
  assert.equal(snapshot.rareEventOccurrenceBoost <= 0.2, true);
  assert.equal(snapshot.chaseSpeedMultiplier <= 1.1, true);
  const adjusted = Object.fromEntries(policy.applyBehaviorWeights(weights).map((entry) => [entry.value, entry.weight]));
  assert.equal(adjusted.CRAWLING > 20, true);
  assert.equal(adjusted.LAUGHING > 20, true);
});

test("Low Power disables mouse and rare events and strongly favors rest", () => {
  const policy = new PowerPolicyController({ ...DEFAULT_THUKUNA_SETTINGS, lowPowerMode: true });
  const snapshot = policy.getSnapshot();
  assert.equal(snapshot.mode, "LOW_POWER");
  assert.equal(snapshot.mouseAwarenessAllowed, false);
  assert.equal(snapshot.rareEventsAllowed, false);
  assert.equal(snapshot.personalityUpdateIntervalMs, 1_000);
  const adjusted = Object.fromEntries(policy.applyBehaviorWeights(weights).map((entry) => [entry.value, entry.weight]));
  assert.equal(adjusted.IDLE > adjusted.CRAWLING, true);
  assert.equal(adjusted.SLEEPING > adjusted.LAUGHING, true);
});

test("Low Power defensively takes precedence if both flags are present", () => {
  assert.equal(resolvePowerMode({ ...DEFAULT_THUKUNA_SETTINGS, chaosMode: true, lowPowerMode: true }), "LOW_POWER");
});

test("all power-policy values remain finite and nonnegative", () => {
  for (const mode of [
    DEFAULT_THUKUNA_SETTINGS,
    { ...DEFAULT_THUKUNA_SETTINGS, chaosMode: true },
    { ...DEFAULT_THUKUNA_SETTINGS, lowPowerMode: true }
  ]) {
    const snapshot = new PowerPolicyController(mode).getSnapshot();
    for (const value of Object.values(snapshot).filter((item): item is number => typeof item === "number")) {
      assert.equal(Number.isFinite(value) && value >= 0, true);
    }
  }
});
