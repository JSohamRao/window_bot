import { PERSONALITY_CONFIG } from "../config/personalityConfig";
import type { PersonalitySnapshot } from "../engine/PersonalityController";
import type { AutonomousStateName } from "../states/PetState";
import type { WeightedChoice } from "./random";

const clampWeight = (
  value: number,
  maximum: number
): number => Math.min(Math.max(value, 0.1), maximum);

export const calculateBehaviorWeights = (
  personality: PersonalitySnapshot,
  recentStates: readonly AutonomousStateName[] = []
): readonly WeightedChoice<AutonomousStateName>[] => {
  const { irritation, energy, boredom, chaos } = personality;
  const base = PERSONALITY_CONFIG.weights.base;
  const maximum = PERSONALITY_CONFIG.weights.maximum;

  const rawWeights: Record<AutonomousStateName, number> = {
    CRAWLING:
      base.CRAWLING +
      boredom * 0.25 +
      energy * 0.1 +
      (boredom > 75 ? (boredom - 75) * 0.4 : 0),
    STARING:
      base.STARING +
      irritation * 0.08 +
      chaos * 0.08 +
      (boredom > 75 ? (boredom - 75) * 0.12 : 0),
    LAUGHING:
      base.LAUGHING +
      chaos * 0.12 +
      boredom * 0.08 +
      (boredom > 75 ? (boredom - 75) * 0.16 : 0),
    SLEEPING:
      base.SLEEPING +
      (100 - energy) * 0.45 +
      (energy < 20 ? 20 : 0) +
      (energy < 10 ? 30 : 0),
    ANGRY:
      base.ANGRY + irritation * 0.25 + (irritation > 80 ? 8 : 0),
    JUMPING:
      base.JUMPING + energy * 0.035 + boredom * 0.025 + chaos * 0.012,
    HOPPING:
      base.HOPPING + energy * 0.045 + boredom * 0.04 + chaos * 0.015,
    CLIMBING:
      base.CLIMBING + energy * 0.012 + boredom * 0.01 + chaos * 0.008,
    PERCHED:
      base.PERCHED + boredom * 0.006 + chaos * 0.004,
    IDLE: base.IDLE + (100 - energy) * 0.12
  };

  const order: readonly AutonomousStateName[] = [
    "CRAWLING",
    "STARING",
    "LAUGHING",
    "SLEEPING",
    "ANGRY",
    "HOPPING",
    "JUMPING",
    "CLIMBING",
    "PERCHED",
    "IDLE"
  ];

  return order.map((state) => {
    const recentIndex = recentStates.indexOf(state);
    const repeatMultiplier =
      recentIndex >= 0
        ? (PERSONALITY_CONFIG.weights.recentStateMultipliers[recentIndex] ?? 1)
        : 1;
    return {
      value: state,
      weight: clampWeight(rawWeights[state] * repeatMultiplier, maximum[state])
    };
  });
};
