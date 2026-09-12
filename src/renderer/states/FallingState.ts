import type { PetContext, PetState } from "./PetState";

export class FallingState implements PetState {
  public readonly name = "FALLING" as const;
  public durationMs: number | null = null;
  private landing = false;

  public enter(context: PetContext): void {
    if (context.canUseMovement?.("FALL") === false) {
      this.durationMs = 0;
      return;
    }
    this.durationMs = null;
    context.cursor.disable();
    context.animation.setMotionEnabled(true);
    context.animation.play("fall", { restart: true });
    context.locomotion?.beginFall();
    context.recordMovement?.("FALL");
    this.landing = false;
  }

  public update(context: PetContext, deltaTimeMs: number): void {
    const locomotion = context.locomotion;
    if (locomotion === undefined || this.durationMs === 0) {
      context.transitionTo("IDLE");
      return;
    }
    locomotion.update(deltaTimeMs);
    const snapshot = locomotion.getSnapshot();
    if (snapshot.phase === "LANDING" && !this.landing) {
      this.landing = true;
      context.animation.play("fall_land", { restart: true });
    }
    if (locomotion.isComplete()) context.transitionTo("IDLE");
  }

  public exit(context: PetContext): void {
    if (!context.locomotion?.isComplete()) context.locomotion?.cancel();
  }
}
