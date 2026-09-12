import type { PetContext, PetState } from "./PetState";

export class DraggedState implements PetState {
  public readonly name = "DRAGGED" as const;
  public readonly durationMs = null;

  public enter(context: PetContext): void {
    context.movement.stop();
    context.animation.play("idle");
    context.animation.setMotionEnabled(false);
  }

  public update(_context: PetContext, _deltaTimeMs: number): void {}

  public exit(context: PetContext): void {
    context.animation.setMotionEnabled(true);
  }
}
