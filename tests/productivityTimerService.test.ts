import assert from "node:assert/strict";
import test from "node:test";
import {
  ProductivityTimerService,
  type ProductivityTimerScheduler
} from "../src/main/productivityTimer/ProductivityTimerService";
import type {
  PersistedProductivityTimer,
  ProductivityTimerPersistence
} from "../src/main/productivityTimer/ProductivityTimerStore";

class FakePersistence implements ProductivityTimerPersistence {
  public saves: PersistedProductivityTimer[] = [];
  public clears = 0;
  public constructor(public restored: PersistedProductivityTimer | null = null) {}
  public async load(): Promise<PersistedProductivityTimer | null> { return this.restored; }
  public async save(value: PersistedProductivityTimer): Promise<void> {
    this.saves.push(value);
    this.restored = value;
  }
  public async clear(): Promise<void> { this.clears += 1; this.restored = null; }
}

class FakeScheduler implements ProductivityTimerScheduler {
  public listener: (() => void) | null = null;
  public starts = 0;
  public clears = 0;
  public intervalMs: number | null = null;
  public setInterval(listener: () => void, intervalMs: number): unknown {
    assert.equal(this.listener, null);
    this.listener = listener;
    this.intervalMs = intervalMs;
    this.starts += 1;
    return listener;
  }
  public clearInterval(): void {
    this.listener = null;
    this.clears += 1;
  }
  public tick(): void { this.listener?.(); }
}

const request = { kind: "countdown", durationMs: 60_000, label: "Test" } as const;
const setup = (restored: PersistedProductivityTimer | null = null) => {
  let now = 1_000;
  const persistence = new FakePersistence(restored);
  const scheduler = new FakeScheduler();
  const changes: string[] = [];
  const service = new ProductivityTimerService(persistence, {
    clock: { now: () => now },
    scheduler,
    createTimerId: () => "timer-1",
    onChanged: (snapshot) => changes.push(snapshot.state)
  });
  return { service, persistence, scheduler, changes, setNow: (value: number) => { now = value; } };
};

test("productivity timer starts IDLE without a scheduler", async () => {
  const { service, scheduler } = setup();
  await service.initialize();
  assert.equal(service.getSnapshot().state, "idle");
  assert.equal(scheduler.starts, 0);
});

test("start owns one 1000 ms scheduler and rejects a second active timer", async () => {
  const { service, scheduler, persistence } = setup();
  await service.initialize();
  const started = await service.startTimer(request);
  assert.equal(started.accepted, true);
  assert.equal(started.snapshot.deadlineAt, 61_000);
  assert.equal(scheduler.intervalMs, 1_000);
  assert.equal(scheduler.starts, 1);
  assert.equal((await service.startTimer(request)).reason, "ACTIVE_TIMER_EXISTS");
  assert.equal(scheduler.starts, 1);
  assert.equal(persistence.saves.length, 1);
});

test("remaining time is deadline-derived even when the scheduler fires five seconds late", async () => {
  const { service, scheduler, setNow } = setup();
  await service.initialize();
  await service.startTimer(request);
  setNow(6_000);
  scheduler.tick();
  assert.equal(service.getSnapshot().remainingMs, 55_000);
});

test("pause freezes remaining time and resume creates exactly one new deadline", async () => {
  const { service, scheduler, setNow } = setup();
  await service.initialize();
  await service.startTimer(request);
  setNow(11_000);
  const paused = await service.pause();
  assert.equal(paused.snapshot.remainingMs, 50_000);
  assert.equal(paused.snapshot.deadlineAt, null);
  assert.equal(scheduler.listener, null);
  setNow(1_211_000);
  assert.equal(service.getSnapshot().remainingMs, 50_000);
  const resumed = await service.resume();
  assert.equal(resumed.snapshot.deadlineAt, 1_261_000);
  assert.equal(scheduler.starts, 2);
});

