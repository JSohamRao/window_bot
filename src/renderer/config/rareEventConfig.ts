export type RareEventName =
  | "SPRINT"
  | "FALL_OVER"
  | "CREEPY_FREEZE"
  | "ZOOM_STARE"
  | "CHAOS_RUN"
  | "DOMAIN_EXPANSION";

export interface DurationRange {
  readonly minMs: number;
  readonly maxMs: number;
}

export interface SpeedRange {
  readonly minPxPerSecond: number;
  readonly maxPxPerSecond: number;
}

export const RARE_EVENT_NAMES: readonly RareEventName[] = [
  "SPRINT",
  "FALL_OVER",
  "CREEPY_FREEZE",
  "ZOOM_STARE",
  "CHAOS_RUN",
  "DOMAIN_EXPANSION"
];

export const RARE_EVENT_CONFIG = {
  checkInterval: {
    lowChaos: { minMs: 75_000, maxMs: 150_000 },
    highChaos: { minMs: 45_000, maxMs: 90_000 },
    deferredUntilIdleMs: 5_000
  },
  occurrenceChance: {
    base: 0.22,
    chaosInfluence: 0.004,
    minimum: 0.15,
    maximum: 0.62
  },
  globalCooldown: { minMs: 75_000, maxMs: 120_000 },
  eventCooldownMs: {
    SPRINT: 75_000,
    FALL_OVER: 120_000,
    CREEPY_FREEZE: 135_000,
    ZOOM_STARE: 180_000,
    CHAOS_RUN: 180_000,
    DOMAIN_EXPANSION: 420_000
  } satisfies Record<RareEventName, number>,
  baseWeights: {
    SPRINT: 25,
    FALL_OVER: 20,
    CREEPY_FREEZE: 20,
    ZOOM_STARE: 15,
    CHAOS_RUN: 12,
    DOMAIN_EXPANSION: 3
  } satisfies Record<RareEventName, number>,
  duration: {
    SPRINT: { minMs: 800, maxMs: 1_800 },
    FALL_OVER: { minMs: 2_500, maxMs: 4_500 },
    CREEPY_FREEZE: { minMs: 4_000, maxMs: 8_000 },
    ZOOM_STARE: { minMs: 2_200, maxMs: 3_800 },
    CHAOS_RUN: { minMs: 1_500, maxMs: 3_000 },
    DOMAIN_EXPANSION: { minMs: 3_400, maxMs: 3_400 }
  } satisfies Record<RareEventName, DurationRange>,
  speed: {
    sprint: { minPxPerSecond: 180, maxPxPerSecond: 280 },
    chaosRun: { minPxPerSecond: 120, maxPxPerSecond: 220 }
  } satisfies Record<"sprint" | "chaosRun", SpeedRange>,
  chaosDirectionChange: { minMs: 350, maxMs: 700 },
  maximumEventScale: 1.25,
  fallRotationDeg: 90,
  dialogueChance: {
    SPRINT: 0.24,
    FALL_OVER: 0.35,
    CREEPY_FREEZE: 0.28,
    ZOOM_STARE: 0.24,
    CHAOS_RUN: 0.3,
    DOMAIN_EXPANSION: 1
  } satisfies Record<RareEventName, number>
} as const;
