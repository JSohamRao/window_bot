import { BEHAVIOR_CONFIG } from "../config/behaviorConfig";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

const ANGRY_EXIT_DURATION_MS = 150;

export class AngryState implements PetState {
  public readonly name = "ANGRY" as const;
  public durationMs: number | null = null;
  private exiting = false;

  public enter(context: PetContext): void {
    context.movement.stop();
    context.animation.setMotionEnabled(true);
    context.animation.playSequence?.(["angry_enter", "angry_loop"]);
    if (context.animation.playSequence === undefined) context.animation.play("angry", { restart: true });
    this.durationMs = randomBetween(
      context.random,
      BEHAVIOR_CONFIG.angry.minDurationMs,
      BEHAVIOR_CONFIG.angry.maxDurationMs
    );
    this.exiting = false;
  }

  public update(context: PetContext, _deltaTimeMs: number): void {
    if (
      !this.exiting &&
      this.durationMs !== null &&
      context.getStateElapsedMs() >= this.durationMs - ANGRY_EXIT_DURATION_MS
    ) {
      this.exiting = true;
      context.animation.play("angry_exit", { restart: true });
    }
    if (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs) {
      context.transitionTo("IDLE");
    }
  }

  public exit(_context: PetContext): void {}
}
