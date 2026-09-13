import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THUKUNA_SETTINGS } from "../src/shared/settings";
import type { SystemAwarenessSnapshot } from "../src/shared/systemAwareness";
import { PowerPolicyController } from "../src/renderer/engine/PowerPolicyController";

const awareness = (
  activityState: SystemAwarenessSnapshot["activityState"],
  powerSource: SystemAwarenessSnapshot["powerSource"]
): SystemAwarenessSnapshot => ({
  sessionState: "active",
  activityState,
  powerSource,
  idleSeconds: activityState === "idle" ? 120 : 0,
  updatedAt: 1,
  capabilities: {
    idleAwareness: true,
    sessionEvents: true,
    suspendResume: true,
    powerSource: true,
    displayEvents: true
  },
  lastTransition: null,
  idleSamplerActive: true,
  listenerCount: 9
});

test("idle and battery reduce work without mutating persisted Normal settings", () => {
  const settings = { ...DEFAULT_THUKUNA_SETTINGS };
  const original = { ...settings };
  const policy = new PowerPolicyController(settings);
  const normal = policy.getSnapshot();
  policy.updateSystemAwareness(awareness("idle", "battery"));
  const adjusted = policy.getSnapshot();
  assert.deepEqual(settings, original);
  assert.equal(adjusted.mode, "NORMAL");
  assert.equal(adjusted.autonomousMovementMultiplier < normal.autonomousMovementMultiplier, true);
  assert.equal(adjusted.idleDurationMultiplier > normal.idleDurationMultiplier, true);
  assert.equal(adjusted.rareEventIntervalMultiplier > normal.rareEventIntervalMultiplier, true);
});

test("idle policy biases rest while remaining a soft influence", () => {
  const policy = new PowerPolicyController(DEFAULT_THUKUNA_SETTINGS);
  policy.updateSystemAwareness(awareness("idle", "ac"));
  const adjusted = Object.fromEntries(policy.applyBehaviorWeights([
    { value: "IDLE", weight: 10 },
    { value: "SLEEPING", weight: 10 },
    { value: "CRAWLING", weight: 10 }
  ]).map(({ value, weight }) => [value, weight]));
  assert.equal(adjusted.IDLE > adjusted.CRAWLING, true);
  assert.equal(adjusted.SLEEPING > adjusted.CRAWLING, true);
  assert.equal(adjusted.CRAWLING > 0, true);
});

test("explicit Low Power remains stronger than temporary battery context", () => {
  const settings = { ...DEFAULT_THUKUNA_SETTINGS, lowPowerMode: true };
  const policy = new PowerPolicyController(settings);
  policy.updateSystemAwareness(awareness("idle", "battery"));
  const adjusted = policy.getSnapshot();
  assert.equal(adjusted.mode, "LOW_POWER");
  assert.equal(adjusted.mouseAwarenessAllowed, false);
  assert.equal(adjusted.rareEventsAllowed, false);
  assert.equal(settings.lowPowerMode, true);
});
