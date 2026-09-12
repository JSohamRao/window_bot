import {
  RARE_EVENT_CONFIG,
  type RareEventName
} from "../config/rareEventConfig";

export interface EventVisualSnapshot {
  readonly activeEvent: RareEventName | null;
  readonly durationMs: number;
  readonly phase: string;
  readonly activationCount: number;
  readonly cleanupCount: number;
}

export interface EventVisualPort {
  activate(event: RareEventName, durationMs: number): void;
  setPhase?(phase: string): void;
  reset(): void;
  getSnapshot(): EventVisualSnapshot;
}

export class EventVisualController implements EventVisualPort {
  private activeEvent: RareEventName | null = null;
  private durationMs = 0;
  private phase = "NONE";
  private activationCount = 0;
  private cleanupCount = 0;

  public constructor(private readonly layer: HTMLElement) {
    this.reset();
    this.layer.style.setProperty(
      "--rare-event-max-scale",
      String(RARE_EVENT_CONFIG.maximumEventScale)
    );
    this.layer.style.setProperty(
      "--rare-event-fall-rotation",
      `${RARE_EVENT_CONFIG.fallRotationDeg}deg`
    );
  }

  public activate(event: RareEventName, durationMs: number): void {
    this.reset();
    // Force a style boundary so the same fixed CSS animation can restart after
    // repeated debug events without ever reading or multiplying a transform.
    void this.layer.offsetWidth;
    this.activeEvent = event;
    this.durationMs = Math.max(Number.isFinite(durationMs) ? durationMs : 0, 0);
    this.phase = "ACTIVE";
    this.activationCount += 1;
    this.layer.style.setProperty("--rare-event-duration", `${this.durationMs}ms`);
    this.layer.dataset.rareEvent = event;
    this.layer.dataset.eventPhase = "ACTIVE";
  }

  public setPhase(phase: string): void {
    this.phase = phase;
    this.layer.dataset.eventPhase = phase;
  }

  public reset(): void {
    if (this.activeEvent !== null) this.cleanupCount += 1;
    this.activeEvent = null;
    this.durationMs = 0;
    this.phase = "NONE";
    this.layer.dataset.rareEvent = "NONE";
    this.layer.dataset.eventPhase = "NONE";
    this.layer.style.removeProperty("--rare-event-duration");
  }

  public getSnapshot(): EventVisualSnapshot {
    return {
      activeEvent: this.activeEvent,
      durationMs: this.durationMs,
      phase: this.phase,
      activationCount: this.activationCount,
      cleanupCount: this.cleanupCount
    };
  }
}
