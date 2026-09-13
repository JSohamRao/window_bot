import {
  SYSTEM_IDLE_SAMPLE_INTERVAL_MS,
  SYSTEM_IDLE_THRESHOLD_SECONDS,
  copySystemAwarenessSnapshot,
  type SystemActivityState,
  type SystemAwarenessCapabilities,
  type SystemAwarenessSnapshot,
  type SystemAwarenessTransition,
  type SystemAwarenessTransitionKind,
  type SystemPowerSource,
  type SystemSessionState
} from "../../shared/systemAwareness";

export type SystemAwarenessEvent =
  | "lock-screen"
  | "unlock-screen"
  | "suspend"
  | "resume"
  | "on-battery"
  | "on-ac"
  | "display-added"
  | "display-removed"
  | "display-metrics-changed";

export interface SystemAwarenessProvider {
  readonly capabilities: SystemAwarenessCapabilities;
  getSystemIdleTime(): number;
  getPowerSource(): SystemPowerSource;
  subscribe(event: SystemAwarenessEvent, listener: () => void): () => void;
}

export interface SystemAwarenessScheduler {
  now(): number;
  setInterval(listener: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface SystemAwarenessServiceOptions {
  readonly idleThresholdSeconds?: number;
  readonly idleSampleIntervalMs?: number;
  readonly scheduler?: SystemAwarenessScheduler;
  readonly onChanged?: (snapshot: SystemAwarenessSnapshot) => void;
  readonly onGeometryInvalidated?: () => void;
}

const DEFAULT_SCHEDULER: SystemAwarenessScheduler = {
  now: () => Date.now(),
  setInterval: (listener, intervalMs) => globalThis.setInterval(listener, intervalMs),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>)
};

const EVENTS: readonly SystemAwarenessEvent[] = [
  "lock-screen",
  "unlock-screen",
  "suspend",
  "resume",
  "on-battery",
  "on-ac",
  "display-added",
  "display-removed",
  "display-metrics-changed"
];

const safeIdleSeconds = (provider: SystemAwarenessProvider): number | null => {
  try {
    const value = provider.getSystemIdleTime();
    return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
  } catch {
    return null;
  }
};

const safePowerSource = (provider: SystemAwarenessProvider): SystemPowerSource => {
  try {
    const value = provider.getPowerSource();
    return value === "ac" || value === "battery" ? value : "unknown";
  } catch {
    return "unknown";
  }
};

export class SystemAwarenessService {
  private readonly scheduler: SystemAwarenessScheduler;
  private readonly idleThresholdSeconds: number;
  private readonly idleSampleIntervalMs: number;
  private readonly unsubscribers: Array<() => void> = [];
  private idleSampler: unknown = null;
  private started = false;
  private sessionBeforeSuspend: Exclude<SystemSessionState, "suspended"> = "active";
  private snapshot: SystemAwarenessSnapshot;

  public constructor(
    private readonly provider: SystemAwarenessProvider,
    private readonly options: SystemAwarenessServiceOptions = {}
  ) {
    this.scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
    this.idleThresholdSeconds = Math.max(
      Math.floor(options.idleThresholdSeconds ?? SYSTEM_IDLE_THRESHOLD_SECONDS),
      1
    );
    this.idleSampleIntervalMs = Math.max(
      Math.floor(options.idleSampleIntervalMs ?? SYSTEM_IDLE_SAMPLE_INTERVAL_MS),
      1_000
    );
    this.snapshot = {
      sessionState: "active",
      activityState: "unknown",
      powerSource: "unknown",
      idleSeconds: 0,
      updatedAt: this.scheduler.now(),
      capabilities: { ...provider.capabilities },
      lastTransition: null,
      idleSamplerActive: false,
      listenerCount: 0
    };
  }

  public start(): void {
    if (this.started) return;
    this.started = true;
    for (const event of EVENTS) {
      if (!this.supports(event)) continue;
      this.unsubscribers.push(
        this.provider.subscribe(event, () => this.handleEvent(event))
      );
    }
    this.snapshot = {
      ...this.snapshot,
      listenerCount: this.unsubscribers.length,
      powerSource: this.provider.capabilities.powerSource
        ? safePowerSource(this.provider)
        : "unknown"
    };
    this.sampleIdle(false);
    this.startIdleSampler();
  }

  public dispose(): void {
    if (!this.started && this.unsubscribers.length === 0 && this.idleSampler === null) {
      return;
    }
    this.started = false;
    this.stopIdleSampler();
    for (const unsubscribe of this.unsubscribers.splice(0).reverse()) {
      unsubscribe();
    }
    this.snapshot = {
      ...this.snapshot,
      idleSamplerActive: false,
      listenerCount: 0
    };
  }

  public getSnapshot(): SystemAwarenessSnapshot {
    return copySystemAwarenessSnapshot(this.snapshot);
  }

  public refresh(): void {
    if (!this.started) return;
    const idleSeconds = this.provider.capabilities.idleAwareness
      ? safeIdleSeconds(this.provider)
      : null;
    const powerSource = this.provider.capabilities.powerSource
      ? safePowerSource(this.provider)
      : "unknown";
    const activityState = this.classifyActivity(idleSeconds);
    const nextIdleSeconds = idleSeconds ?? 0;
    const changed =
      activityState !== this.snapshot.activityState ||
      powerSource !== this.snapshot.powerSource ||
      nextIdleSeconds !== this.snapshot.idleSeconds;
    if (!changed) return;
    this.publish("refresh", "stale", "current", {
      activityState,
      powerSource,
      idleSeconds: nextIdleSeconds
    });
  }

