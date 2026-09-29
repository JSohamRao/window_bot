import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { DialogueController } from "../src/renderer/engine/DialogueController";
import { ProductivityTimerController } from "../src/renderer/engine/ProductivityTimerController";
import {
  createIdleProductivityTimerSnapshot,
  type ProductivityTimerSnapshot
} from "../src/shared/productivityTimer";

// Execute the actual composition callbacks, not a copied version of their ordering.
const renderer = readFileSync(path.join(process.cwd(), "src/renderer/pet.ts"), "utf8")
  .replace(/\r\n/g, "\n");
const between = (start: string, end: string, offset = 0): string => {
  const first = renderer.indexOf(start, offset);
  const last = renderer.indexOf(end, first);
  assert.ok(first >= 0 && last > first, "renderer callback must remain identifiable");
  return renderer.slice(first, last);
};

const setup = () => {
  const bubble = {
    textContent: "", dataset: {},
    classList: { add() {}, remove() {} }, setAttribute() {}
  } as unknown as HTMLElement;
  const dialogue = new DialogueController(bubble, { next: () => 0 });
  let snapshot = createIdleProductivityTimerSnapshot(1);
  let listener: ((value: ProductivityTimerSnapshot) => void) | null = null;
  let reactions = 0;
  let acknowledgements = 0;
  let visible = true;
  let active = true;
  let safe = true;
  let timer: ProductivityTimerController;
  const context = {
    dialogueController: dialogue,
    productivityTimerController: null as ProductivityTimerController | null,
    thukunaController: {
      setRuntimeVisible(value: boolean) {
        visible = value;
        timer.notifyReactionOpportunity(); // Actual FSM synchronously emits a snapshot.
      },
      applySystemAwareness(value: { sessionState: string }) {
        active = value.sessionState === "active";
        if (!active) safe = true; // Hard pause resets an unsafe state to IDLE.
        timer.notifyReactionOpportunity();
      },
      reactToTimerCompletion() {
        if (!visible || !active || !safe) return false;
        reactions += 1;
        timer.notifyReactionOpportunity();
        return true;
      }
    },
    latestSystemAwarenessSnapshot: { runtime: { hardPaused: false } },
    runtimeVisible: true,
    currentSettings: { dialogueEnabled: true },
    draggingPointerId: null, dragFrame: null, pendingDragPoint: null,
    interactionController: null, animationController: null,
    document: { body: { classList: { toggle() {}, remove() {} } } },
    performance: { now: () => 100 }, renderDebugOverlay() {}
  };
  const completionCallback = between(
    "    (snapshot) => {\n      if (thukunaController?.reactToTimerCompletion()",
    "\n  );",
    renderer.indexOf("productivityTimerController = new ProductivityTimerController")
  );
  timer = new ProductivityTimerController({
    getProductivityTimer: async () => snapshot,
    onProductivityTimerChanged: (callback) => { listener = callback; return () => { listener = null; }; },
    acknowledgeProductivityTimerCompletion: async () => {
      acknowledgements += 1;
      snapshot = { ...snapshot, completionPending: false, updatedAt: snapshot.updatedAt + 1 };
      return { accepted: true, reason: "COMPLETION_ACKNOWLEDGED", snapshot };
    },
    startProductivityTimer: async () => { throw new Error("not used"); },
    pauseProductivityTimer: async () => { throw new Error("not used"); },
    resumeProductivityTimer: async () => { throw new Error("not used"); },
    cancelProductivityTimer: async () => { throw new Error("not used"); }
  }, undefined, runInNewContext(`(${completionCallback})`, context));
  context.productivityTimerController = timer;
  const visibilityCallback = between(
    "(visible: boolean): void => {", ";\n  bridgeUnsubscribers.push(",
    renderer.indexOf("const applyVisibility =")
  ).replace("(visible: boolean): void", "(visible)");
  const awarenessCallback = between(
    "    (snapshot) => {", "\n  );\n  await systemAwarenessController.start();",
    renderer.indexOf("systemAwarenessController = new SystemAwarenessController")
  );
  return {
    timer, dialogue,
    setVisible: runInNewContext(`(${visibilityCallback})`, context) as (value: boolean) => void,
    setSession: (state: string) => runInNewContext(`(${awarenessCallback})`, context)({
      awareness: { sessionState: state }, runtime: { hardPaused: state !== "active" }
    }),
    setUnsafe: () => { safe = false; },
    complete() {
      snapshot = {
        state: "completed", durationMs: 5_000, remainingMs: 0, startedAt: 1,
        deadlineAt: null, pausedAt: null, completedAt: 10, kind: "countdown",
        label: "Test", timerId: "timer-1", completionId: "timer-1",
        completionPending: true, schedulerActive: false, updatedAt: 10
      };
      listener?.(snapshot);
    },
    get reactions() { return reactions; },
    get acknowledgements() { return acknowledgements; }
  };
};

test("Hide/Show enables dialogue before delivering a deferred timer completion", async () => {
  const harness = setup();
  await harness.timer.start();
  harness.setVisible(false);
  harness.complete();
  assert.equal(harness.reactions, 0);
  harness.setVisible(true);
  assert.equal(harness.reactions, 1);
  assert.equal(harness.dialogue.getSnapshot(100).line, "Timer done!");
  assert.equal(harness.acknowledgements, 1);
  harness.timer.notifyReactionOpportunity();
  assert.equal(harness.reactions, 1);
  harness.timer.dispose();
});

for (const state of ["locked", "suspended"]) {
  test(`${state} recovery enables dialogue before releasing a pending completion`, async () => {
    const harness = setup();
    await harness.timer.start();
    harness.setUnsafe();
    harness.complete();
    harness.setSession(state);
    assert.equal(harness.reactions, 0);
    harness.setSession("active");
    assert.equal(harness.reactions, 1);
    assert.equal(harness.dialogue.getSnapshot(100).line, "Timer done!");
    assert.equal(harness.acknowledgements, 1);
    harness.timer.notifyReactionOpportunity();
    assert.equal(harness.reactions, 1);
    harness.timer.dispose();
  });
}
