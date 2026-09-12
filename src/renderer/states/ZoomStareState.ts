import { RARE_EVENT_CONFIG } from "../config/rareEventConfig";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

export class ZoomStareState implements PetState {
  public readonly name = "ZOOM_STARE" as const;
  public durationMs: number | null = null;

  public enter(context: PetContext): void {
    const duration = RARE_EVENT_CONFIG.duration.ZOOM_STARE;
    this.durationMs = randomBetween(context.random, duration.minMs, duration.maxMs);
    context.movement.stop();
    context.cursor.disable();
    context.animation.play("idle");
    context.animation.setMotionEnabled(false);
    context.eventVisuals.activate(this.name, this.durationMs);
    if (context.random.next() < RARE_EVENT_CONFIG.dialogueChance.ZOOM_STARE) {
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
