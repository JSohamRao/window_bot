import {
  PRODUCTIVITY_TIMER_PRESETS,
  copyProductivityTimerSnapshot,
  createIdleProductivityTimerSnapshot,
  isProductivityTimerSnapshot,
  requestForProductivityTimerPreset,
  type ProductivityTimerCommandResult,
  type ProductivityTimerPresetId,
  type ProductivityTimerSnapshot,
  type ProductivityTimerStartRequest
} from "../../shared/productivityTimer";
import type { SystemSessionState } from "../../shared/systemAwareness";

export interface ProductivityTimerBridge {
  getProductivityTimer(): Promise<ProductivityTimerSnapshot>;
  startProductivityTimer(
    request: ProductivityTimerStartRequest
  ): Promise<ProductivityTimerCommandResult>;
  pauseProductivityTimer(): Promise<ProductivityTimerCommandResult>;
  resumeProductivityTimer(): Promise<ProductivityTimerCommandResult>;
  cancelProductivityTimer(): Promise<ProductivityTimerCommandResult>;
  acknowledgeProductivityTimerCompletion(
    completionId: string
  ): Promise<ProductivityTimerCommandResult>;
  onProductivityTimerChanged(
    listener: (snapshot: ProductivityTimerSnapshot) => void
  ): () => void;
}

export type ProductivityTimerCompletionHandler = (
  snapshot: ProductivityTimerSnapshot
) => boolean;

export class ProductivityTimerController {
  private snapshot = createIdleProductivityTimerSnapshot();
  private unsubscribe: (() => void) | null = null;
  private started = false;
  private generation = 0;
  private sessionState: SystemSessionState = "active";
  private readonly deliveredCompletionIds = new Set<string>();
  private acknowledgementInFlight: string | null = null;

  public constructor(
    private readonly bridge: ProductivityTimerBridge,
    private readonly onChanged?: (snapshot: ProductivityTimerSnapshot) => void,
    private readonly onCompletion?: ProductivityTimerCompletionHandler
  ) {}

  public async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    const generation = ++this.generation;
    this.unsubscribe = this.bridge.onProductivityTimerChanged((snapshot) => {
      this.apply(snapshot);
    });
    const snapshot = await this.bridge.getProductivityTimer();
    if (this.started && generation === this.generation) this.apply(snapshot);
  }

  public dispose(): void {
    if (!this.started && this.unsubscribe === null) return;
    this.started = false;
    this.generation += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  public getSnapshot(): ProductivityTimerSnapshot {
    return copyProductivityTimerSnapshot(this.snapshot);
  }

  public setSystemSessionState(state: SystemSessionState): void {
    this.sessionState = state;
    this.trySurfaceCompletion();
  }

  public notifyReactionOpportunity(): void {
    this.trySurfaceCompletion();
  }

  public startPreset(
    presetId: ProductivityTimerPresetId
  ): Promise<ProductivityTimerCommandResult> {
    if (!(presetId in PRODUCTIVITY_TIMER_PRESETS)) {
      return Promise.reject(new TypeError("Unknown productivity-timer preset."));
    }
    return this.startRequest(requestForProductivityTimerPreset(presetId));
  }

  public async startRequest(
    request: ProductivityTimerStartRequest
  ): Promise<ProductivityTimerCommandResult> {
    return this.applyResult(await this.bridge.startProductivityTimer(request));
  }

  public async pause(): Promise<ProductivityTimerCommandResult> {
    return this.applyResult(await this.bridge.pauseProductivityTimer());
  }

  public async resume(): Promise<ProductivityTimerCommandResult> {
    return this.applyResult(await this.bridge.resumeProductivityTimer());
  }

  public async cancel(): Promise<ProductivityTimerCommandResult> {
    return this.applyResult(await this.bridge.cancelProductivityTimer());
  }

  private applyResult(result: ProductivityTimerCommandResult): ProductivityTimerCommandResult {
    this.apply(result.snapshot);
    return result;
  }

  private apply(value: ProductivityTimerSnapshot): void {
    if (!isProductivityTimerSnapshot(value)) return;
    if (value.updatedAt < this.snapshot.updatedAt) return;
    this.snapshot = copyProductivityTimerSnapshot(value);
    this.onChanged?.(this.getSnapshot());
    this.trySurfaceCompletion();
  }

  private trySurfaceCompletion(): void {
    const completionId = this.snapshot.completionId;
    if (
      !this.started ||
      this.sessionState !== "active" ||
      this.snapshot.state !== "completed" ||
      !this.snapshot.completionPending ||
      completionId === null ||
      this.deliveredCompletionIds.has(completionId) ||
      this.acknowledgementInFlight === completionId
    ) return;

    this.acknowledgementInFlight = completionId;
    if (this.onCompletion?.(this.getSnapshot()) !== true) {
      this.acknowledgementInFlight = null;
      return;
    }
    this.deliveredCompletionIds.add(completionId);
    void this.bridge.acknowledgeProductivityTimerCompletion(completionId)
      .then((result) => this.applyResult(result))
      .catch((error: unknown) => {
        this.deliveredCompletionIds.delete(completionId);
        console.warn("[THUKUNA] Timer completion acknowledgement failed.", error);
      })
      .finally(() => {
        if (this.acknowledgementInFlight === completionId) {
          this.acknowledgementInFlight = null;
        }
      });
  }
}
