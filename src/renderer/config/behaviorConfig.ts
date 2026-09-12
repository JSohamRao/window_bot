export interface DurationRange {
  minDurationMs: number;
  maxDurationMs: number;
}

export const BEHAVIOR_CONFIG = {
  idle: {
    minDurationMs: 3_000,
    maxDurationMs: 9_000,
    minBlinkDelayMs: 2_000,
    maxBlinkDelayMs: 7_000
  },
  crawl: {
    minDurationMs: 2_000,
    maxDurationMs: 7_000,
    minSpeedPxPerSecond: 40,
    maxSpeedPxPerSecond: 90
  },
  stare: { minDurationMs: 2_000, maxDurationMs: 6_000 },
  laugh: { minDurationMs: 1_000, maxDurationMs: 3_000 },
  angry: { minDurationMs: 1_500, maxDurationMs: 4_000 },
  sleep: { minDurationMs: 8_000, maxDurationMs: 20_000 },
  movementUpdatesPerSecond: 30
} as const;
