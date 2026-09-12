import {
  RARE_EVENT_CONFIG,
  RARE_EVENT_NAMES,
  type RareEventName
} from "../config/rareEventConfig";
import { mathRandomSource, randomBetween, weightedChoice, type RandomSource, type WeightedChoice } from "../utils/random";
import type { PersonalitySnapshot } from "./PersonalityController";

export interface RareEventUpdateContext {
  readonly canStart: boolean;
  readonly suspended: boolean;
  readonly personality: PersonalitySnapshot;
  readonly allowedEvents?: readonly RareEventName[];
}

export interface RareEventRuntimePolicy {
  readonly intervalMultiplier: number;
  readonly occurrenceChanceBoost: number;
}

const DEFAULT_RUNTIME_POLICY: RareEventRuntimePolicy = {
  intervalMultiplier: 1,
  occurrenceChanceBoost: 0
};

export interface RareEventSnapshot {
  readonly activeEvent: RareEventName | null;
  readonly nextCheckInMs: number | null;
  readonly globalCooldownRemainingMs: number;
  readonly perEventCooldownRemainingMs: Readonly<Record<RareEventName, number>>;
  readonly eligible: boolean;
  readonly occurrenceChance: number;
  readonly chaosIntervalModifier: number;
  readonly checkCount: number;
  readonly eventCounts: Readonly<Record<RareEventName, number>>;
  readonly intervalMultiplier: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

const finitePersonalityValue = (value: number): number =>
  Number.isFinite(value) ? clamp(value, 0, 100) : 0;

export const calculateRareEventOccurrenceChance = (
  personality: PersonalitySnapshot,
  boost = 0
): number =>
  clamp(
    RARE_EVENT_CONFIG.occurrenceChance.base +
      finitePersonalityValue(personality.chaos) *
        RARE_EVENT_CONFIG.occurrenceChance.chaosInfluence +
      (Number.isFinite(boost) ? boost : 0),
    RARE_EVENT_CONFIG.occurrenceChance.minimum,
    0.75
  );

export const calculateRareEventIntervalRange = (
  personality: PersonalitySnapshot,
  intervalMultiplier = 1
): { minMs: number; maxMs: number; chaosModifier: number } => {
  const chaosModifier = finitePersonalityValue(personality.chaos) / 100;
  const multiplier = Number.isFinite(intervalMultiplier)
    ? clamp(intervalMultiplier, 0.65, 1)
    : 1;
  const low = RARE_EVENT_CONFIG.checkInterval.lowChaos;
  const high = RARE_EVENT_CONFIG.checkInterval.highChaos;
  return {
    minMs: (low.minMs + (high.minMs - low.minMs) * chaosModifier) * multiplier,
    maxMs: (low.maxMs + (high.maxMs - low.maxMs) * chaosModifier) * multiplier,
    chaosModifier
  };
};

export const calculateRareEventWeights = (
  personality: PersonalitySnapshot
): Readonly<Record<RareEventName, number>> => {
  const energy = finitePersonalityValue(personality.energy);
  const boredom = finitePersonalityValue(personality.boredom);
  const irritation = finitePersonalityValue(personality.irritation);
  const chaos = finitePersonalityValue(personality.chaos);
  const base = RARE_EVENT_CONFIG.baseWeights;
  return {
    SPRINT: base.SPRINT * (0.25 + energy * 0.0075) * (0.8 + boredom * 0.004),
    FALL_OVER: base.FALL_OVER * (0.8 + (100 - energy) * 0.006),
    CREEPY_FREEZE:
      base.CREEPY_FREEZE *
      (0.8 + irritation * 0.004 + (100 - energy) * 0.002),
    ZOOM_STARE: base.ZOOM_STARE * (0.8 + chaos * 0.004),
    CHAOS_RUN:
      base.CHAOS_RUN *
      (0.2 + energy * 0.008) *
      (0.7 + boredom * 0.004) *
      (0.7 + chaos * 0.006),
    DOMAIN_EXPANSION:
      base.DOMAIN_EXPANSION *
      (0.7 + irritation * 0.004 + chaos * 0.003)
  };
};

const zeroRecord = (): Record<RareEventName, number> => ({
  SPRINT: 0,
  FALL_OVER: 0,
  CREEPY_FREEZE: 0,
  ZOOM_STARE: 0,
  CHAOS_RUN: 0,
  DOMAIN_EXPANSION: 0
});

export class RareEventController {
  private started = false;
  private suspended = false;
  private activeEvent: RareEventName | null = null;
  private nextCheckInMs: number | null = null;
  private globalCooldownRemainingMs = 0;
  private readonly perEventCooldownRemainingMs = zeroRecord();
  private readonly eventCounts = zeroRecord();
  private eligible = false;
  private occurrenceChance = 0;
  private chaosIntervalModifier = 0;
  private checkCount = 0;
  private runtimePolicy = DEFAULT_RUNTIME_POLICY;

