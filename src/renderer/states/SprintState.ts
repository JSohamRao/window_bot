import { RARE_EVENT_CONFIG } from "../config/rareEventConfig";
import type { SpriteDirection } from "../engine/AnimationController";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

export class SprintState implements PetState {
  public readonly name = "SPRINT" as const;
  public durationMs: number | null = null;
  private speedPxPerSecond = RARE_EVENT_CONFIG.speed.sprint.minPxPerSecond;
  private valid = false;

  public enter(context: PetContext): void {
    this.valid = context.canUseMovement?.("CRAWL") !== false;
    if (!this.valid) {
      this.durationMs = 0;
      return;
    }
    const direction: SpriteDirection = context.random.next() < 0.5 ? "left" : "right";
    const duration = RARE_EVENT_CONFIG.duration.SPRINT;
    const speed = RARE_EVENT_CONFIG.speed.sprint;
    this.durationMs = randomBetween(context.random, duration.minMs, duration.maxMs);
    this.speedPxPerSecond = randomBetween(
      context.random,
      speed.minPxPerSecond,
      speed.maxPxPerSecond
    );
    context.cursor.disable();
    context.animation.setMotionEnabled(true);
    context.animation.setDirection(direction);
    context.animation.play("sprint", { restart: true });
    context.eventVisuals.activate(this.name, this.durationMs);
    context.movement.start(direction, this.speedPxPerSecond);
    if (context.random.next() < RARE_EVENT_CONFIG.dialogueChance.SPRINT) {
      context.showRareEventDialogue(this.name);
    }
  }

  public update(context: PetContext, deltaTimeMs: number): void {
    if (!this.valid) {
      context.transitionTo("IDLE");
      return;
    }
    context.movement.update(deltaTimeMs);
    if (
      context.movement.consumeBoundaryReached() ||
      (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs)
    ) {
      context.transitionTo("IDLE");
    }
  }

  public exit(context: PetContext): void {
    context.movement.stop();
    context.eventVisuals.reset();
    if (this.valid) context.onRareEventFinished(this.name);
  }
}
