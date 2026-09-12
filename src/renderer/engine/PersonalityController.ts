import {
  PERSONALITY_CONFIG,
  PERSONALITY_DEFAULTS,
  type PersonalityValues
} from "../config/personalityConfig";
import type { RareEventName } from "../config/rareEventConfig";
import type { PetStateName } from "../states/PetState";

export interface PersonalitySnapshot {
  readonly irritation: number;
  readonly energy: number;
  readonly boredom: number;
  readonly chaos: number;
}

const VALUE_KEYS: readonly (keyof PersonalityValues)[] = [
  "irritation",
  "energy",
  "boredom",
  "chaos"
];

const clamp = (value: number): number =>
  Math.min(
    Math.max(value, PERSONALITY_CONFIG.minimumValue),
    PERSONALITY_CONFIG.maximumValue
  );

export class PersonalityController {
  private values: PersonalityValues = { ...PERSONALITY_DEFAULTS };
  private rageReliefPending = false;

  public getSnapshot(): PersonalitySnapshot {
    return { ...this.values };
  }

  public update(deltaTimeMs: number, state: PetStateName): void {
    if (!Number.isFinite(deltaTimeMs) || deltaTimeMs <= 0) {
      return;
    }
    const minutes = deltaTimeMs / 60_000;
    const rates = PERSONALITY_CONFIG.passiveRatesPerMinute[state];
    for (const key of VALUE_KEYS) {
      this.adjust(key, rates[key] * minutes);
    }
  }

  public adjustIrritation(amount: number): void {
    this.adjust("irritation", amount);
  }

  public adjustEnergy(amount: number): void {
    this.adjust("energy", amount);
  }

  public adjustBoredom(amount: number): void {
    this.adjust("boredom", amount);
  }

  public adjustChaos(amount: number): void {
    this.adjust("chaos", amount);
  }

  public setValues(values: Partial<PersonalitySnapshot>): void {
    for (const key of VALUE_KEYS) {
      const value = values[key];
      if (value !== undefined && Number.isFinite(value)) {
        this.values[key] = clamp(value);
      }
    }
  }

  public reset(): void {
    this.values = { ...PERSONALITY_DEFAULTS };
    this.rageReliefPending = false;
  }

  public onClick(): void {
    this.applyEffects(PERSONALITY_CONFIG.interactionEffects.click);
  }

  public onAnnoyedCombo(): void {
    this.applyEffects(PERSONALITY_CONFIG.interactionEffects.annoyedCombo);
  }

  public onAngryCombo(): void {
    this.applyEffects(PERSONALITY_CONFIG.interactionEffects.angryCombo);
  }

  public onRage(): void {
    this.applyEffects(PERSONALITY_CONFIG.interactionEffects.rage);
    this.rageReliefPending = true;
  }

  public onDragComplete(longDrag: boolean): void {
    this.applyEffects(
      longDrag
        ? PERSONALITY_CONFIG.interactionEffects.longDrag
        : PERSONALITY_CONFIG.interactionEffects.normalDrag
    );
  }

  public onCursorWatch(): void {
    this.applyEffects(PERSONALITY_CONFIG.interactionEffects.cursorWatch);
  }

  public onMouseChase(): void {
    this.applyEffects(PERSONALITY_CONFIG.interactionEffects.mouseChase);
  }

  public onRareEventFinished(event: RareEventName): void {
    this.applyEffects(PERSONALITY_CONFIG.rareEventEffects[event]);
  }

  public onStateExited(state: PetStateName): void {
    if (state === "ANGRY") {
      this.adjustIrritation(
        PERSONALITY_CONFIG.stateExitEffects.angryIrritationRelief
      );
    } else if (state === "RAGE" && this.rageReliefPending) {
      this.adjustIrritation(
        PERSONALITY_CONFIG.stateExitEffects.rageIrritationRelief
      );
      this.rageReliefPending = false;
    }
  }

  private applyEffects(effects: Partial<PersonalityValues>): void {
    for (const key of VALUE_KEYS) {
      const amount = effects[key];
      if (amount !== undefined) {
        this.adjust(key, amount);
      }
    }
  }

  private adjust(key: keyof PersonalityValues, amount: number): void {
    if (!Number.isFinite(amount)) {
      return;
    }
    const next = this.values[key] + amount;
    this.values[key] = Number.isFinite(next)
      ? clamp(next)
      : amount > 0
        ? PERSONALITY_CONFIG.maximumValue
        : PERSONALITY_CONFIG.minimumValue;
  }
}
