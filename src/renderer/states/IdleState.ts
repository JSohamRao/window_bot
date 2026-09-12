import { BEHAVIOR_CONFIG } from "../config/behaviorConfig";
import { calculateCursorNoticeChance } from "../engine/CursorAwarenessController";
import { randomBetween, weightedChoice } from "../utils/random";
import type { AutonomousStateName, PetContext, PetState } from "./PetState";

export class IdleState implements PetState {
  public readonly name = "IDLE" as const;
  public durationMs: number | null = null;
  private nextBlinkAtMs = 0;
  private lastCursorSampleSequence = 0;

  public enter(context: PetContext): void {
    context.movement.stop();
    context.animation.setMotionEnabled(true);
    context.animation.play("idle");
    if (context.isAutonomyPaused() || !context.isMouseAwarenessAllowed()) {
      context.cursor.disable();
    } else {
      context.cursor.enableIdleAwareness();
    }
    this.durationMs = randomBetween(
      context.random,
      BEHAVIOR_CONFIG.idle.minDurationMs,
      BEHAVIOR_CONFIG.idle.maxDurationMs
    ) * context.getPowerPolicy().idleDurationMultiplier;
    this.scheduleNextBlink(context);
    this.lastCursorSampleSequence = context.cursor.getSnapshot().sampleSequence;
  }

  public update(context: PetContext, _deltaTimeMs: number): void {
    const elapsedMs = context.getStateElapsedMs();
    const cursor = context.cursor.getSnapshot();
    if (cursor.sampleSequence !== this.lastCursorSampleSequence) {
      this.lastCursorSampleSequence = cursor.sampleSequence;
      if (
        cursor.sameDisplay &&
        cursor.isNearby &&
        context.random.next() <
          calculateCursorNoticeChance(
            context.getPersonalitySnapshot(),
            context.getPowerPolicy().cursorNoticeChanceBoost
          )
      ) {
        context.transitionTo("WATCHING_CURSOR");
        return;
      }
    }
    if (this.durationMs !== null && elapsedMs >= this.durationMs) {
      const nextState = weightedChoice<AutonomousStateName>(
        context.random,
        context.getBehaviorWeights()
      );
      if (nextState === "IDLE") {
        context.restartCurrentState();
      } else {
        context.transitionTo(nextState);
      }
      return;
    }

    if (
      elapsedMs >= this.nextBlinkAtMs &&
      context.animation.getCurrentAnimation() !== "blink"
    ) {
      context.animation.play("blink", { restart: true });
      this.scheduleNextBlink(context);
    }
  }

  public exit(context: PetContext): void {
    context.cursor.disable();
  }

  private scheduleNextBlink(context: PetContext): void {
    this.nextBlinkAtMs =
      context.getStateElapsedMs() +
      randomBetween(
        context.random,
        BEHAVIOR_CONFIG.idle.minBlinkDelayMs,
        BEHAVIOR_CONFIG.idle.maxBlinkDelayMs
      );
  }
}
