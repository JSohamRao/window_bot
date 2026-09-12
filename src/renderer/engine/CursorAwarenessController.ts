import { CURSOR_CONFIG } from "../config/cursorConfig";
import type { SpriteDirection } from "./AnimationController";
import type { PersonalitySnapshot } from "./PersonalityController";
import {
  mathRandomSource,
  randomBetween,
  type RandomSource
} from "../utils/random";

export type CursorTrackingMode = "OFF" | "IDLE" | "WATCH" | "CHASE";

export interface CursorPositionSample {
  x: number;
  y: number;
  sameDisplay: boolean;
}

export interface PetScreenGeometry {
  windowX: number;
  windowY: number;
}

export interface CursorPositionProvider {
  getCursorPosition(): Promise<CursorPositionSample>;
}

export interface CursorQueryCounts {
  readonly IDLE: number;
  readonly WATCH: number;
  readonly CHASE: number;
}

export interface CursorAwarenessSnapshot {
  readonly mode: CursorTrackingMode;
  readonly cursorX: number | null;
  readonly cursorY: number | null;
  readonly distancePx: number | null;
  readonly horizontalDeltaPx: number | null;
  readonly verticalDeltaPx?: number | null;
  readonly cursorDirection: SpriteDirection | null;
  readonly suggestedDirection: SpriteDirection | null;
  readonly sameDisplay: boolean;
  readonly isNearby: boolean;
  readonly isWithinChaseRadius: boolean;
  readonly isInsideDeadZone: boolean;
  readonly hasSample: boolean;
  readonly sampleSequence: number;
  readonly sampleRateHz: number;
  readonly queryInFlight: boolean;
  readonly queryCounts: CursorQueryCounts;
  readonly failed: boolean;
}

type CursorChangeListener = () => void;
type CursorFailureListener = () => void;

const isCursorPositionSample = (
  value: unknown
): value is CursorPositionSample => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const sample = value as Partial<CursorPositionSample>;
  return (
    typeof sample.x === "number" &&
    Number.isFinite(sample.x) &&
    typeof sample.y === "number" &&
    Number.isFinite(sample.y) &&
    typeof sample.sameDisplay === "boolean"
  );
};

const clampProbability = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

export const calculateCursorNoticeChance = (
  personality: PersonalitySnapshot,
  chanceBoost = 0
): number =>
  clampProbability(
    CURSOR_CONFIG.noticeChanceBase +
      personality.boredom * 0.0015 +
      personality.chaos * 0.0005 -
      Math.max(30 - personality.energy, 0) * 0.0015 +
      (Number.isFinite(chanceBoost) ? chanceBoost : 0),
    CURSOR_CONFIG.minimumNoticeChance,
    CURSOR_CONFIG.maximumNoticeChance
  );

export const calculateMouseChaseChance = (
  personality: PersonalitySnapshot,
  chanceBoost = 0
): number =>
  clampProbability(
    0.35 +
      personality.boredom * 0.003 +
      (personality.energy - 50) * 0.003 +
      personality.chaos * 0.001 -
      personality.irritation * 0.0015 +
      (Number.isFinite(chanceBoost) ? chanceBoost : 0),
    CURSOR_CONFIG.minimumChaseChance,
    CURSOR_CONFIG.maximumChaseChance
  );

export const calculateMouseChaseSpeed = (
  personality: PersonalitySnapshot,
  speedMultiplier = 1
): number =>
  Math.min(
    (CURSOR_CONFIG.minChaseSpeedPxPerSecond +
      personality.energy * 0.25 +
      personality.boredom * 0.15) *
      (Number.isFinite(speedMultiplier) ? clampProbability(speedMultiplier, 1, 1.1) : 1),
    CURSOR_CONFIG.maxChaseSpeedPxPerSecond * 1.1
  );

