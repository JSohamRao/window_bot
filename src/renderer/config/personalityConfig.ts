import type { PetStateName } from "../states/PetState";
import type { RareEventName } from "./rareEventConfig";

export interface PersonalityValues {
  irritation: number;
  energy: number;
  boredom: number;
  chaos: number;
}

export const PERSONALITY_DEFAULTS: Readonly<PersonalityValues> = {
  irritation: 15,
  energy: 75,
  boredom: 20,
  chaos: 30
};

export const PERSONALITY_CONFIG = {
  minimumValue: 0,
  maximumValue: 100,
  updateIntervalMs: 250,
  recentStateLimit: 3,
  passiveRatesPerMinute: {
    IDLE: { irritation: -0.6, energy: -0.7, boredom: 2, chaos: 0 },
    CRAWLING: { irritation: -0.7, energy: -2, boredom: -5, chaos: 0 },
    STARING: { irritation: -0.5, energy: -0.6, boredom: 0.2, chaos: 0.02 },
    SLEEPING: { irritation: -0.8, energy: 6, boredom: 0.1, chaos: -0.05 },
    LAUGHING: { irritation: -0.7, energy: -1.5, boredom: -6, chaos: 0.15 },
    ANGRY: { irritation: -0.3, energy: -1.2, boredom: -2, chaos: 0.05 },
    RAGE: { irritation: 0, energy: -2.5, boredom: -4, chaos: 0.1 },
    DRAGGED: { irritation: 0, energy: -0.2, boredom: 0, chaos: 0 },
    WATCHING_CURSOR: {
      irritation: -0.5,
      energy: -0.6,
      boredom: -1,
      chaos: 0.02
    },
    CHASE_MOUSE: {
      irritation: -0.5,
      energy: -3,
      boredom: -7,
      chaos: 0.12
    },
    JUMPING: { irritation: -0.4, energy: -4, boredom: -7, chaos: 0.08 },
    HOPPING: { irritation: -0.4, energy: -2.2, boredom: -4, chaos: 0.04 },
    FALLING: { irritation: 0.05, energy: -0.5, boredom: -1, chaos: 0.06 },
    LANDING: { irritation: -0.1, energy: -0.2, boredom: -0.4, chaos: 0.02 },
    CLIMBING: { irritation: -0.3, energy: -3.5, boredom: -6, chaos: 0.08 },
    PERCHED: { irritation: -0.5, energy: -0.4, boredom: -1, chaos: 0.01 },
    SPRINT: { irritation: -0.4, energy: -5, boredom: -9, chaos: 0.15 },
    FALL_OVER: { irritation: -0.2, energy: -0.4, boredom: -1, chaos: 0.1 },
    CREEPY_FREEZE: { irritation: 0.1, energy: -0.1, boredom: -0.5, chaos: 0.12 },
    ZOOM_STARE: { irritation: -0.1, energy: -0.4, boredom: -1, chaos: 0.12 },
    CHAOS_RUN: { irritation: -0.5, energy: -6, boredom: -11, chaos: 0.3 },
    DOMAIN_EXPANSION: { irritation: -0.3, energy: -1, boredom: -2, chaos: -0.2 }
  } satisfies Record<PetStateName, PersonalityValues>,
  rareEventEffects: {
    SPRINT: { energy: -0.4, boredom: -0.8 },
    FALL_OVER: { chaos: 0.2 },
    CREEPY_FREEZE: { irritation: 0.1, chaos: 0.2 },
    ZOOM_STARE: { chaos: 0.3 },
    CHAOS_RUN: { energy: -0.7, boredom: -1.2, chaos: 0.4 },
    DOMAIN_EXPANSION: { irritation: -2, chaos: -0.5 }
  } satisfies Record<RareEventName, Partial<PersonalityValues>>,
  interactionEffects: {
    click: { irritation: 2, boredom: -1.5 },
    annoyedCombo: { irritation: 5 },
    angryCombo: { irritation: 10 },
    rage: { irritation: 20, boredom: -3 },
    normalDrag: { irritation: 5, boredom: -4 },
    longDrag: { irritation: 11, boredom: -5 },
    cursorWatch: { boredom: -0.5 },
    mouseChase: { boredom: -1, chaos: 0.2 }
  },
  stateExitEffects: {
    angryIrritationRelief: -0.25,
    rageIrritationRelief: -8
  },
  weights: {
    base: {
      CRAWLING: 40,
      STARING: 12,
      LAUGHING: 8,
      SLEEPING: 5,
      ANGRY: 3,
      JUMPING: 1.4,
      HOPPING: 3,
      CLIMBING: 0.35,
      PERCHED: 0.3,
      IDLE: 15
    },
    maximum: {
      CRAWLING: 85,
      STARING: 40,
      LAUGHING: 40,
      SLEEPING: 110,
      ANGRY: 45,
      JUMPING: 18,
      HOPPING: 30,
      CLIMBING: 8,
      PERCHED: 8,
      IDLE: 40
    },
    recentStateMultipliers: [0.18, 0.45, 0.72]
  }
} as const;
