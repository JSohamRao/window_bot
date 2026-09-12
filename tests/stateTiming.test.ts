import assert from "node:assert/strict";
import test from "node:test";
import type { AnimationName } from "../src/renderer/animations/thukunaAnimations";
import { CursorAwarenessController } from "../src/renderer/engine/CursorAwarenessController";
import { MovementController } from "../src/renderer/engine/MovementController";
import { DEFAULT_POWER_POLICY_SNAPSHOT } from "../src/renderer/engine/PowerPolicyController";
import { StateMachine } from "../src/renderer/engine/StateMachine";
import { IdleState } from "../src/renderer/states/IdleState";
import type { PetContext, PetStateName } from "../src/renderer/states/PetState";
import { SleepingState } from "../src/renderer/states/SleepingState";

test("a timed state transitions only after its elapsed duration", () => {
  const movement = new MovementController({
    moveBy: async () => ({ x: 0, y: 0, hitBoundary: false })
  });
  const animation = {
    current: null as AnimationName | null,
    play(name: AnimationName) {
      this.current = name;
    },
    setDirection() {},
    getCurrentAnimation() {
      return this.current;
    },
    setMotionEnabled() {},
    setRageActive() {}
  };
  const machine = new StateMachine<PetStateName, PetContext>([
    new IdleState(),
    new SleepingState()
  ]);
  const cursor = new CursorAwarenessController(
    { getCursorPosition: async () => ({ x: 0, y: 0, sameDisplay: false }) },
    () => ({ windowX: 0, windowY: 0 }),
    { next: () => 0 }
  );
  let context: PetContext;
  context = {
    animation,
    movement,
    cursor,
    eventVisuals: {
      activate: () => undefined,
      reset: () => undefined,
    getSnapshot: () => ({ activeEvent: null, durationMs: 0, phase: "NONE", activationCount: 0, cleanupCount: 0 })
    },
    random: { next: () => 0 },
    transitionTo: (name) => {
      machine.transition(name, context);
    },
    restartCurrentState: () => machine.restart(context),
    getStateElapsedMs: () => machine.getElapsedMs(),
    getBehaviorWeights: () => [
      { value: "IDLE", weight: 1 }
    ],
    getPersonalitySnapshot: () => ({
      irritation: 15,
      energy: 75,
      boredom: 20,
      chaos: 30
    }),
    onCursorWatch: () => undefined,
    onMouseChase: () => undefined,
    showMouseDialogue: () => undefined,
    showRareEventDialogue: () => undefined,
    onRareEventFinished: () => undefined,
    isAutonomyPaused: () => false,
    isMouseAwarenessAllowed: () => true,
    getPowerPolicy: () => DEFAULT_POWER_POLICY_SNAPSHOT
  };

  machine.start("SLEEPING", context);
  machine.update(context, 7_999);
  assert.equal(machine.getCurrentState(), "SLEEPING");
  machine.update(context, 1);
  assert.equal(machine.getCurrentState(), "IDLE");
});
