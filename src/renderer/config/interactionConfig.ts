export const INTERACTION_CONFIG = {
  dragThresholdPx: 6,
  clickComboWindowMs: 3_000,
  annoyedThreshold: 3,
  angryThreshold: 5,
  rageThreshold: 10,
  rageDurationMs: 2_000,
  rageCooldownMs: 10_000,
  dialogueDurationMs: { min: 2_000, max: 3_000 },
  rageDialogueDurationMs: 3_000,
  dialogueCooldownMs: { min: 3_500, max: 6_000 },
  longDragDurationMs: 2_000,
  longDragDistancePx: 500,
  reactionDurationMs: {
    idle: 450,
    blink: 550,
    stare: 1_000,
    laugh: 1_000,
    annoyed: 1_100,
    angry: 1_800,
    droppedAngry: 1_500,
    droppedLaugh: 1_000,
    droppedStare: 1_200
  },
  normalReactionWeights: [
    { value: "VISUAL", weight: 50 },
    { value: "DIALOGUE", weight: 35 },
    { value: "STRONG", weight: 15 }
  ],
  visualReactionWeights: [
    { value: "BLINK", weight: 60 },
    { value: "STARING", weight: 25 },
    { value: "LAUGHING", weight: 15 }
  ],
  normalDropWeights: [
    { value: "IDLE", weight: 55 },
    { value: "ANGRY", weight: 20 },
    { value: "LAUGHING", weight: 15 },
    { value: "STARING", weight: 10 }
  ],
  longDropWeights: [
    { value: "IDLE", weight: 35 },
    { value: "ANGRY", weight: 45 },
    { value: "LAUGHING", weight: 10 },
    { value: "STARING", weight: 10 }
  ]
} as const;
