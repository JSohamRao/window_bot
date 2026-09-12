import assert from "node:assert/strict";
import test from "node:test";
import type { AnimationName } from "../src/renderer/animations/thukunaAnimations";
import { RARE_EVENT_CONFIG, type RareEventName } from "../src/renderer/config/rareEventConfig";
import type { CursorAwarenessController } from "../src/renderer/engine/CursorAwarenessController";
import { MovementController } from "../src/renderer/engine/MovementController";
import { DEFAULT_POWER_POLICY_SNAPSHOT } from "../src/renderer/engine/PowerPolicyController";
import { ChaosRunState } from "../src/renderer/states/ChaosRunState";
import { CreepyFreezeState } from "../src/renderer/states/CreepyFreezeState";
import { DomainExpansionState } from "../src/renderer/states/DomainExpansionState";
import { FallenState } from "../src/renderer/states/FallenState";
import type { PetContext, PetStateName } from "../src/renderer/states/PetState";
import { SprintState } from "../src/renderer/states/SprintState";
import { ZoomStareState } from "../src/renderer/states/ZoomStareState";

const setup = (hitBoundary = false) => {
  let elapsedMs = 0;
  let activeVisual: RareEventName | null = null;
  let resets = 0;
  let cursorDisables = 0;
  let motionEnabled = true;
  const transitions: PetStateName[] = [];
  const directions: string[] = [];
  const finished: RareEventName[] = [];
  const dialogues: { event: RareEventName; bypass: boolean }[] = [];
  const visualPhases: string[] = [];
  const playedAnimations: AnimationName[] = [];
  const movement = new MovementController({
    moveBy: async () => ({ x: 0, y: 0, hitBoundary })
  });
  const animation = {
    current: null as AnimationName | null,
    play(name: AnimationName) { this.current = name; playedAnimations.push(name); },
    setDirection(direction: string) { directions.push(direction); },
    getCurrentAnimation() { return this.current; },
    setMotionEnabled(enabled: boolean) { motionEnabled = enabled; },
    setRageActive() {}
  };
  const context: PetContext = {
    animation: animation as PetContext["animation"],
    movement,
    cursor: {
      disable: () => { cursorDisables += 1; }
    } as unknown as CursorAwarenessController,
    eventVisuals: {
      activate: (event) => { activeVisual = event; },
      setPhase: (phase) => { visualPhases.push(phase); },
      reset: () => { activeVisual = null; resets += 1; },
    getSnapshot: () => ({ activeEvent: activeVisual, durationMs: 0, phase: visualPhases.at(-1) ?? "NONE", activationCount: 0, cleanupCount: 0 })
    },
    random: { next: () => 0 },
    transitionTo: (name) => { transitions.push(name); },
    restartCurrentState: () => undefined,
    getStateElapsedMs: () => elapsedMs,
    getBehaviorWeights: () => [{ value: "IDLE", weight: 1 }],
    getPersonalitySnapshot: () => ({ irritation: 15, energy: 75, boredom: 20, chaos: 30 }),
    onCursorWatch: () => undefined,
    onMouseChase: () => undefined,
    showMouseDialogue: () => undefined,
    showRareEventDialogue: (event, bypass = false) => { dialogues.push({ event, bypass }); },
    onRareEventFinished: (event) => { finished.push(event); },
    isAutonomyPaused: () => false,
    isMouseAwarenessAllowed: () => true,
    getPowerPolicy: () => DEFAULT_POWER_POLICY_SNAPSHOT
  };
  return {
    context,
    movement,
    transitions,
    directions,
    finished,
    dialogues,
    visualPhases,
    playedAnimations,
    setElapsed: (value: number) => { elapsedMs = value; },
    get activeVisual() { return activeVisual; },
    get resets() { return resets; },
    get cursorDisables() { return cursorDisables; },
    get motionEnabled() { return motionEnabled; }
  };
};

test("Sprint reuses MovementController at capped fast speed and ends on duration", () => {
  const harness = setup();
  const state = new SprintState();
  state.enter(harness.context);
  assert.equal(harness.activeVisual, "SPRINT");
  assert.equal(harness.cursorDisables, 1);
  assert.equal(harness.movement.isMoving(), true);
  assert.equal(
    harness.movement.getSnapshot().speedPxPerSecond >=
      RARE_EVENT_CONFIG.speed.sprint.minPxPerSecond,
    true
  );
  assert.equal(
    harness.movement.getSnapshot().speedPxPerSecond <=
      RARE_EVENT_CONFIG.speed.sprint.maxPxPerSecond,
    true
  );
  harness.setElapsed(RARE_EVENT_CONFIG.duration.SPRINT.maxMs);
  state.update(harness.context, 16);
  assert.equal(harness.transitions.at(-1), "IDLE");
  state.exit(harness.context);
  assert.equal(harness.movement.isMoving(), false);
  assert.equal(harness.activeVisual, null);
  assert.equal(harness.finished.at(-1), "SPRINT");
});

test("Sprint ends safely when MovementController reports a boundary", async () => {
  const harness = setup(true);
  const state = new SprintState();
  state.enter(harness.context);
  state.update(harness.context, 100);
  await new Promise((resolve) => setImmediate(resolve));
  state.update(harness.context, 16);
  assert.equal(harness.transitions.at(-1), "IDLE");
});