test("late expiry clamps at zero, completes once, and stops its scheduler", async () => {
  const { service, scheduler, setNow, changes, persistence } = setup();
  await service.initialize();
  await service.startTimer(request);
  setNow(70_000);
  scheduler.tick();
  scheduler.tick();
  service.refresh();
  const completed = service.getSnapshot();
  assert.equal(completed.state, "completed");
  assert.equal(completed.remainingMs, 0);
  assert.equal(completed.completionPending, true);
  assert.equal(completed.completionId, "timer-1");
  assert.equal(changes.filter((state) => state === "completed").length, 1);
  assert.equal(persistence.saves.filter((value) => value.state === "completed").length, 1);
  assert.equal(scheduler.listener, null);
});

test("completion acknowledgement is identity-checked and persists once", async () => {
  const { service, scheduler, setNow } = setup();
  await service.initialize();
  await service.startTimer(request);
  setNow(61_000);
  scheduler.tick();
  assert.equal((await service.acknowledgeCompletion("wrong")).reason, "COMPLETION_ID_MISMATCH");
  const acknowledged = await service.acknowledgeCompletion("timer-1");
  assert.equal(acknowledged.accepted, true);
  assert.equal(acknowledged.snapshot.completionPending, false);
  assert.equal((await service.acknowledgeCompletion("timer-1")).accepted, false);
});

test("cancel is idempotent and clears persistence only for real lifecycle change", async () => {
  const { service, persistence, scheduler } = setup();
  await service.initialize();
  await service.startTimer(request);
  assert.equal((await service.cancel()).snapshot.state, "idle");
  assert.equal((await service.cancel()).snapshot.state, "idle");
  assert.equal(persistence.clears, 1);
  assert.equal(scheduler.listener, null);
});

test("scheduler ticks never write per-second countdown state", async () => {
  const { service, scheduler, persistence, setNow } = setup();
  await service.initialize();
  await service.startTimer(request);
  for (let index = 1; index <= 30; index += 1) {
    setNow(1_000 + index * 1_000);
    scheduler.tick();
  }
  assert.equal(persistence.saves.length, 1);
});

test("restart restores a running deadline and starts one scheduler", async () => {
  const persisted: PersistedProductivityTimer = {
    version: 1, state: "running", timerId: "restored", durationMs: 60_000,
    kind: "focus", label: "Focus", startedAt: 1_000, deadlineAt: 50_000
  };
  const { service, scheduler, setNow } = setup(persisted);
  setNow(20_000);
  await service.initialize();
  assert.equal(service.getSnapshot().remainingMs, 30_000);
  assert.equal(scheduler.starts, 1);
});

test("restart preserves a paused timer without a scheduler", async () => {
  const persisted: PersistedProductivityTimer = {
    version: 1, state: "paused", timerId: "restored", durationMs: 60_000,
    remainingMs: 22_000, kind: "focus", label: "Focus", startedAt: 1_000,
    pausedAt: 10_000
  };
  const { service, scheduler } = setup(persisted);
  await service.initialize();
  assert.equal(service.getSnapshot().state, "paused");
  assert.equal(service.getSnapshot().remainingMs, 22_000);
  assert.equal(scheduler.starts, 0);
});

test("restart after a sleeping-past-deadline gap completes without catch-up ticks", async () => {
  const persisted: PersistedProductivityTimer = {
    version: 1, state: "running", timerId: "restored", durationMs: 60_000,
    kind: "focus", label: "Focus", startedAt: 1_000, deadlineAt: 50_000
  };
  const { service, scheduler, setNow, changes } = setup(persisted);
  setNow(80_000);
  await service.initialize();
  assert.equal(service.getSnapshot().state, "completed");
  assert.equal(service.getSnapshot().completionPending, true);
  assert.equal(changes.filter((state) => state === "completed").length, 1);
  assert.equal(scheduler.starts, 0);
});

test("dispose is idempotent and stops the sole scheduler", async () => {
  const { service, scheduler } = setup();
  await service.initialize();
  await service.startTimer(request);
  service.dispose();
  service.dispose();
  assert.equal(scheduler.clears, 1);
  assert.equal(scheduler.listener, null);
});
