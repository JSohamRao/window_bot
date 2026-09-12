import {
  SYSTEM_AWARENESS_HISTORY_LIMIT,
  copySystemAwarenessSnapshot,
  createUnknownSystemAwarenessSnapshot,
  isSystemAwarenessSnapshot,
  type SystemAwarenessSnapshot,
  type SystemAwarenessTransition
} from "../../shared/systemAwareness";

export type SystemSafetyBlockReason =
  | "SYSTEM_LOCKED"
  | "SYSTEM_SUSPENDED";

export interface SystemRuntimeContext {
  readonly hardPaused: boolean;
  readonly blockReason: SystemSafetyBlockReason | null;
  readonly cursorIntervalMultiplier: number;
  readonly effectivePolicyLabel: string;
}

export interface SystemAwarenessBridge {
  getSystemAwareness(): Promise<SystemAwarenessSnapshot>;
  onSystemAwarenessChanged(
    listener: (snapshot: SystemAwarenessSnapshot) => void
  ): () => void;
}

export interface SystemAwarenessControllerSnapshot {
  readonly awareness: SystemAwarenessSnapshot;
  readonly runtime: SystemRuntimeContext;
  readonly transitionHistory: readonly SystemAwarenessTransition[];
}

type SystemAwarenessListener = (
  snapshot: SystemAwarenessControllerSnapshot
) => void;

export const resolveSystemRuntimeContext = (
  snapshot: SystemAwarenessSnapshot
): SystemRuntimeContext => {
  const blockReason = snapshot.sessionState === "suspended"
    ? "SYSTEM_SUSPENDED"
    : snapshot.sessionState === "locked"
      ? "SYSTEM_LOCKED"
      : null;
  const modifiers: string[] = [];
  if (snapshot.activityState === "idle") modifiers.push("IDLE");
  if (snapshot.powerSource === "battery") modifiers.push("BATTERY");
  return {
    hardPaused: blockReason !== null,
    blockReason,
    cursorIntervalMultiplier:
      (snapshot.activityState === "idle" ? 2.5 : 1) *
      (snapshot.powerSource === "battery" ? 1.5 : 1),
    effectivePolicyLabel:
      blockReason ?? (modifiers.length === 0 ? "SYSTEM_NORMAL" : modifiers.join("+"))
  };
};

export class SystemAwarenessController {
  private awareness = createUnknownSystemAwarenessSnapshot();
  private runtime = resolveSystemRuntimeContext(this.awareness);
  private readonly transitionHistory: SystemAwarenessTransition[] = [];
  private unsubscribe: (() => void) | null = null;
  private started = false;
  private generation = 0;

  public constructor(
    private readonly bridge: SystemAwarenessBridge,
    private readonly onChanged?: SystemAwarenessListener
  ) {}

  public async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const generation = ++this.generation;
    this.unsubscribe = this.bridge.onSystemAwarenessChanged((snapshot) => {
      this.apply(snapshot);
    });
    const snapshot = await this.bridge.getSystemAwareness();
    if (this.started && generation === this.generation) this.apply(snapshot);
  }

  public dispose(): void {
    if (!this.started && this.unsubscribe === null) return;
    this.started = false;
    this.generation += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  public getSnapshot(): SystemAwarenessControllerSnapshot {
    return {
      awareness: copySystemAwarenessSnapshot(this.awareness),
      runtime: { ...this.runtime },
      transitionHistory: this.transitionHistory.map((entry) => ({ ...entry }))
    };
  }

  private apply(value: SystemAwarenessSnapshot): void {
    if (!isSystemAwarenessSnapshot(value)) return;
    if (value.updatedAt < this.awareness.updatedAt) return;
    const transition = value.lastTransition;
    const previousTransition = this.transitionHistory.at(-1);
    if (
      transition !== null &&
      (previousTransition === undefined ||
        previousTransition.at !== transition.at ||
        previousTransition.kind !== transition.kind ||
        previousTransition.from !== transition.from ||
        previousTransition.to !== transition.to)
    ) {
      this.transitionHistory.push({ ...transition });
      if (this.transitionHistory.length > SYSTEM_AWARENESS_HISTORY_LIMIT) {
        this.transitionHistory.splice(
          0,
          this.transitionHistory.length - SYSTEM_AWARENESS_HISTORY_LIMIT
        );
      }
    }
    this.awareness = copySystemAwarenessSnapshot(value);
    this.runtime = resolveSystemRuntimeContext(this.awareness);
    this.onChanged?.(this.getSnapshot());
  }
}
