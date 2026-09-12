import assert from "node:assert/strict";
import test from "node:test";
import type { PersonalitySnapshot } from "../src/renderer/engine/PersonalityController";
import type { AutonomousStateName } from "../src/renderer/states/PetState";
import { calculateBehaviorWeights } from "../src/renderer/utils/behaviorWeights";

const defaults: PersonalitySnapshot = {
  irritation: 15,
  energy: 75,
  boredom: 20,
  chaos: 30
};

const weight = (
  personality: PersonalitySnapshot,
  state: AutonomousStateName,
  recentStates: readonly AutonomousStateName[] = []
): number => {
  const choice = calculateBehaviorWeights(personality, recentStates).find(
    (candidate) => candidate.value === state
  );
  assert.notEqual(choice, undefined);
  return choice!.weight;
};

test("high irritation raises the angry weight", () => {
  assert.equal(
    weight({ ...defaults, irritation: 100 }, "ANGRY") >
      weight({ ...defaults, irritation: 0 }, "ANGRY"),
    true
  );
});

test("low energy strongly raises the sleeping weight", () => {
  const exhausted = weight({ ...defaults, energy: 5 }, "SLEEPING");
  const rested = weight({ ...defaults, energy: 100 }, "SLEEPING");
  assert.equal(exhausted > rested * 10, true);
});

test("high boredom raises active behavior weights", () => {
  const bored = { ...defaults, boredom: 100 };
  const content = { ...defaults, boredom: 0 };
  assert.equal(weight(bored, "CRAWLING") > weight(content, "CRAWLING"), true);
  assert.equal(weight(bored, "LAUGHING") > weight(content, "LAUGHING"), true);
  assert.equal(weight(bored, "STARING") > weight(content, "STARING"), true);
});

test("high chaos subtly raises laughing and staring weights", () => {
  const chaotic = { ...defaults, chaos: 100 };
  const calm = { ...defaults, chaos: 0 };
  assert.equal(weight(chaotic, "LAUGHING") > weight(calm, "LAUGHING"), true);
  assert.equal(weight(chaotic, "STARING") > weight(calm, "STARING"), true);
});

test("all calculated weights remain positive and finite", () => {
  const extremes: PersonalitySnapshot[] = [
    { irritation: 0, energy: 0, boredom: 0, chaos: 0 },
    { irritation: 100, energy: 100, boredom: 100, chaos: 100 }
  ];
  for (const personality of extremes) {
    for (const choice of calculateBehaviorWeights(personality)) {
      assert.equal(choice.weight > 0, true);
      assert.equal(Number.isFinite(choice.weight), true);
    }
  }
});

test("recent-state cooldown reduces repeated-state probability", () => {
  const normal = weight(defaults, "ANGRY");
  const mostRecent = weight(defaults, "ANGRY", ["ANGRY"]);
  const older = weight(defaults, "ANGRY", ["CRAWLING", "ANGRY"]);
  assert.equal(mostRecent < older, true);
  assert.equal(older < normal, true);
});