  public constructor(
    private readonly random: RandomSource = mathRandomSource
  ) {}

  public start(personality: PersonalitySnapshot): void {
    if (this.started) return;
    this.started = true;
    this.scheduleNextCheck(personality);
  }

  public setRuntimePolicy(
    policy: RareEventRuntimePolicy,
    personality: PersonalitySnapshot
  ): void {
    const intervalMultiplier = Number.isFinite(policy.intervalMultiplier)
      ? clamp(policy.intervalMultiplier, 0.65, 1)
      : 1;
    const occurrenceChanceBoost = Number.isFinite(policy.occurrenceChanceBoost)
      ? clamp(policy.occurrenceChanceBoost, 0, 0.2)
      : 0;
    if (
      intervalMultiplier === this.runtimePolicy.intervalMultiplier &&
      occurrenceChanceBoost === this.runtimePolicy.occurrenceChanceBoost
    ) return;
    this.runtimePolicy = { intervalMultiplier, occurrenceChanceBoost };
    if (this.started && !this.suspended && this.activeEvent === null) {
      this.scheduleNextCheck(personality);
    }
  }

  public update(
    deltaTimeMs: number,
    context: RareEventUpdateContext
  ): RareEventName | null {
    if (!this.started || !Number.isFinite(deltaTimeMs) || deltaTimeMs <= 0) {
      return null;
    }
    const delta = Math.max(deltaTimeMs, 0);
    this.advanceCooldowns(delta);
    this.occurrenceChance = calculateRareEventOccurrenceChance(
      context.personality,
      this.runtimePolicy.occurrenceChanceBoost
    );
    this.chaosIntervalModifier =
      calculateRareEventIntervalRange(
        context.personality,
        this.runtimePolicy.intervalMultiplier
      ).chaosModifier;

    if (context.suspended) {
      if (!this.suspended) {
        this.suspended = true;
        this.nextCheckInMs = null;
      }
      this.eligible = false;
      return null;
    }
    if (this.suspended) {
      this.suspended = false;
      this.scheduleNextCheck(context.personality);
    }
    if (this.activeEvent !== null) {
      this.eligible = false;
      return null;
    }
    if (this.nextCheckInMs === null) {
      this.scheduleNextCheck(context.personality);
    }
    this.nextCheckInMs = Math.max((this.nextCheckInMs ?? 0) - delta, 0);
    this.eligible = context.canStart && this.globalCooldownRemainingMs <= 0;
    if ((this.nextCheckInMs ?? 0) > 0) return null;
    if (this.globalCooldownRemainingMs > 0) {
      this.nextCheckInMs = this.globalCooldownRemainingMs;
      return null;
    }
    if (!context.canStart) {
      this.nextCheckInMs = RARE_EVENT_CONFIG.checkInterval.deferredUntilIdleMs;
      return null;
    }

    this.checkCount += 1;
    if (this.random.next() >= this.occurrenceChance) {
      this.scheduleNextCheck(context.personality);
      return null;
    }
    const choices = this.getAvailableChoices(
      context.personality,
      context.allowedEvents
    );
    if (choices.length === 0) {
      this.scheduleNextCheck(context.personality);
      return null;
    }
    const event = weightedChoice(this.random, choices);
    this.beginEvent(event);
    return event;
  }

