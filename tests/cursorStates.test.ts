import assert from "node:assert/strict";
import test from "node:test";
import type { AnimationName } from "../src/renderer/animations/thukunaAnimations";
import type {
  CursorAwarenessController,
  CursorAwarenessSnapshot
} from "../src/renderer/engine/CursorAwarenessController";
import { MovementController } from "../src/renderer/engine/MovementController";
import { DEFAULT_POWER_POLICY_SNAPSHOT } from "../src/renderer/engine/PowerPolicyController";
import { ChaseMouseState } from "../src/renderer/states/ChaseMouseState";
import type { PetContext, PetStateName } from "../src/renderer/states/PetState";
import { WatchingCursorState } from "../src/renderer/states/WatchingCursorState";

const baseCursorSnapshot = (): CursorAwarenessSnapshot => ({
  mode: "CHASE",
  cursorX: 190,
  cursorY: 160,
  distancePx: 100,
  horizontalDeltaPx: 100,
  cursorDirection: "right",
  suggestedDirection: "right",
  sameDisplay: true,
  isNearby: true,
  isWithinChaseRadius: true,
  isInsideDeadZone: false,
  hasSample: true,
  sampleSequence: 0,
  sampleRateHz: 10,
  queryInFlight: false,
  queryCounts: { IDLE: 0, WATCH: 0, CHASE: 1 },
  failed: false
});

const setup = (hitBoundary = false) => {
  let cursorSnapshot = baseCursorSnapshot();
  let elapsedMs = 0;
  const transitions: PetStateName[] = [];
  const directions: string[] = [];
  let watchEnabled = 0;
  let chaseEnabled = 0;
  let disabled = 0;
  const cursor = {
    enableWatching: () => { watchEnabled += 1; },
    enableChasing: () => { chaseEnabled += 1; },
    disable: () => { disabled += 1; },
    getSnapshot: () => cursorSnapshot
  } as unknown as CursorAwarenessController;
  const movement = new MovementController({
    moveBy: async () => ({ x: 0, y: 0, hitBoundary })
  });
  const animation = {
    current: null as AnimationName | null,
    play(name: AnimationName) { this.current = name; },
    setDirection(direction: string) { directions.push(direction); },
    getCurrentAnimation() { return this.current; },
    setMotionEnabled() {},
    setRageActive() {}
  };
  const context: PetContext = {
    animation: animation as PetContext["animation"],
    movement,
    cursor,
    eventVisuals: {
      activate: () => undefined,
      reset: () => undefined,
    getSnapshot: () => ({ activeEvent: null, durationMs: 0, phase: "NONE", activationCount: 0, cleanupCount: 0 })
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
    showRareEventDialogue: () => undefined,
    onRareEventFinished: () => undefined,
    isAutonomyPaused: () => false,
    isMouseAwarenessAllowed: () => true,
    getPowerPolicy: () => DEFAULT_POWER_POLICY_SNAPSHOT
  };
  return {
    context,
    movement,
    transitions,
    directions,
    get watchEnabled() { return watchEnabled; },
    get chaseEnabled() { return chaseEnabled; },
    get disabled() { return disabled; },
    setCursor: (updates: Partial<CursorAwarenessSnapshot>) => {
      cursorSnapshot = { ...cursorSnapshot, ...updates };
    },
    setElapsed: (value: number) => { elapsedMs = value; }
  };
};

test("watching faces fresh cursor samples without moving", () => {
  const harness = setup();
  const state = new WatchingCursorState();
  state.enter(harness.context);
  harness.setCursor({ sampleSequence: 1, cursorDirection: "left" });
  state.update(harness.context, 125);
  assert.equal(harness.watchEnabled, 1);
  assert.equal(harness.directions.at(-1), "left");
  assert.equal(harness.movement.isMoving(), false);
});

test("watching gives up when the cursor leaves its display or range", () => {
  const harness = setup();
  const state = new WatchingCursorState();
  state.enter(harness.context);
  harness.setCursor({ sampleSequence: 1, sameDisplay: false, isNearby: false });
  state.update(harness.context, 125);
  assert.equal(harness.transitions.at(-1), "IDLE");
});

test("watching can choose chase at its duration boundary", () => {
  const harness = setup();
  const state = new WatchingCursorState();
  state.enter(harness.context);
  harness.setElapsed(800);
  state.update(harness.context, 125);
  assert.equal(harness.transitions.at(-1), "CHASE_MOUSE");
});

test("chase follows right and left cursor samples through MovementController", () => {
  const harness = setup();
  const state = new ChaseMouseState();
  state.enter(harness.context);
  harness.setCursor({ sampleSequence: 1, suggestedDirection: "right" });
  state.update(harness.context, 100);
  assert.equal(harness.movement.getDirection(), "right");
  assert.equal(harness.movement.isMoving(), true);
  harness.setCursor({
    sampleSequence: 2,
    suggestedDirection: "left",
    cursorDirection: "left",
    horizontalDeltaPx: -100
  });
  state.update(harness.context, 100);
  assert.equal(harness.movement.getDirection(), "left");
  assert.equal(harness.directions.at(-1), "left");
});

test("chase stops inside the dead zone and gives up after the hold", () => {
  const harness = setup();
  const state = new ChaseMouseState();
  state.enter(harness.context);
  harness.setCursor({
    sampleSequence: 1,
    isInsideDeadZone: true,
    suggestedDirection: null,
    horizontalDeltaPx: 10
  });
  state.update(harness.context, 300);
  assert.equal(harness.movement.isMoving(), false);
  state.update(harness.context, 300);
  assert.equal(harness.transitions.at(-1), "IDLE");
});

test("chase ends for a far cursor or expired duration", () => {
  const far = setup();
  const farState = new ChaseMouseState();
  farState.enter(far.context);
  far.setCursor({ sampleSequence: 1, distancePx: 700 });
  farState.update(far.context, 100);
  assert.equal(far.transitions.at(-1), "IDLE");

  const expired = setup();
  const expiredState = new ChaseMouseState();
  expiredState.enter(expired.context);
  expired.setElapsed(5_000);
  expiredState.update(expired.context, 100);
  assert.equal(expired.transitions.at(-1), "IDLE");
});

test("screen boundary ends chase instead of hammering movement IPC", async () => {
  const harness = setup(true);
  const state = new ChaseMouseState();
  state.enter(harness.context);
  harness.setCursor({ sampleSequence: 1, suggestedDirection: "right" });
  state.update(harness.context, 100);
  state.update(harness.context, 100);
  await new Promise((resolve) => setImmediate(resolve));
  state.update(harness.context, 16);
  assert.equal(harness.transitions.at(-1), "IDLE");
  assert.equal(harness.movement.isMoving(), false);
});
