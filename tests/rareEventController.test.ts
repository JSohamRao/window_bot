import assert from "node:assert/strict";
import test from "node:test";
import {
  RARE_EVENT_CONFIG,
  RARE_EVENT_NAMES
} from "../src/renderer/config/rareEventConfig";
import {
  RareEventController,
  calculateRareEventIntervalRange,
  calculateRareEventOccurrenceChance,
  calculateRareEventWeights
} from "../src/renderer/engine/RareEventController";
import type { PersonalitySnapshot } from "../src/renderer/engine/PersonalityController";

const lowChaos: PersonalitySnapshot = {
  irritation: 15,
  energy: 75,
  boredom: 20,
  chaos: 0
};

const randomSequence = (values: readonly number[]) => {
  let index = 0;
  return {
    next: () => values[index++] ?? values.at(-1) ?? 0
  };
};

const activeContext = (personality = lowChaos) => ({
  canStart: true,
  suspended: false,
  personality
});

test("no rare event occurs before the scheduled initial eligibility", () => {
  const controller = new RareEventController(randomSequence([0, 0, 0]));
  controller.start(lowChaos);
  assert.equal(controller.update(74_999, activeContext()), null);
  assert.equal(controller.getSnapshot().checkCount, 0);
  assert.equal(controller.update(1, activeContext()), "SPRINT");
  assert.equal(controller.getSnapshot().checkCount, 1);
});

test("rare-event checks depend on elapsed time rather than RAF count", () => {
  const once = new RareEventController(randomSequence([0, 0, 0]));
  const many = new RareEventController(randomSequence([0, 0, 0]));
  once.start(lowChaos);
  many.start(lowChaos);
  const onceResult = once.update(75_000, activeContext());
  let manyResult = null;
  for (let frame = 0; frame < 75; frame += 1) {
    manyResult = many.update(1_000, activeContext()) ?? manyResult;
  }
  assert.equal(onceResult, "SPRINT");
  assert.equal(manyResult, "SPRINT");
  assert.equal(once.getSnapshot().checkCount, many.getSnapshot().checkCount);
});

test("sleep, pause, Rage, and drag suspension perform no event check", () => {
  for (const reason of ["sleep", "pause", "Rage", "drag"]) {
    const controller = new RareEventController(randomSequence([0]));
    controller.start(lowChaos);
    assert.equal(
      controller.update(1_000_000, {
        canStart: false,
        suspended: true,
        personality: lowChaos
      }),
      null,
      reason
    );
    assert.equal(controller.getSnapshot().checkCount, 0, reason);
    assert.equal(controller.getSnapshot().nextCheckInMs, null, reason);
  }
});

test("resume schedules a fresh full interval instead of triggering immediately", () => {
  const controller = new RareEventController(randomSequence([0]));
  controller.start(lowChaos);
  controller.suspend();
  controller.resume(lowChaos);
  assert.equal(controller.update(74_999, activeContext()), null);
  assert.equal(controller.getSnapshot().checkCount, 0);
});

test("global cooldown blocks consecutive events and per-event cooldown excludes Domain", () => {
  const controller = new RareEventController(randomSequence([0]));
  controller.start(lowChaos);
  assert.equal(controller.forceStart("DOMAIN_EXPANSION"), true);
  controller.completeEvent("DOMAIN_EXPANSION", lowChaos);
  let snapshot = controller.getSnapshot();
  assert.equal(snapshot.globalCooldownRemainingMs, 75_000);
  assert.equal(
    snapshot.perEventCooldownRemainingMs.DOMAIN_EXPANSION,
    RARE_EVENT_CONFIG.eventCooldownMs.DOMAIN_EXPANSION
  );
  assert.equal(controller.update(74_999, activeContext()), null);
  assert.equal(controller.getSnapshot().checkCount, 0);
  const selected = controller.update(1, activeContext());
  assert.notEqual(selected, "DOMAIN_EXPANSION");
  snapshot = controller.getSnapshot();
  assert.equal(snapshot.perEventCooldownRemainingMs.DOMAIN_EXPANSION > 300_000, true);
});