  public forceStart(event: RareEventName): boolean {
    if (this.activeEvent !== null) return false;
    this.beginEvent(event);
    return true;
  }

  public suspend(): void {
    this.suspended = true;
    this.nextCheckInMs = null;
    this.eligible = false;
  }

  public resume(personality: PersonalitySnapshot): void {
    if (!this.started) {
      this.start(personality);
      return;
    }
    this.suspended = false;
    if (this.activeEvent === null) this.scheduleNextCheck(personality);
    this.eligible = false;
  }

  public completeEvent(
    event: RareEventName,
    personality: PersonalitySnapshot
  ): void {
    if (this.activeEvent !== event) return;
    this.activeEvent = null;
    this.perEventCooldownRemainingMs[event] =
      RARE_EVENT_CONFIG.eventCooldownMs[event];
    this.globalCooldownRemainingMs = randomBetween(
      this.random,
      RARE_EVENT_CONFIG.globalCooldown.minMs,
      RARE_EVENT_CONFIG.globalCooldown.maxMs
    );
    this.scheduleNextCheck(personality);
    this.eligible = false;
  }

  public reset(personality: PersonalitySnapshot): void {
    this.activeEvent = null;
    this.globalCooldownRemainingMs = 0;
    for (const event of RARE_EVENT_NAMES) {
      this.perEventCooldownRemainingMs[event] = 0;
      this.eventCounts[event] = 0;
    }
    this.checkCount = 0;
    this.suspended = false;
    this.started = true;
    this.scheduleNextCheck(personality);
  }

  public getSnapshot(): RareEventSnapshot {
    return {
      activeEvent: this.activeEvent,
      nextCheckInMs: this.nextCheckInMs,
      globalCooldownRemainingMs: this.globalCooldownRemainingMs,
      perEventCooldownRemainingMs: { ...this.perEventCooldownRemainingMs },
      eligible: this.eligible,
      occurrenceChance: this.occurrenceChance,
      chaosIntervalModifier: this.chaosIntervalModifier,
      checkCount: this.checkCount,
      eventCounts: { ...this.eventCounts },
      intervalMultiplier: this.runtimePolicy.intervalMultiplier
    };
  }

  private beginEvent(event: RareEventName): void {
    this.activeEvent = event;
    this.nextCheckInMs = null;
    this.eventCounts[event] += 1;
    this.eligible = false;
  }

  private scheduleNextCheck(personality: PersonalitySnapshot): void {
    const range = calculateRareEventIntervalRange(
      personality,
      this.runtimePolicy.intervalMultiplier
    );
    this.nextCheckInMs = randomBetween(this.random, range.minMs, range.maxMs);
    this.chaosIntervalModifier = range.chaosModifier;
    this.occurrenceChance = calculateRareEventOccurrenceChance(
      personality,
      this.runtimePolicy.occurrenceChanceBoost
    );
  }

  private advanceCooldowns(deltaTimeMs: number): void {
    this.globalCooldownRemainingMs = Math.max(
      this.globalCooldownRemainingMs - deltaTimeMs,
      0
    );
    for (const event of RARE_EVENT_NAMES) {
      this.perEventCooldownRemainingMs[event] = Math.max(
        this.perEventCooldownRemainingMs[event] - deltaTimeMs,
        0
      );
    }
  }

  private getAvailableChoices(
    personality: PersonalitySnapshot,
    allowedEvents: readonly RareEventName[] = RARE_EVENT_NAMES
  ): WeightedChoice<RareEventName>[] {
    const weights = calculateRareEventWeights(personality);
    return RARE_EVENT_NAMES.flatMap((event) => {
      const weight = weights[event];
      return allowedEvents.includes(event) &&
        this.perEventCooldownRemainingMs[event] <= 0 &&
        Number.isFinite(weight) &&
        weight > 0
        ? [{ value: event, weight }]
        : [];
    });
  }
}
