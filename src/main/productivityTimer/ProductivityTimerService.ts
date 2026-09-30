import {
  PRODUCTIVITY_TIMER_SCHEDULER_INTERVAL_MS,
  copyProductivityTimerSnapshot,
  createIdleProductivityTimerSnapshot,
  isProductivityTimerStartRequest,
  type ProductivityTimerCommandReason,
  type ProductivityTimerCommandResult,
  type ProductivityTimerSnapshot,
  type ProductivityTimerStartRequest
} from "../../shared/productivityTimer";
import type {
  PersistedProductivityTimer,
  ProductivityTimerPersistence
} from "./ProductivityTimerStore";

export interface ProductivityTimerClock { now(): number; }

export interface ProductivityTimerScheduler {
  setInterval(listener: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface ProductivityTimerServiceOptions {
  readonly clock?: ProductivityTimerClock;
  readonly scheduler?: ProductivityTimerScheduler;
  readonly onChanged?: (snapshot: ProductivityTimerSnapshot) => void;
  readonly allowDevelopmentDurations?: boolean;
  readonly createTimerId?: (now: number) => string;
}

const DEFAULT_CLOCK: ProductivityTimerClock = { now: () => Date.now() };
const DEFAULT_SCHEDULER: ProductivityTimerScheduler = {
  setInterval: (listener, intervalMs) => setInterval(listener, intervalMs),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>)
};

export class ProductivityTimerService {
  private readonly clock: ProductivityTimerClock;
  private readonly scheduler: ProductivityTimerScheduler;
  private snapshot: ProductivityTimerSnapshot;
  private intervalHandle: unknown | null = null;
  private initialized = false;
  private disposed = false;
  private initialization: Promise<void> | null = null;

  public constructor(
    private readonly persistence: ProductivityTimerPersistence,
    private readonly options: ProductivityTimerServiceOptions = {}
  ) {
    this.clock = options.clock ?? DEFAULT_CLOCK;
    this.scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
    this.snapshot = createIdleProductivityTimerSnapshot(this.clock.now());
  }

  public initialize(): Promise<void> {
    if (this.initialization !== null) return this.initialization;
    this.initialization = this.initializeOnce();
    return this.initialization;
  }

  public getSnapshot(): ProductivityTimerSnapshot {
    if (this.snapshot.state === "running") {
      const now = this.clock.now();
      if (now >= (this.snapshot.deadlineAt ?? Number.POSITIVE_INFINITY)) {
        this.complete(now);
      } else {
        return copyProductivityTimerSnapshot({
          ...this.snapshot,
          remainingMs: Math.max((this.snapshot.deadlineAt ?? now) - now, 0)
        });
      }
    }
    return copyProductivityTimerSnapshot(this.snapshot);
  }

  public async startTimer(
    request: ProductivityTimerStartRequest
  ): Promise<ProductivityTimerCommandResult> {
    if (
      this.disposed ||
      !isProductivityTimerStartRequest(
        request,
        this.options.allowDevelopmentDurations === true
      )
    ) return this.result(false, "INVALID_REQUEST");
    if (
      this.snapshot.state === "running" ||
      this.snapshot.state === "paused" ||
      (this.snapshot.state === "completed" && this.snapshot.completionPending)
    ) return this.result(false, "ACTIVE_TIMER_EXISTS");

    const now = this.clock.now();
    const timerId = this.options.createTimerId?.(now) ??
      `${now}-${Math.random().toString(36).slice(2, 10)}`;
    this.snapshot = {
      state: "running",
      durationMs: request.durationMs,
      remainingMs: request.durationMs,
      startedAt: now,
      deadlineAt: now + request.durationMs,
      pausedAt: null,
      completedAt: null,
      kind: request.kind,
      label: request.label,
      timerId,
      completionId: null,
      completionPending: false,
      schedulerActive: false,
      updatedAt: now
    };
    this.ensureScheduler();
    await this.persistence.save(this.toPersisted());
    this.emit();
    return this.result(true, "STARTED");
  }

  public async pause(): Promise<ProductivityTimerCommandResult> {
    const current = this.getSnapshot();
    if (current.state !== "running") return this.result(false, "INVALID_STATE");
    const now = this.clock.now();
    this.stopScheduler();
    this.snapshot = {
      ...current,
      state: "paused",
      remainingMs: Math.max((current.deadlineAt ?? now) - now, 0),
      deadlineAt: null,
      pausedAt: now,
      schedulerActive: false,
      updatedAt: now
    };
    await this.persistence.save(this.toPersisted());
    this.emit();
    return this.result(true, "PAUSED");
  }

  public async resume(): Promise<ProductivityTimerCommandResult> {
    if (this.snapshot.state !== "paused" || this.disposed) {
      return this.result(false, "INVALID_STATE");
    }
    const now = this.clock.now();
    this.snapshot = {
      ...this.snapshot,
      state: "running",
      deadlineAt: now + this.snapshot.remainingMs,
      pausedAt: null,
      schedulerActive: false,
      updatedAt: now
    };
    this.ensureScheduler();
    await this.persistence.save(this.toPersisted());
    this.emit();
    return this.result(true, "RESUMED");
  }

  public async cancel(): Promise<ProductivityTimerCommandResult> {
    if (this.snapshot.state === "idle") {
      return this.result(true, "CANCELLED");
    }
    this.stopScheduler();
    this.snapshot = createIdleProductivityTimerSnapshot(this.clock.now());
    await this.persistence.clear();
    this.emit();
    return this.result(true, "CANCELLED");
  }