test("Domain cooldown is longer than every other event cooldown", () => {
  const domain = RARE_EVENT_CONFIG.eventCooldownMs.DOMAIN_EXPANSION;
  for (const event of RARE_EVENT_NAMES) {
    if (event !== "DOMAIN_EXPANSION") {
      assert.equal(domain > RARE_EVENT_CONFIG.eventCooldownMs[event], true);
    }
  }
});

test("chaos safely shortens intervals and raises occurrence chance", () => {
  const calm = { ...lowChaos, chaos: 0 };
  const chaotic = { ...lowChaos, chaos: 100 };
  const calmRange = calculateRareEventIntervalRange(calm);
  const chaoticRange = calculateRareEventIntervalRange(chaotic);
  assert.equal(chaoticRange.minMs >= 45_000, true);
  assert.equal(chaoticRange.maxMs <= 90_000, true);
  assert.equal(chaoticRange.minMs < calmRange.minMs, true);
  assert.equal(calculateRareEventOccurrenceChance(chaotic) > calculateRareEventOccurrenceChance(calm), true);
});

test("runtime Chaos policy reschedules sooner without bypassing safe caps", () => {
  const controller = new RareEventController(randomSequence([0, 0, 0]));
  controller.start(lowChaos);
  controller.setRuntimePolicy(
    { intervalMultiplier: 0.7, occurrenceChanceBoost: 0.12 },
    lowChaos
  );
  const scheduled = controller.getSnapshot();
  assert.equal(scheduled.nextCheckInMs, 52_500);
  assert.equal(scheduled.intervalMultiplier, 0.7);
  assert.equal(
    calculateRareEventOccurrenceChance({ ...lowChaos, chaos: 100 }, 1),
    0.75
  );
});

test("runtime policy clamps unsafe interval and occurrence inputs", () => {
  const controller = new RareEventController(randomSequence([0]));
  controller.start(lowChaos);
  controller.setRuntimePolicy(
    { intervalMultiplier: -10, occurrenceChanceBoost: 10 },
    lowChaos
  );
  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.intervalMultiplier, 0.65);
  assert.equal(snapshot.nextCheckInMs, 48_750);
});

test("personality weighting stays finite, positive, and appropriately biased", () => {
  const energetic = calculateRareEventWeights({ ...lowChaos, energy: 100 });
  const exhausted = calculateRareEventWeights({ ...lowChaos, energy: 0 });
  const irritated = calculateRareEventWeights({ ...lowChaos, irritation: 100 });
  const calm = calculateRareEventWeights({ ...lowChaos, irritation: 0 });
  const chaotic = calculateRareEventWeights({ ...lowChaos, chaos: 100 });
  assert.equal(energetic.SPRINT > exhausted.SPRINT, true);
  assert.equal(energetic.CHAOS_RUN > exhausted.CHAOS_RUN, true);
  assert.equal(exhausted.FALL_OVER > energetic.FALL_OVER, true);
  assert.equal(irritated.CREEPY_FREEZE > calm.CREEPY_FREEZE, true);
  assert.equal(irritated.DOMAIN_EXPANSION > calm.DOMAIN_EXPANSION, true);
  assert.equal(chaotic.CHAOS_RUN > energetic.CHAOS_RUN * 0.5, true);
  assert.equal(energetic.SPRINT > energetic.DOMAIN_EXPANSION, true);
  for (const weight of Object.values(chaotic)) {
    assert.equal(Number.isFinite(weight) && weight > 0, true);
  }
});

test("capability filtering excludes moving rare events without disabling local events", () => {
  const controller = new RareEventController(randomSequence([0, 0, 0]));
  controller.start(lowChaos);
  const selected = controller.update(75_000, {
    ...activeContext(),
    allowedEvents: [
      "FALL_OVER",
      "CREEPY_FREEZE",
      "ZOOM_STARE",
      "DOMAIN_EXPANSION"
    ]
  });
  assert.equal(
    ["FALL_OVER", "CREEPY_FREEZE", "ZOOM_STARE", "DOMAIN_EXPANSION"].includes(
      selected ?? ""
    ),
    true
  );
  assert.notEqual(selected, "SPRINT");
  assert.notEqual(selected, "CHAOS_RUN");
});
