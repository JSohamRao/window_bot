import { INTERACTION_CONFIG } from "../config/interactionConfig";
import type { PetContext, PetState } from "./PetState";

export class RageState implements PetState {
  public readonly name = "RAGE" as const;
  public readonly durationMs = INTERACTION_CONFIG.rageDurationMs;

  public enter(context: PetContext): void {
    context.movement.stop();
    context.animation.setMotionEnabled(true);
    context.animation.play("rage", { restart: true });
    context.animation.setRageActive(true);
  }

  public update(context: PetContext, _deltaTimeMs: number): void {
    if (context.getStateElapsedMs() >= this.durationMs) {
      context.transitionTo("IDLE");
    }
  }

  public exit(context: PetContext): void {
    context.animation.setRageActive(false);
  }
}