  public async acknowledgeCompletion(
    completionId: string
  ): Promise<ProductivityTimerCommandResult> {
    if (
      this.snapshot.state !== "completed" ||
      !this.snapshot.completionPending
    ) return this.result(false, "INVALID_STATE");
    if (completionId !== this.snapshot.completionId) {
      return this.result(false, "COMPLETION_ID_MISMATCH");
    }
    this.snapshot = {
      ...this.snapshot,
      completionPending: false,
      updatedAt: this.clock.now()
    };
    await this.persistence.save(this.toPersisted());
    this.emit();
    return this.result(true, "COMPLETION_ACKNOWLEDGED");
  }

  public refresh(): ProductivityTimerSnapshot {
    if (this.snapshot.state !== "running") return this.getSnapshot();
    const now = this.clock.now();
    const remainingMs = Math.max((this.snapshot.deadlineAt ?? now) - now, 0);
    if (remainingMs === 0) {
      this.complete(now);
    } else if (remainingMs !== this.snapshot.remainingMs) {
      this.snapshot = { ...this.snapshot, remainingMs, updatedAt: now };
      this.emit();
    }
    return copyProductivityTimerSnapshot(this.snapshot);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopScheduler();
  }

  private async initializeOnce(): Promise<void> {
    if (this.initialized || this.disposed) return;
    this.initialized = true;
    const persisted = await this.persistence.load();
    if (persisted === null) return;
    this.restore(persisted);
  }

  private restore(persisted: PersistedProductivityTimer): void {
    const now = this.clock.now();
    const common = {
      durationMs: persisted.durationMs,
      startedAt: persisted.startedAt,
      kind: persisted.kind,
      label: persisted.label,
      timerId: persisted.timerId
    } as const;
    if (persisted.state === "running") {
      this.snapshot = {
        ...common,
        state: "running",
        remainingMs: Math.max(persisted.deadlineAt - now, 0),
        deadlineAt: persisted.deadlineAt,
        pausedAt: null,
        completedAt: null,
        completionId: null,
        completionPending: false,
        schedulerActive: false,
        updatedAt: now
      };
      if (persisted.deadlineAt <= now) {
        this.complete(now);
        return;
      }
      this.ensureScheduler();
    } else if (persisted.state === "paused") {
      this.snapshot = {
        ...common,
        state: "paused",
        remainingMs: persisted.remainingMs,
        deadlineAt: null,
        pausedAt: persisted.pausedAt,
        completedAt: null,
        completionId: null,
        completionPending: false,
        schedulerActive: false,
        updatedAt: now
      };
    } else {
      this.snapshot = {
        ...common,
        state: "completed",
        remainingMs: 0,
        deadlineAt: null,
        pausedAt: null,
        completedAt: persisted.completedAt,
        completionId: persisted.timerId,
        completionPending: persisted.completionPending,
        schedulerActive: false,
        updatedAt: now
      };
    }
    this.emit();
  }

  private ensureScheduler(): void {
    if (this.intervalHandle !== null || this.disposed) return;
    this.intervalHandle = this.scheduler.setInterval(
      () => { this.refresh(); },
      PRODUCTIVITY_TIMER_SCHEDULER_INTERVAL_MS
    );
    this.snapshot = { ...this.snapshot, schedulerActive: true };
  }

  private stopScheduler(): void {
    if (this.intervalHandle === null) return;
    this.scheduler.clearInterval(this.intervalHandle);
    this.intervalHandle = null;
    this.snapshot = { ...this.snapshot, schedulerActive: false };
  }

  private complete(now: number): void {
    if (this.snapshot.state !== "running") return;
    this.stopScheduler();
    this.snapshot = {
      ...this.snapshot,
      state: "completed",
      remainingMs: 0,
      deadlineAt: null,
      pausedAt: null,
      completedAt: now,
      completionId: this.snapshot.timerId,
      completionPending: true,
      schedulerActive: false,
      updatedAt: now
    };
    void this.persistence.save(this.toPersisted());
    this.emit();
  }

  private toPersisted(): PersistedProductivityTimer {
    const snapshot = this.snapshot;
    if (
      snapshot.state === "idle" ||
      snapshot.timerId === null ||
      snapshot.kind === null ||
      snapshot.startedAt === null
    ) throw new Error("Idle timer state cannot be persisted.");
    const common = {
      version: 1 as const,
      timerId: snapshot.timerId,
      durationMs: snapshot.durationMs,
      kind: snapshot.kind,
      label: snapshot.label,
      startedAt: snapshot.startedAt
    };
    if (snapshot.state === "running") {
      if (snapshot.deadlineAt === null) throw new Error("Running timer needs a deadline.");
      return { ...common, state: "running", deadlineAt: snapshot.deadlineAt };
    }
    if (snapshot.state === "paused") {
      if (snapshot.pausedAt === null) throw new Error("Paused timer needs a pause time.");
      return {
        ...common,
        state: "paused",
        remainingMs: snapshot.remainingMs,
        pausedAt: snapshot.pausedAt
      };
    }
    if (snapshot.completedAt === null) throw new Error("Completed timer needs a completion time.");
    return {
      ...common,
      state: "completed",
      completedAt: snapshot.completedAt,
      completionPending: snapshot.completionPending
    };
  }

  private result(
    accepted: boolean,
    reason: ProductivityTimerCommandReason
  ): ProductivityTimerCommandResult {
    return { accepted, reason, snapshot: this.getSnapshot() };
  }

  private emit(): void {
    this.options.onChanged?.(copyProductivityTimerSnapshot(this.snapshot));
  }
}
