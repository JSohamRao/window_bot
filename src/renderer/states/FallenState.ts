import { RARE_EVENT_CONFIG } from "../config/rareEventConfig";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

export class FallenState implements PetState {
  public readonly name = "FALL_OVER" as const;
  public durationMs: number | null = null;

  public enter(context: PetContext): void {
    const duration = RARE_EVENT_CONFIG.duration.FALL_OVER;
    this.durationMs = randomBetween(context.random, duration.minMs, duration.maxMs);
    context.movement.stop();
    context.cursor.disable();
    context.animation.setMotionEnabled(false);
    context.animation.play("fall_over", { restart: true });
    context.eventVisuals.activate(this.name, this.durationMs);
    if (context.random.next() < RARE_EVENT_CONFIG.dialogueChance.FALL_OVER) {
      context.showRareEventDialogue(this.name);
    }
  }

  public update(context: PetContext, _deltaTimeMs: number): void {
    if (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs) {
      context.transitionTo("IDLE");
    }
  }

  public exit(context: PetContext): void {
    context.eventVisuals.reset();
    context.animation.setMotionEnabled(true);
    context.onRareEventFinished(this.name);
  }
}