export class CursorAwarenessController {
  private mode: CursorTrackingMode = "OFF";
  private elapsedSinceQueryMs = 0;
  private currentIntervalMs = 0;
  private queryInFlight = false;
  private generation = 0;
  private cursorX: number | null = null;
  private cursorY: number | null = null;
  private distancePx: number | null = null;
  private horizontalDeltaPx: number | null = null;
  private verticalDeltaPx: number | null = null;
  private cursorDirection: SpriteDirection | null = null;
  private suggestedDirection: SpriteDirection | null = null;
  private sameDisplay = false;
  private isNearby = false;
  private isWithinChaseRadius = false;
  private isInsideDeadZone = false;
  private sampleSequence = 0;
  private failed = false;
  private intervalMultiplier = 1;
  private readonly queryCounts = { IDLE: 0, WATCH: 0, CHASE: 0 };

  public constructor(
    private readonly provider: CursorPositionProvider,
    private readonly getPetGeometry: () => PetScreenGeometry,
    private readonly random: RandomSource = mathRandomSource,
    private readonly onChange?: CursorChangeListener,
    private readonly onFailure?: CursorFailureListener
  ) {}

  public enableIdleAwareness(): void {
    this.setMode(
      "IDLE",
      randomBetween(
        this.random,
        CURSOR_CONFIG.idleSampleMinMs,
        CURSOR_CONFIG.idleSampleMaxMs
      ),
      false
    );
  }

  public enableWatching(): void {
    this.setMode("WATCH", CURSOR_CONFIG.watchSampleIntervalMs, true);
  }

  public enableChasing(): void {
    this.setMode("CHASE", CURSOR_CONFIG.chaseSampleIntervalMs, true);
  }

  public setIntervalMultiplier(value: number): void {
    const next = Number.isFinite(value) ? Math.min(Math.max(value, 1), 4) : 1;
    if (next === this.intervalMultiplier) return;
    const ratio = next / this.intervalMultiplier;
    this.intervalMultiplier = next;
    if (this.mode !== "OFF") {
      this.currentIntervalMs *= ratio;
      this.elapsedSinceQueryMs = Math.min(this.elapsedSinceQueryMs, this.currentIntervalMs);
    }
    this.onChange?.();
  }

  public disable(): void {
    if (this.mode === "OFF" && !this.queryInFlight) {
      return;
    }
    this.generation += 1;
    this.mode = "OFF";
    this.elapsedSinceQueryMs = 0;
    this.currentIntervalMs = 0;
    this.queryInFlight = false;
    this.suggestedDirection = null;
    this.onChange?.();
  }

  public update(deltaTimeMs: number): void {
    if (this.mode === "OFF" || !Number.isFinite(deltaTimeMs) || deltaTimeMs <= 0) {
      return;
    }
    this.elapsedSinceQueryMs += deltaTimeMs;
    if (
      this.queryInFlight ||
      this.elapsedSinceQueryMs < this.currentIntervalMs
    ) {
      return;
    }
    this.elapsedSinceQueryMs = 0;
    this.requestSample();
  }

  public getSnapshot(): CursorAwarenessSnapshot {
    return {
      mode: this.mode,
      cursorX: this.cursorX,
      cursorY: this.cursorY,
      distancePx: this.distancePx,
      horizontalDeltaPx: this.horizontalDeltaPx,
      verticalDeltaPx: this.verticalDeltaPx,
      cursorDirection: this.cursorDirection,
      suggestedDirection: this.suggestedDirection,
      sameDisplay: this.sameDisplay,
      isNearby: this.isNearby,
      isWithinChaseRadius: this.isWithinChaseRadius,
      isInsideDeadZone: this.isInsideDeadZone,
      hasSample: this.sampleSequence > 0,
      sampleSequence: this.sampleSequence,
      sampleRateHz:
        this.mode === "OFF" || this.currentIntervalMs <= 0
          ? 0
          : 1000 / this.currentIntervalMs,
      queryInFlight: this.queryInFlight,
      queryCounts: { ...this.queryCounts },
      failed: this.failed
    };
  }

