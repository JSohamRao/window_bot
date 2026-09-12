import { LOCOMOTION_CONFIG } from "../config/locomotionConfig";
import type { PetContext, PetState } from "./PetState";

const CLIMB_EXIT_DURATION_MS = 250;
type ClimbDestination = "PERCHED" | "FALLING" | "IDLE";

export class ClimbingState implements PetState {
  public readonly name = "CLIMBING" as const;
  public durationMs: number | null = LOCOMOTION_CONFIG.climbMaxDurationMs + 220;
  private valid = false;
  private pendingTransition: ClimbDestination | null = null;
  private transitionAtMs = 0;

  public enter(context: PetContext): void {
    this.pendingTransition = null;
    this.transitionAtMs = 0;
    if (context.canUseMovement?.("CLIMB") === false) {
      this.valid = false;
      return;
    }
    const fallbackDirection: -1 | 1 = context.random.next() < 0.8 ? -1 : 1;
    const directionY =
      context.locomotion?.consumeRequestedClimbDirection(fallbackDirection) ??
      fallbackDirection;
    this.valid = context.locomotion?.beginClimb(directionY) ?? false;
    if (!this.valid) return;
    context.cursor.disable();
    context.animation.setDirection(context.locomotion!.getSnapshot().direction);
    context.animation.setMotionEnabled(true);
    context.animation.playSequence?.(["climb_enter", "climb_loop"]);
    context.recordMovement?.("CLIMB");
  }

  public update(context: PetContext, deltaTimeMs: number): void {
    if (!this.valid || context.locomotion === undefined) {
      context.transitionTo("IDLE");
      return;
    }
    if (this.pendingTransition !== null) {
      if (context.getStateElapsedMs() >= this.transitionAtMs) {
        context.transitionTo(this.pendingTransition);
      }
      return;
    }
    context.locomotion.update(deltaTimeMs);
    const snapshot = context.locomotion.getSnapshot();
    let destination: ClimbDestination | null = null;
    if (snapshot.mode === "PERCHED") destination = "PERCHED";
    else if (snapshot.action === "FALL") destination = "FALLING";
    else if (snapshot.phase === "LANDING" || context.locomotion.isComplete()) destination = "IDLE";
    if (destination !== null) {
      if (destination === "FALLING") context.locomotion.cancel();
      context.animation.play("climb_exit", { restart: true });
      this.pendingTransition = destination;
      this.transitionAtMs = context.getStateElapsedMs() + CLIMB_EXIT_DURATION_MS;
    }
  }

  public exit(context: PetContext): void {
    if (context.locomotion?.getSnapshot().mode !== "PERCHED") context.locomotion?.cancel();
  }
}
