import { BEHAVIOR_CONFIG } from "../config/behaviorConfig";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

export class StaringState implements PetState {
  public readonly name = "STARING" as const;
  public durationMs: number | null = null;

  public enter(context: PetContext): void {
    context.movement.stop();
    context.animation.play("idle");
    context.animation.setMotionEnabled(false);
    this.durationMs = randomBetween(
      context.random,
      BEHAVIOR_CONFIG.stare.minDurationMs,
      BEHAVIOR_CONFIG.stare.maxDurationMs
    );
  }

  public update(context: PetContext, _deltaTimeMs: number): void {
    if (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs) {
      context.transitionTo("IDLE");
    }
  }

  public exit(context: PetContext): void {
    context.animation.setMotionEnabled(true);
  }
}