  private setMode(
    mode: Exclude<CursorTrackingMode, "OFF">,
    intervalMs: number,
    sampleImmediately: boolean
  ): void {
    this.generation += 1;
    this.mode = mode;
    this.currentIntervalMs = intervalMs * this.intervalMultiplier;
    this.elapsedSinceQueryMs = sampleImmediately ? this.currentIntervalMs : 0;
    this.queryInFlight = false;
    this.suggestedDirection = null;
    this.failed = false;
    this.onChange?.();
  }

  private requestSample(): void {
    const requestMode = this.mode;
    if (requestMode === "OFF") {
      return;
    }
    const requestGeneration = this.generation;
    this.queryInFlight = true;
    this.queryCounts[requestMode] += 1;
    void this.provider
      .getCursorPosition()
      .then((sample) => {
        if (requestGeneration !== this.generation || this.mode === "OFF") {
          return;
        }
        if (!isCursorPositionSample(sample)) {
          throw new Error("Cursor provider returned invalid coordinates.");
        }
        this.applySample(sample);
        if (this.mode === "IDLE") {
          this.currentIntervalMs = randomBetween(
            this.random,
            CURSOR_CONFIG.idleSampleMinMs,
            CURSOR_CONFIG.idleSampleMaxMs
          ) * this.intervalMultiplier;
        }
      })
      .catch((error: unknown) => {
        if (requestGeneration !== this.generation) {
          return;
        }
        console.warn("[THUKUNA] Cursor position request failed; tracking disabled.", error);
        this.failed = true;
        this.mode = "OFF";
        this.currentIntervalMs = 0;
        this.elapsedSinceQueryMs = 0;
        this.suggestedDirection = null;
        this.onFailure?.();
      })
      .finally(() => {
        if (requestGeneration === this.generation) {
          this.queryInFlight = false;
          this.onChange?.();
        }
      });
  }

  private applySample(sample: CursorPositionSample): void {
    const geometry = this.getPetGeometry();
    const petCenterX = geometry.windowX + CURSOR_CONFIG.petStageWidthPx / 2;
    const petCenterY =
      geometry.windowY +
      CURSOR_CONFIG.bubbleZoneHeightPx +
      CURSOR_CONFIG.petStageHeightPx / 2;
    const horizontalDeltaPx = sample.x - petCenterX;
    const verticalDeltaPx = sample.y - petCenterY;
    const distancePx = Math.hypot(horizontalDeltaPx, verticalDeltaPx);
    const cursorDirection: SpriteDirection =
      horizontalDeltaPx < 0 ? "left" : "right";
    const absoluteHorizontalDelta = Math.abs(horizontalDeltaPx);

    this.cursorX = sample.x;
    this.cursorY = sample.y;
    this.distancePx = distancePx;
    this.horizontalDeltaPx = horizontalDeltaPx;
    this.verticalDeltaPx = verticalDeltaPx;
    this.cursorDirection = cursorDirection;
    this.sameDisplay = sample.sameDisplay;
    this.isNearby = sample.sameDisplay && distancePx <= CURSOR_CONFIG.noticeRadiusPx;
    this.isWithinChaseRadius =
      sample.sameDisplay && distancePx <= CURSOR_CONFIG.chaseTriggerRadiusPx;
    this.isInsideDeadZone =
      sample.sameDisplay && absoluteHorizontalDelta <= CURSOR_CONFIG.chaseDeadZonePx;

    if (!sample.sameDisplay || this.isInsideDeadZone) {
      this.suggestedDirection = null;
    } else if (this.suggestedDirection === null) {
      this.suggestedDirection = cursorDirection;
    } else if (
      cursorDirection !== this.suggestedDirection &&
      absoluteHorizontalDelta >= CURSOR_CONFIG.directionHysteresisPx
    ) {
      this.suggestedDirection = cursorDirection;
    }
    this.sampleSequence += 1;
    this.failed = false;
  }
}
