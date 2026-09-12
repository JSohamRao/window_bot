import type { ThukunaSettings } from "../../shared/settings";
import type { AutonomousStateName } from "../states/PetState";
import type { WeightedChoice } from "../utils/random";

export type PowerMode = "NORMAL" | "CHAOS" | "LOW_POWER";

export interface PowerPolicySnapshot {
  readonly mode: PowerMode;
  readonly mouseAwarenessAllowed: boolean;
  readonly rareEventsAllowed: boolean;
  readonly autonomousMovementMultiplier: number;
  readonly idleDurationMultiplier: number;
  readonly personalityUpdateIntervalMs: number;
  readonly rareEventIntervalMultiplier: number;
  readonly rareEventOccurrenceBoost: number;
  readonly cursorNoticeChanceBoost: number;
  readonly chaseChanceBoost: number;
  readonly chaseSpeedMultiplier: number;
}

const POLICIES: Readonly<Record<PowerMode, Omit<PowerPolicySnapshot, "mode" | "mouseAwarenessAllowed" | "rareEventsAllowed">>> = {
  NORMAL: {
    autonomousMovementMultiplier: 1,
    idleDurationMultiplier: 1,
    personalityUpdateIntervalMs: 250,
    rareEventIntervalMultiplier: 1,
    rareEventOccurrenceBoost: 0,
    cursorNoticeChanceBoost: 0,
    chaseChanceBoost: 0,
    chaseSpeedMultiplier: 1
  },
  CHAOS: {
    autonomousMovementMultiplier: 1.15,
    idleDurationMultiplier: 0.75,
    personalityUpdateIntervalMs: 250,
    rareEventIntervalMultiplier: 0.7,
    rareEventOccurrenceBoost: 0.12,
    cursorNoticeChanceBoost: 0.08,
    chaseChanceBoost: 0.08,
    chaseSpeedMultiplier: 1.1
  },
  LOW_POWER: {
    autonomousMovementMultiplier: 0.25,
    idleDurationMultiplier: 1.5,
    personalityUpdateIntervalMs: 1_000,
    rareEventIntervalMultiplier: 1,
    rareEventOccurrenceBoost: 0,
    cursorNoticeChanceBoost: 0,
    chaseChanceBoost: 0,
    chaseSpeedMultiplier: 1
  }
};

export const DEFAULT_POWER_POLICY_SNAPSHOT: PowerPolicySnapshot = {
  mode: "NORMAL",
  ...POLICIES.NORMAL,
  mouseAwarenessAllowed: true,
  rareEventsAllowed: true
};

export const resolvePowerMode = (settings: ThukunaSettings): PowerMode =>
  settings.lowPowerMode ? "LOW_POWER" : settings.chaosMode ? "CHAOS" : "NORMAL";

export class PowerPolicyController {
  private settings: ThukunaSettings;

  public constructor(settings: ThukunaSettings) {
    this.settings = { ...settings };
  }

  public update(settings: ThukunaSettings): void {
    this.settings = { ...settings };
  }

  public getSnapshot(): PowerPolicySnapshot {
    const mode = resolvePowerMode(this.settings);
    const policy = POLICIES[mode];
    return {
      mode,
      ...policy,
      mouseAwarenessAllowed:
        mode !== "LOW_POWER" && this.settings.mouseAwarenessEnabled,
      rareEventsAllowed: mode !== "LOW_POWER" && this.settings.rareEventsEnabled
    };
  }

  public applyBehaviorWeights(
    choices: readonly WeightedChoice<AutonomousStateName>[]
  ): readonly WeightedChoice<AutonomousStateName>[] {
    const mode = this.getSnapshot().mode;
    const multipliers: Record<PowerMode, Record<AutonomousStateName, number>> = {
      NORMAL: { CRAWLING: 1, STARING: 1, LAUGHING: 1, SLEEPING: 1, ANGRY: 1, JUMPING: 1, HOPPING: 1, CLIMBING: 1, PERCHED: 1, IDLE: 1 },
      CHAOS: { CRAWLING: 1.35, STARING: 1.1, LAUGHING: 1.4, SLEEPING: 0.75, ANGRY: 1, JUMPING: 1.45, HOPPING: 1.55, CLIMBING: 1.35, PERCHED: 1.15, IDLE: 0.8 },
      LOW_POWER: { CRAWLING: 0.02, STARING: 0.45, LAUGHING: 0.2, SLEEPING: 2.5, ANGRY: 0.45, JUMPING: 0, HOPPING: 0, CLIMBING: 0, PERCHED: 0, IDLE: 2.5 }
    };
    return choices.map((choice) => ({
      value: choice.value,
      weight: mode === "LOW_POWER" && ["JUMPING", "HOPPING", "CLIMBING", "PERCHED"].includes(choice.value)
        ? 0
        : Math.max(choice.weight * multipliers[mode][choice.value], 0.1)
    }));
  }
}
