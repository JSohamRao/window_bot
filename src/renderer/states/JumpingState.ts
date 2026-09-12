import type { SpriteDirection } from "../engine/AnimationController";
import type { JumpKind } from "../engine/LocomotionController";
import type { PetContext, PetState } from "./PetState";

export class JumpingState implements PetState {
  public readonly name: "JUMPING" | "HOPPING";
  public durationMs: number | null = null;
  private lastPhase = "";

  public constructor(private readonly kind: JumpKind) {
    this.name = kind === "JUMP" ? "JUMPING" : "HOPPING";
  }

  public enter(context: PetContext): void {
    this.durationMs = null;
    this.lastPhase = "";
    if (context.canUseMovement?.(this.kind) === false) {
      this.durationMs = 0;
      return;
    }
    const locomotion = context.locomotion;
    if (locomotion === undefined) return;
    const cursorDirection = context.cursor.getSnapshot().cursorDirection;
    const fallbackDirection: SpriteDirection =
      cursorDirection ?? (context.random.next() < 0.5 ? "left" : "right");
    const direction = locomotion.consumeRequestedHorizontalDirection(
      fallbackDirection
    );
    context.cursor.disable();
    context.movement.stop();
    context.animation.setMotionEnabled(true);
    context.animation.setDirection(direction);
    context.animation.play(this.kind === "JUMP" ? "jump_prepare" : "hop_prepare", { restart: true });
    if (!locomotion.beginJump(this.kind, direction)) {
      this.durationMs = 0;
      return;
    }
    context.recordMovement?.(this.kind);
    this.lastPhase = "PREPARE";
  }

  public update(context: PetContext, deltaTimeMs: number): void {
    const locomotion = context.locomotion;
    if (locomotion === undefined || this.durationMs === 0) {
      context.transitionTo("IDLE");
      return;
    }
    locomotion.update(deltaTimeMs);
    const snapshot = locomotion.getSnapshot();
    if (snapshot.phase !== this.lastPhase) {
      this.lastPhase = snapshot.phase;
      if (snapshot.phase === "ACTIVE") {
        context.animation.play(this.kind === "JUMP" ? "jump_air" : "hop_air", { restart: true });
      } else if (snapshot.phase === "LANDING") {
        context.animation.play(this.kind === "JUMP" ? "land" : "hop_land", { restart: true });
      }
    }
    if (locomotion.isComplete()) context.transitionTo("IDLE");
  }

  public exit(context: PetContext): void {
    if (!context.locomotion?.isComplete()) context.locomotion?.cancel();
  }
}