test("Fall is renderer-only and restores canonical visual state", () => {
  const harness = setup();
  const state = new FallenState();
  state.enter(harness.context);
  assert.equal(harness.activeVisual, "FALL_OVER");
  assert.equal(harness.movement.isMoving(), false);
  assert.equal(harness.motionEnabled, false);
  harness.setElapsed(RARE_EVENT_CONFIG.duration.FALL_OVER.maxMs);
  state.update(harness.context, 16);
  assert.equal(harness.transitions.at(-1), "IDLE");
  state.exit(harness.context);
  assert.equal(harness.activeVisual, null);
  assert.equal(harness.motionEnabled, true);
});

test("Creepy Freeze remains still, disables cursor tracking, and evaluates dialogue once", () => {
  const harness = setup();
  const state = new CreepyFreezeState();
  state.enter(harness.context);
  assert.equal(harness.motionEnabled, false);
  assert.equal(harness.movement.isMoving(), false);
  harness.setElapsed(RARE_EVENT_CONFIG.duration.CREEPY_FREEZE.minMs - 1_000);
  state.update(harness.context, 16);
  state.update(harness.context, 16);
  assert.equal(harness.dialogues.length, 1);
  harness.setElapsed(RARE_EVENT_CONFIG.duration.CREEPY_FREEZE.maxMs);
  state.update(harness.context, 16);
  assert.equal(harness.transitions.at(-1), "IDLE");
  state.exit(harness.context);
  assert.equal(harness.activeVisual, null);
});

test("Zoom uses the fixed visual layer and cleans up on interruption", () => {
  const harness = setup();
  const state = new ZoomStareState();
  state.enter(harness.context);
  assert.equal(harness.activeVisual, "ZOOM_STARE");
  assert.equal(RARE_EVENT_CONFIG.maximumEventScale, 1.25);
  state.exit(harness.context);
  assert.equal(harness.activeVisual, null);
  assert.equal(harness.resets, 1);
  assert.equal(harness.finished.at(-1), "ZOOM_STARE");
});

test("Chaos Run changes direction only at configured sub-intervals and stays capped", () => {
  const harness = setup();
  const state = new ChaosRunState();
  state.enter(harness.context);
  assert.equal(harness.directions.at(-1), "left");
  assert.equal(
    harness.movement.getSnapshot().speedPxPerSecond <=
      RARE_EVENT_CONFIG.speed.chaosRun.maxPxPerSecond,
    true
  );
  const initialDirectionCount = harness.directions.length;
  harness.setElapsed(RARE_EVENT_CONFIG.chaosDirectionChange.minMs - 1);
  state.update(harness.context, 16);
  assert.equal(harness.directions.length, initialDirectionCount);
  harness.setElapsed(RARE_EVENT_CONFIG.chaosDirectionChange.minMs);
  state.update(harness.context, 16);
  assert.equal(harness.directions.at(-1), "right");
  assert.equal(harness.directions.length, initialDirectionCount + 1);
});

test("Chaos Run reverses once at an edge and terminates at a repeated edge", async () => {
  const harness = setup(true);
  const state = new ChaosRunState();
  state.enter(harness.context);
  state.update(harness.context, 100);
  await new Promise((resolve) => setImmediate(resolve));
  state.update(harness.context, 16);
  assert.equal(harness.directions.at(-1), "right");
  state.update(harness.context, 100);
  await new Promise((resolve) => setImmediate(resolve));
  state.update(harness.context, 16);
  assert.equal(harness.transitions.at(-1), "IDLE");
});

test("Domain is local, stops movement/cursor, bypasses dialogue cooldown, and cleans up", () => {
  const harness = setup();
  harness.movement.start("right", 40);
  const state = new DomainExpansionState();
  state.enter(harness.context);
  assert.equal(harness.movement.isMoving(), false);
  assert.equal(harness.cursorDisables, 1);
  assert.equal(harness.activeVisual, "DOMAIN_EXPANSION");
  assert.equal(harness.dialogues.length, 0);
  harness.setElapsed(450);
  state.update(harness.context, 16);
  assert.deepEqual(harness.dialogues.at(-1), {
    event: "DOMAIN_EXPANSION",
    bypass: true
  });
  state.exit(harness.context);
  assert.equal(harness.activeVisual, null);
  assert.equal(harness.motionEnabled, true);
});

test("Domain advances through charge, aura, expand, peak, collapse, recover, and idle", () => {
  const harness = setup();
  const state = new DomainExpansionState();
  state.enter(harness.context);
  assert.equal(harness.playedAnimations.at(-1), "domain_charge");
  for (const [elapsed, animation, phase] of [
    [700, "domain_charge", "AURA"],
    [900, "domain_expand", "EXPAND"],
    [1_600, "domain_peak", "PEAK"],
    [2_400, "domain_collapse", "COLLAPSE"],
    [2_800, "domain_recover", "RECOVER"]
  ] as const) {
    harness.setElapsed(elapsed);
    state.update(harness.context, 16);
    assert.equal(harness.playedAnimations.at(-1), animation);
    assert.equal(harness.visualPhases.at(-1), phase);
  }
  harness.setElapsed(3_400);
  state.update(harness.context, 16);
  assert.equal(harness.transitions.at(-1), "IDLE");
});
