import assert from "node:assert/strict";
import test from "node:test";
import {
  SYSTEM_IDLE_SAMPLE_INTERVAL_MS,
  SYSTEM_IDLE_THRESHOLD_SECONDS,
  type SystemAwarenessCapabilities,
  type SystemAwarenessSnapshot,
  type SystemPowerSource
} from "../src/shared/systemAwareness";
import {
  SystemAwarenessService,
  type SystemAwarenessEvent,
  type SystemAwarenessProvider,
  type SystemAwarenessScheduler
} from "../src/main/systemAwareness/SystemAwarenessService";

const capabilities: SystemAwarenessCapabilities = {
  idleAwareness: true,
  sessionEvents: true,
  suspendResume: true,
  powerSource: true,
  displayEvents: true
};

class FakeProvider implements SystemAwarenessProvider {
  public readonly capabilities = capabilities;
  public idleSeconds = 0;
  public powerSource: SystemPowerSource = "ac";
  public throwIdle = false;
  public throwPower = false;
  private readonly listeners = new Map<SystemAwarenessEvent, Set<() => void>>();

  public getSystemIdleTime(): number {
    if (this.throwIdle) throw new Error("idle unavailable");
    return this.idleSeconds;
  }

  public getPowerSource(): SystemPowerSource {
    if (this.throwPower) throw new Error("power unavailable");
    return this.powerSource;
  }

  public subscribe(event: SystemAwarenessEvent, listener: () => void): () => void {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
    return () => listeners.delete(listener);
  }

  public emit(event: SystemAwarenessEvent): void {
    for (const listener of this.listeners.get(event) ?? []) listener();
  }

  public get listenerCount(): number {
    return [...this.listeners.values()].reduce((sum, values) => sum + values.size, 0);
  }
}

class FakeScheduler implements SystemAwarenessScheduler {
  public timestamp = 1_000;
  public setCalls = 0;
  public clearCalls = 0;
  public lastIntervalMs = 0;
  private nextId = 1;
  private readonly intervals = new Map<number, () => void>();

  public now(): number { return this.timestamp; }
  public setInterval(listener: () => void, intervalMs: number): unknown {
    this.setCalls += 1;
    this.lastIntervalMs = intervalMs;
    const id = this.nextId++;
    this.intervals.set(id, listener);
    return id;
  }
  public clearInterval(handle: unknown): void {
    this.clearCalls += 1;
    this.intervals.delete(handle as number);
  }
  public tick(elapsedMs = SYSTEM_IDLE_SAMPLE_INTERVAL_MS): void {
    this.timestamp += elapsedMs;
    for (const listener of [...this.intervals.values()]) listener();
  }
  public get activeIntervals(): number { return this.intervals.size; }
}

const setup = () => {
  const provider = new FakeProvider();
  const scheduler = new FakeScheduler();
  const changes: SystemAwarenessSnapshot[] = [];
  let geometryInvalidations = 0;
  const service = new SystemAwarenessService(provider, {
    scheduler,
    onChanged: (snapshot) => changes.push(snapshot),
    onGeometryInvalidated: () => { geometryInvalidations += 1; }
  });
  return {
    provider,
    scheduler,
    service,
    changes,
    get geometryInvalidations() { return geometryInvalidations; }
  };
};

test("service starts with one sampler, nine listeners, and a normalized snapshot", () => {
  const harness = setup();
  harness.service.start();
  const snapshot = harness.service.getSnapshot();
  assert.equal(snapshot.sessionState, "active");
  assert.equal(snapshot.activityState, "active");
  assert.equal(snapshot.powerSource, "ac");
  assert.equal(snapshot.listenerCount, 9);
  assert.equal(snapshot.idleSamplerActive, true);
  assert.equal(harness.provider.listenerCount, 9);
  assert.equal(harness.scheduler.activeIntervals, 1);
  assert.equal(harness.scheduler.lastIntervalMs, SYSTEM_IDLE_SAMPLE_INTERVAL_MS);
});

test("start and dispose are idempotent and dispose owns all cleanup", () => {
  const harness = setup();
  harness.service.start();
  harness.service.start();
  assert.equal(harness.scheduler.setCalls, 1);
  assert.equal(harness.provider.listenerCount, 9);
  harness.service.dispose();
  harness.service.dispose();
  assert.equal(harness.scheduler.clearCalls, 1);
  assert.equal(harness.scheduler.activeIntervals, 0);
  assert.equal(harness.provider.listenerCount, 0);
  assert.equal(harness.service.getSnapshot().listenerCount, 0);
});

