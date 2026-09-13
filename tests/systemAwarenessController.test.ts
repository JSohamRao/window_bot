import assert from "node:assert/strict";
import test from "node:test";
import {
  SYSTEM_AWARENESS_HISTORY_LIMIT,
  type SystemAwarenessSnapshot
} from "../src/shared/systemAwareness";
import {
  SystemAwarenessController,
  resolveSystemRuntimeContext,
  type SystemAwarenessBridge
} from "../src/renderer/engine/SystemAwarenessController";

const snapshot = (
  updatedAt: number,
  patch: Partial<SystemAwarenessSnapshot> = {}
): SystemAwarenessSnapshot => ({
  sessionState: "active",
  activityState: "active",
  powerSource: "ac",
  idleSeconds: 0,
  updatedAt,
  capabilities: {
    idleAwareness: true,
    sessionEvents: true,
    suspendResume: true,
    powerSource: true,
    displayEvents: true
  },
  lastTransition: null,
  idleSamplerActive: true,
  listenerCount: 9,
  ...patch
});

class FakeBridge implements SystemAwarenessBridge {
  public current = snapshot(1);
  public subscriptions = 0;
  public unsubscriptions = 0;
  private listener: ((value: SystemAwarenessSnapshot) => void) | null = null;
  public async getSystemAwareness(): Promise<SystemAwarenessSnapshot> {
    return this.current;
  }
  public onSystemAwarenessChanged(
    listener: (value: SystemAwarenessSnapshot) => void
  ): () => void {
    this.subscriptions += 1;
    this.listener = listener;
    return () => {
      this.unsubscriptions += 1;
      this.listener = null;
    };
  }
  public emit(value: SystemAwarenessSnapshot): void { this.listener?.(value); }
}

test("renderer controller subscribes once, receives initial state, and disposes once", async () => {
  const bridge = new FakeBridge();
  const controller = new SystemAwarenessController(bridge);
  await controller.start();
  await controller.start();
  assert.equal(bridge.subscriptions, 1);
  assert.equal(controller.getSnapshot().awareness.powerSource, "ac");
  controller.dispose();
  controller.dispose();
  assert.equal(bridge.unsubscriptions, 1);
});

test("hard safety resolves suspended above locked and cannot become a soft modifier", () => {
  assert.equal(
    resolveSystemRuntimeContext(snapshot(1, { sessionState: "locked" })).blockReason,
    "SYSTEM_LOCKED"
  );
  assert.equal(
    resolveSystemRuntimeContext(snapshot(2, { sessionState: "suspended" })).blockReason,
    "SYSTEM_SUSPENDED"
  );
});

test("idle and battery remain soft, composable runtime modifiers", () => {
  const runtime = resolveSystemRuntimeContext(snapshot(1, {
    activityState: "idle",
    powerSource: "battery"
  }));
  assert.equal(runtime.hardPaused, false);
  assert.equal(runtime.cursorIntervalMultiplier, 3.75);
  assert.equal(runtime.effectivePolicyLabel, "IDLE+BATTERY");
});

test("transition history is deduplicated, ordered, and bounded to twenty", async () => {
  const bridge = new FakeBridge();
  const controller = new SystemAwarenessController(bridge);
  await controller.start();
  for (let index = 0; index < SYSTEM_AWARENESS_HISTORY_LIMIT + 5; index += 1) {
    const value = snapshot(index + 2, {
      lastTransition: {
        kind: "activity",
        from: index % 2 === 0 ? "active" : "idle",
        to: index % 2 === 0 ? "idle" : "active",
        at: index + 2
      }
    });
    bridge.emit(value);
    bridge.emit(value);
  }
  const history = controller.getSnapshot().transitionHistory;
  assert.equal(history.length, SYSTEM_AWARENESS_HISTORY_LIMIT);
  assert.equal(history[0].at, 7);
  assert.equal(history.at(-1)?.at, 26);
});

test("out-of-order snapshots cannot roll renderer awareness backward", async () => {
  const bridge = new FakeBridge();
  const controller = new SystemAwarenessController(bridge);
  await controller.start();
  bridge.emit(snapshot(10, { powerSource: "battery" }));
  bridge.emit(snapshot(5, { powerSource: "ac" }));
  assert.equal(controller.getSnapshot().awareness.powerSource, "battery");
});
