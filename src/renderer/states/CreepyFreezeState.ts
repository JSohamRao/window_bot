import { RARE_EVENT_CONFIG } from "../config/rareEventConfig";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

export class CreepyFreezeState implements PetState {
  public readonly name = "CREEPY_FREEZE" as const;
  public durationMs: number | null = null;
  private dialogueEvaluated = false;

  public enter(context: PetContext): void {
    const duration = RARE_EVENT_CONFIG.duration.CREEPY_FREEZE;
    this.durationMs = randomBetween(context.random, duration.minMs, duration.maxMs);
    this.dialogueEvaluated = false;
    context.movement.stop();
    context.cursor.disable();
    context.animation.play("idle");
    context.animation.setMotionEnabled(false);
    context.eventVisuals.activate(this.name, this.durationMs);
  }

  public update(context: PetContext, _deltaTimeMs: number): void {
    if (
      !this.dialogueEvaluated &&
      this.durationMs !== null &&
      context.getStateElapsedMs() >= this.durationMs - 1_000
    ) {
      this.dialogueEvaluated = true;
      if (context.random.next() < RARE_EVENT_CONFIG.dialogueChance.CREEPY_FREEZE) {
        context.showRareEventDialogue(this.name);
      }
    }
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
