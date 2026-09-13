import type { ThukunaSettings } from "../../shared/settings";
import type { AutonomousStateName } from "../states/PetState";
import type { WeightedChoice } from "../utils/random";
import type { SystemAwarenessSnapshot } from "../../shared/systemAwareness";

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
  private activityState: SystemAwarenessSnapshot["activityState"] = "unknown";
  private powerSource: SystemAwarenessSnapshot["powerSource"] = "unknown";

  public constructor(settings: ThukunaSettings) {
    this.settings = { ...settings };
  }

  public update(settings: ThukunaSettings): void {
    this.settings = { ...settings };
  }

  public updateSystemAwareness(snapshot: SystemAwarenessSnapshot): void {
    this.activityState = snapshot.activityState;
    this.powerSource = snapshot.powerSource;
  }

  public getSnapshot(): PowerPolicySnapshot {
    const mode = resolvePowerMode(this.settings);
    const policy = POLICIES[mode];
    const systemIdle = mode !== "LOW_POWER" && this.activityState === "idle";
    const onBattery = mode !== "LOW_POWER" && this.powerSource === "battery";
    return {
      mode,
      ...policy,
      autonomousMovementMultiplier:
        policy.autonomousMovementMultiplier *
        (systemIdle ? 0.6 : 1) *
        (onBattery ? 0.8 : 1),
      idleDurationMultiplier:
        policy.idleDurationMultiplier *
        (systemIdle ? 1.75 : 1) *
        (onBattery ? 1.25 : 1),
      personalityUpdateIntervalMs:
        policy.personalityUpdateIntervalMs *
        (systemIdle ? 2 : 1) *
        (onBattery ? 1.5 : 1),
      rareEventIntervalMultiplier:
        policy.rareEventIntervalMultiplier *
        (systemIdle ? 1.7 : 1) *
        (onBattery ? 1.35 : 1),
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
    const systemIdle = mode !== "LOW_POWER" && this.activityState === "idle";
    const onBattery = mode !== "LOW_POWER" && this.powerSource === "battery";
    return choices.map((choice) => ({
      value: choice.value,
      weight: mode === "LOW_POWER" && ["JUMPING", "HOPPING", "CLIMBING", "PERCHED"].includes(choice.value)
        ? 0
        : Math.max(
            choice.weight *
              multipliers[mode][choice.value] *
              (systemIdle && choice.value === "IDLE" ? 2 : 1) *
              (systemIdle && choice.value === "SLEEPING" ? 1.75 : 1) *
              (onBattery && (choice.value === "IDLE" || choice.value === "SLEEPING") ? 1.25 : 1) *
              (onBattery && ["CRAWLING", "JUMPING", "HOPPING", "CLIMBING"].includes(choice.value) ? 0.7 : 1),
            0.1
          )
    }));
  }
}
