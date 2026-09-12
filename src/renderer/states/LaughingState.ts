import { BEHAVIOR_CONFIG } from "../config/behaviorConfig";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

export class LaughingState implements PetState {
  public readonly name = "LAUGHING" as const;
  public durationMs: number | null = null;

  public enter(context: PetContext): void {
    context.movement.stop();
    context.animation.setMotionEnabled(true);
    context.animation.play("laugh", { restart: true });
    this.durationMs = randomBetween(
      context.random,
      BEHAVIOR_CONFIG.laugh.minDurationMs,
      BEHAVIOR_CONFIG.laugh.maxDurationMs
    );
  }

  public update(context: PetContext, _deltaTimeMs: number): void {
    if (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs) {
      context.transitionTo("IDLE");
    }
  }

  public exit(_context: PetContext): void {}
}
