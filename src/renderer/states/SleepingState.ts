import { BEHAVIOR_CONFIG } from "../config/behaviorConfig";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

export class SleepingState implements PetState {
  public readonly name = "SLEEPING" as const;
  public durationMs: number | null = null;
  private waking = false;

  public enter(context: PetContext): void {
    context.movement.stop();
    context.animation.setMotionEnabled(true);
    context.animation.playSequence?.(["sleep_enter", "sleep_loop"]);
    if (context.animation.playSequence === undefined) context.animation.play("sleep");
    this.durationMs = randomBetween(
      context.random,
      BEHAVIOR_CONFIG.sleep.minDurationMs,
      BEHAVIOR_CONFIG.sleep.maxDurationMs
    );
    this.waking = false;
  }

  public update(context: PetContext, _deltaTimeMs: number): void {
    if (
      this.durationMs !== null &&
      !this.waking &&
      context.getStateElapsedMs() >= this.durationMs - 510
    ) {
      this.waking = true;
      context.animation.play("wake", { restart: true });
    }
    if (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs) {
      context.transitionTo("IDLE");
    }
  }

  public exit(_context: PetContext): void {}
}