test("lock and unlock hard-pause sampling without creating duplicate intervals", () => {
  const harness = setup();
  harness.service.start();
  harness.provider.emit("lock-screen");
  assert.equal(harness.service.getSnapshot().sessionState, "locked");
  assert.equal(harness.service.getSnapshot().idleSamplerActive, false);
  assert.equal(harness.scheduler.activeIntervals, 0);
  harness.provider.emit("lock-screen");
  assert.equal(harness.changes.filter(({ sessionState }) => sessionState === "locked").length, 1);
  harness.provider.emit("unlock-screen");
  assert.equal(harness.service.getSnapshot().sessionState, "active");
  assert.equal(harness.scheduler.activeIntervals, 1);
  assert.equal(harness.scheduler.setCalls, 2);
});

test("suspend and resume refresh context, sampler, and geometry exactly once", () => {
  const harness = setup();
  harness.service.start();
  harness.provider.emit("suspend");
  assert.equal(harness.service.getSnapshot().sessionState, "suspended");
  assert.equal(harness.scheduler.activeIntervals, 0);
  harness.provider.idleSeconds = 12;
  harness.provider.powerSource = "battery";
  harness.provider.emit("resume");
  const snapshot = harness.service.getSnapshot();
  assert.equal(snapshot.sessionState, "active");
  assert.equal(snapshot.idleSeconds, 12);
  assert.equal(snapshot.powerSource, "battery");
  assert.equal(harness.scheduler.activeIntervals, 1);
  assert.equal(harness.geometryInvalidations, 1);
});

test("resume preserves a pre-suspend lock until an actual unlock event", () => {
  const harness = setup();
  harness.service.start();
  harness.provider.emit("lock-screen");
  harness.provider.emit("suspend");
  harness.provider.emit("resume");
  assert.equal(harness.service.getSnapshot().sessionState, "locked");
  assert.equal(harness.scheduler.activeIntervals, 0);
  harness.provider.emit("unlock-screen");
  assert.equal(harness.service.getSnapshot().sessionState, "active");
  assert.equal(harness.scheduler.activeIntervals, 1);
});

test("idle threshold produces active to idle and idle to active transitions", () => {
  const harness = setup();
  harness.service.start();
  harness.provider.idleSeconds = SYSTEM_IDLE_THRESHOLD_SECONDS - 1;
  harness.scheduler.tick();
  assert.equal(harness.service.getSnapshot().activityState, "active");
  harness.provider.idleSeconds = SYSTEM_IDLE_THRESHOLD_SECONDS;
  harness.scheduler.tick();
  assert.equal(harness.service.getSnapshot().activityState, "idle");
  assert.equal(harness.service.getSnapshot().lastTransition?.from, "active");
  assert.equal(harness.service.getSnapshot().lastTransition?.to, "idle");
  harness.provider.idleSeconds = 0;
  harness.scheduler.tick();
  assert.equal(harness.service.getSnapshot().activityState, "active");
  assert.equal(harness.service.getSnapshot().lastTransition?.from, "idle");
});

test("unchanged samples and duplicate power events do not emit redundant snapshots", () => {
  const harness = setup();
  harness.service.start();
  harness.scheduler.tick();
  assert.equal(harness.changes.length, 0);
  harness.provider.emit("on-ac");
  assert.equal(harness.changes.length, 0);
  harness.provider.emit("on-battery");
  harness.provider.emit("on-battery");
  assert.equal(harness.changes.length, 1);
  assert.equal(harness.changes[0].powerSource, "battery");
});

test("idle measurement updates remain low-frequency without fake transition history", () => {
  const harness = setup();
  harness.service.start();
  harness.provider.idleSeconds = 15;
  harness.scheduler.tick();
  assert.equal(harness.changes.length, 1);
  assert.equal(harness.changes[0].idleSeconds, 15);
  assert.equal(harness.changes[0].lastTransition, null);
});

test("AC and battery events update only transient power context", () => {
  const harness = setup();
  harness.service.start();
  harness.provider.emit("on-battery");
  assert.equal(harness.service.getSnapshot().powerSource, "battery");
  harness.provider.emit("on-ac");
  assert.equal(harness.service.getSnapshot().powerSource, "ac");
  assert.deepEqual(
    harness.changes.map(({ lastTransition }) => lastTransition?.kind),
    ["power", "power"]
  );
});

test("display events only invalidate geometry and retain bounded system data", () => {
  const harness = setup();
  harness.service.start();
  harness.provider.emit("display-added");
  harness.provider.emit("display-removed");
  harness.provider.emit("display-metrics-changed");
  assert.equal(harness.geometryInvalidations, 3);
  assert.equal(harness.service.getSnapshot().lastTransition?.kind, "display");
  assert.equal(harness.service.getSnapshot().sessionState, "active");
});

test("provider failures normalize to unknown instead of crashing", () => {
  const harness = setup();
  harness.provider.throwIdle = true;
  harness.provider.throwPower = true;
  harness.service.start();
  const snapshot = harness.service.getSnapshot();
  assert.equal(snapshot.activityState, "unknown");
  assert.equal(snapshot.powerSource, "unknown");
  assert.equal(snapshot.idleSeconds, 0);
});
