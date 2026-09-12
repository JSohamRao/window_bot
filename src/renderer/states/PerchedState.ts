import { LOCOMOTION_CONFIG } from "../config/locomotionConfig";
import type { PetContext, PetState } from "./PetState";

const PERCH_EXIT_DURATION_MS = 150;

export class PerchedState implements PetState {
  public readonly name = "PERCHED" as const;
  public durationMs: number | null = LOCOMOTION_CONFIG.perchDurationMs;
  private valid = false;
  private exiting = false;

  public enter(context: PetContext): void {
    this.exiting = false;
    const locomotion = context.locomotion;
    if (locomotion === undefined) {
      this.valid = false;
      return;
    }
    this.valid =
      (locomotion.getSnapshot().mode === "PERCHED" || locomotion.canClimb()) &&
      context.canUseMovement?.("PERCH") !== false;
    if (!this.valid) return;
    context.movement.stop();
    locomotion.perch();
    context.animation.setMotionEnabled(true);
    context.animation.playSequence?.(["perch_enter", "perch_idle"]);
    context.recordMovement?.("PERCH");
    if (context.isAutonomyPaused() || !context.isMouseAwarenessAllowed()) context.cursor.disable();
    else context.cursor.enableIdleAwareness();
  }

  public update(context: PetContext, _deltaTimeMs: number): void {
    if (!this.valid) {
      context.transitionTo("IDLE");
      return;
    }
    if (
      !this.exiting &&
      this.durationMs !== null &&
      context.getStateElapsedMs() >= this.durationMs - PERCH_EXIT_DURATION_MS
    ) {
      this.exiting = true;
      context.animation.play("perch_exit", { restart: true });
    }
    if (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs) {
      context.transitionTo("FALLING");
    }
  }

  public exit(context: PetContext): void {
    context.cursor.disable();
    context.locomotion?.cancel();
  }
}
