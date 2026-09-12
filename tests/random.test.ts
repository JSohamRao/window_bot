import assert from "node:assert/strict";
import test from "node:test";
import { randomBetween, weightedChoice, type RandomSource } from "../src/renderer/utils/random";

const source = (value: number): RandomSource => ({ next: () => value });

test("randomBetween stays inside its inclusive/exclusive bounds", () => {
  assert.equal(randomBetween(source(0), 10, 20), 10);
  assert.equal(randomBetween(source(0.999), 10, 20) < 20, true);
});

test("weightedChoice returns the value selected by cumulative weights", () => {
  const choices = [
    { value: "first", weight: 1 },
    { value: "second", weight: 3 }
  ] as const;
  assert.equal(weightedChoice(source(0), choices), "first");
  assert.equal(weightedChoice(source(0.5), choices), "second");
});

test("weightedChoice skips disabled zero-weight choices", () => {
  assert.equal(
    weightedChoice(source(0), [
      { value: "disabled", weight: 0 },
      { value: "enabled", weight: 1 }
    ]),
    "enabled"
  );
});