  private supports(event: SystemAwarenessEvent): boolean {
    if (event === "lock-screen" || event === "unlock-screen") {
      return this.provider.capabilities.sessionEvents;
    }
    if (event === "suspend" || event === "resume") {
      return this.provider.capabilities.suspendResume;
    }
    if (event === "on-battery" || event === "on-ac") {
      return this.provider.capabilities.powerSource;
    }
    return this.provider.capabilities.displayEvents;
  }

  private handleEvent(event: SystemAwarenessEvent): void {
    switch (event) {
      case "lock-screen":
        this.sessionBeforeSuspend = "locked";
        this.stopIdleSampler();
        this.setSessionState("locked");
        break;
      case "unlock-screen":
        this.sessionBeforeSuspend = "active";
        this.activateSession();
        break;
      case "suspend":
        if (this.snapshot.sessionState !== "suspended") {
          this.sessionBeforeSuspend = this.snapshot.sessionState;
        }
        this.stopIdleSampler();
        this.setSessionState("suspended");
        break;
      case "resume":
        if (this.snapshot.sessionState !== "suspended") {
          this.refresh();
          if (this.snapshot.sessionState === "active") this.startIdleSampler();
          this.options.onGeometryInvalidated?.();
          break;
        }
        if (this.sessionBeforeSuspend === "locked") {
          const powerSource = this.provider.capabilities.powerSource
            ? safePowerSource(this.provider)
            : "unknown";
          this.publish("session", "suspended", "locked", {
            sessionState: "locked",
            powerSource
          });
        } else {
          this.activateSession();
        }
        this.options.onGeometryInvalidated?.();
        break;
      case "on-battery":
        this.setPowerSource("battery");
        break;
      case "on-ac":
        this.setPowerSource("ac");
        break;
      case "display-added":
      case "display-removed":
      case "display-metrics-changed":
        this.options.onGeometryInvalidated?.();
        this.publish("display", "stable", event, {});
        break;
    }
  }

  private setSessionState(sessionState: SystemSessionState): void {
    if (this.snapshot.sessionState === sessionState) return;
    this.publish("session", this.snapshot.sessionState, sessionState, {
      sessionState
    });
  }

  private activateSession(): void {
    const from = this.snapshot.sessionState;
    if (from === "active") {
      this.refresh();
      this.startIdleSampler();
      return;
    }
    const idleSeconds = this.provider.capabilities.idleAwareness
      ? safeIdleSeconds(this.provider)
      : null;
    const powerSource = this.provider.capabilities.powerSource
      ? safePowerSource(this.provider)
      : "unknown";
    this.snapshot = { ...this.snapshot, sessionState: "active" };
    this.startIdleSampler();
    this.publish("session", from, "active", {
      sessionState: "active",
      activityState: this.classifyActivity(idleSeconds),
      idleSeconds: idleSeconds ?? 0,
      powerSource
    });
  }

  private setPowerSource(powerSource: SystemPowerSource): void {
    if (this.snapshot.powerSource === powerSource) return;
    this.publish("power", this.snapshot.powerSource, powerSource, {
      powerSource
    });
  }

  private sampleIdle(emit = true): void {
    if (!this.provider.capabilities.idleAwareness) return;
    const idleSeconds = safeIdleSeconds(this.provider);
    const activityState = this.classifyActivity(idleSeconds);
    const nextIdleSeconds = idleSeconds ?? 0;
    if (!emit) {
      this.snapshot = { ...this.snapshot, activityState, idleSeconds: nextIdleSeconds };
      return;
    }
    if (activityState === this.snapshot.activityState) {
      if (nextIdleSeconds === this.snapshot.idleSeconds) return;
      this.snapshot = {
        ...this.snapshot,
        idleSeconds: nextIdleSeconds,
        updatedAt: this.scheduler.now()
      };
      this.options.onChanged?.(this.getSnapshot());
      return;
    }
    this.publish("activity", this.snapshot.activityState, activityState, {
      activityState,
      idleSeconds: nextIdleSeconds
    });
  }

  private classifyActivity(idleSeconds: number | null): SystemActivityState {
    if (idleSeconds === null) return "unknown";
    return idleSeconds >= this.idleThresholdSeconds ? "idle" : "active";
  }

  private startIdleSampler(): void {
    if (
      !this.started ||
      !this.provider.capabilities.idleAwareness ||
      this.snapshot.sessionState !== "active" ||
      this.idleSampler !== null
    ) return;
    this.idleSampler = this.scheduler.setInterval(
      () => this.sampleIdle(),
      this.idleSampleIntervalMs
    );
    this.snapshot = { ...this.snapshot, idleSamplerActive: true };
  }

  private stopIdleSampler(): void {
    if (this.idleSampler !== null) {
      this.scheduler.clearInterval(this.idleSampler);
      this.idleSampler = null;
    }
    if (this.snapshot.idleSamplerActive) {
      this.snapshot = { ...this.snapshot, idleSamplerActive: false };
    }
  }

  private publish(
    kind: SystemAwarenessTransitionKind,
    from: string,
    to: string,
    patch: Partial<Pick<SystemAwarenessSnapshot,
      "sessionState" | "activityState" | "powerSource" | "idleSeconds">>
  ): void {
    const at = this.scheduler.now();
    const lastTransition: SystemAwarenessTransition = { kind, from, to, at };
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      updatedAt: at,
      lastTransition
    };
    this.options.onChanged?.(this.getSnapshot());
  }
}
