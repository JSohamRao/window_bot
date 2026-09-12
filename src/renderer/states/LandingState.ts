import type { PetContext, PetState } from "./PetState";

export class LandingState implements PetState {
  public readonly name = "LANDING" as const;
  public durationMs: number | null = null;

  public enter(context: PetContext): void {
    if (context.canUseMovement?.("LAND") === false) {
      this.durationMs = 0;
      return;
    }
    this.durationMs = null;
    context.cursor.disable();
    context.locomotion?.land();
    context.animation.setMotionEnabled(true);
    context.animation.play("land", { restart: true });
    context.recordMovement?.("LAND");
  }

  public update(context: PetContext, deltaTimeMs: number): void {
    if (context.locomotion === undefined || this.durationMs === 0) {
      context.transitionTo("IDLE");
      return;
    }
    context.locomotion.update(deltaTimeMs);
    if (context.locomotion.isComplete()) context.transitionTo("IDLE");
  }

  public exit(context: PetContext): void {
    if (!context.locomotion?.isComplete()) context.locomotion?.cancel();
  }
}
