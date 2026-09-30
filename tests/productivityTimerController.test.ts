import assert from "node:assert/strict";
import test from "node:test";
import {
  createIdleProductivityTimerSnapshot,
  type ProductivityTimerCommandResult,
  type ProductivityTimerSnapshot,
  type ProductivityTimerStartRequest
} from "../src/shared/productivityTimer";
import {
  ProductivityTimerController,
  type ProductivityTimerBridge
} from "../src/renderer/engine/ProductivityTimerController";

const completed = (updatedAt = 10): ProductivityTimerSnapshot => ({
  state: "completed", durationMs: 5_000, remainingMs: 0, startedAt: 1,
  deadlineAt: null, pausedAt: null, completedAt: 10, kind: "countdown",
  label: "Test", timerId: "timer-1", completionId: "timer-1",
  completionPending: true, schedulerActive: false, updatedAt
});

class FakeBridge implements ProductivityTimerBridge {
  public snapshot: ProductivityTimerSnapshot = createIdleProductivityTimerSnapshot(1);
  public listener: ((snapshot: ProductivityTimerSnapshot) => void) | null = null;
  public subscriptions = 0;
  public unsubscriptions = 0;
  public acknowledgements: string[] = [];
  public starts: ProductivityTimerStartRequest[] = [];
  public async getProductivityTimer(): Promise<ProductivityTimerSnapshot> { return this.snapshot; }
  public onProductivityTimerChanged(listener: (snapshot: ProductivityTimerSnapshot) => void): () => void {
    this.subscriptions += 1;
    this.listener = listener;
    return () => { this.unsubscriptions += 1; this.listener = null; };
  }
  public emit(snapshot: ProductivityTimerSnapshot): void { this.snapshot = snapshot; this.listener?.(snapshot); }
  private result(reason: ProductivityTimerCommandResult["reason"]): ProductivityTimerCommandResult {
    return { accepted: true, reason, snapshot: this.snapshot };
  }
  public async startProductivityTimer(request: ProductivityTimerStartRequest): Promise<ProductivityTimerCommandResult> {
    this.starts.push(request); return this.result("STARTED");
  }
  public async pauseProductivityTimer(): Promise<ProductivityTimerCommandResult> { return this.result("PAUSED"); }
  public async resumeProductivityTimer(): Promise<ProductivityTimerCommandResult> { return this.result("RESUMED"); }
  public async cancelProductivityTimer(): Promise<ProductivityTimerCommandResult> { return this.result("CANCELLED"); }
  public async acknowledgeProductivityTimerCompletion(id: string): Promise<ProductivityTimerCommandResult> {
    this.acknowledgements.push(id);
    this.snapshot = { ...this.snapshot, completionPending: false, updatedAt: this.snapshot.updatedAt + 1 };
    return this.result("COMPLETION_ACKNOWLEDGED");
  }
}

const flush = async (): Promise<void> => { await Promise.resolve(); await Promise.resolve(); };

test("timer renderer observer subscribes once, loads initial state, and cleans up", async () => {
  const bridge = new FakeBridge();
  const controller = new ProductivityTimerController(bridge);
  await controller.start();
  await controller.start();
  assert.equal(bridge.subscriptions, 1);
  controller.dispose();
  controller.dispose();
  assert.equal(bridge.unsubscriptions, 1);
});

test("completion reaction and acknowledgement happen exactly once", async () => {
  const bridge = new FakeBridge();
  let reactions = 0;
  const controller = new ProductivityTimerController(bridge, undefined, () => {
    reactions += 1; return true;
  });
  await controller.start();
  bridge.emit(completed());
  bridge.emit(completed());
  controller.notifyReactionOpportunity();
  await flush();
  assert.equal(reactions, 1);
  assert.deepEqual(bridge.acknowledgements, ["timer-1"]);
});

test("lock and suspend suppress reaction until an active session resumes", async () => {
  for (const blocked of ["locked", "suspended"] as const) {
    const bridge = new FakeBridge();
    let reactions = 0;
    const controller = new ProductivityTimerController(bridge, undefined, () => {
      reactions += 1; return true;
    });
    controller.setSystemSessionState(blocked);
    await controller.start();
    bridge.emit(completed());
    assert.equal(reactions, 0);
    assert.equal(bridge.acknowledgements.length, 0);
    controller.setSystemSessionState("active");
    await flush();
    assert.equal(reactions, 1);
    assert.equal(bridge.acknowledgements.length, 1);
  }
});

test("unsafe FSM reaction stays pending until another opportunity", async () => {
  const bridge = new FakeBridge();
  let safe = false;
  let attempts = 0;
  const controller = new ProductivityTimerController(bridge, undefined, () => {
    attempts += 1; return safe;
  });
  await controller.start();
  bridge.emit(completed());
  assert.equal(bridge.acknowledgements.length, 0);
  safe = true;
  controller.notifyReactionOpportunity();
  await flush();
  assert.equal(attempts, 2);
  assert.equal(bridge.acknowledgements.length, 1);
});

test("out-of-order timer snapshots cannot roll the renderer backward", async () => {
  const bridge = new FakeBridge();
  const controller = new ProductivityTimerController(bridge);
  await controller.start();
  bridge.emit({ ...createIdleProductivityTimerSnapshot(20) });
  bridge.emit({ ...createIdleProductivityTimerSnapshot(10) });
  assert.equal(controller.getSnapshot().updatedAt, 20);
});

test("development presets route through the same typed start bridge", async () => {
  const bridge = new FakeBridge();
  const controller = new ProductivityTimerController(bridge);
  await controller.start();
  await controller.startPreset("development-5-seconds");
  assert.deepEqual(bridge.starts, [
    { kind: "countdown", durationMs: 5_000, label: "5 second test" }
  ]);
});
