export const LOCOMOTION_CONFIG = {
  gravityPxPerSecondSquared: 920,
  jumpVelocityY: { min: -540, max: -470 },
  jumpHorizontalVelocity: { min: 105, max: 140 },
  jump: {
    prepareMs: 210,
    velocityY: -510,
    horizontalSpeedPxPerSecond: 125,
    maxAirTimeMs: 1_650,
    landMs: 200
  },
  hop: {
    prepareMs: 160,
    velocityY: -300,
    horizontalSpeedPxPerSecond: 78,
    maxAirTimeMs: 1_000,
    landMs: 160
  },
  fallingStartVelocityY: 35,
  landingTolerancePx: 2,
  climbSpeedPxPerSecond: 72,
  climbMaxDurationMs: 2_800,
  edgeAttachTolerancePx: 10,
  perchDurationMs: 3_500,
  recentMovementLimit: 3,
  cooldownMs: {
    JUMP: 8_000,
    HOP: 4_000,
    CLIMB: 15_000,
    PERCH: 12_000
  }
} as const;
