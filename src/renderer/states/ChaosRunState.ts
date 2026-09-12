import { RARE_EVENT_CONFIG } from "../config/rareEventConfig";
import type { SpriteDirection } from "../engine/AnimationController";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

const opposite = (direction: SpriteDirection): SpriteDirection =>
  direction === "left" ? "right" : "left";

export class ChaosRunState implements PetState {
  public readonly name = "CHAOS_RUN" as const;
  public durationMs: number | null = null;
  private direction: SpriteDirection = "right";
  private speedPxPerSecond = RARE_EVENT_CONFIG.speed.chaosRun.minPxPerSecond;
  private nextDirectionChangeAtMs = 0;
  private reversedAtBoundary = false;
  private valid = false;

  public enter(context: PetContext): void {
    this.valid = context.canUseMovement?.("CRAWL") !== false;
    if (!this.valid) {
      this.durationMs = 0;
      return;
    }
    const duration = RARE_EVENT_CONFIG.duration.CHAOS_RUN;
    const speed = RARE_EVENT_CONFIG.speed.chaosRun;
    this.durationMs = randomBetween(context.random, duration.minMs, duration.maxMs);
    this.speedPxPerSecond = randomBetween(
      context.random,
      speed.minPxPerSecond,
      speed.maxPxPerSecond
    );
    this.direction = context.random.next() < 0.5 ? "left" : "right";
    this.reversedAtBoundary = false;
    this.scheduleDirectionChange(context);
    context.cursor.disable();
    context.animation.setMotionEnabled(true);
    context.animation.setDirection(this.direction);
    context.animation.play("crawl", { restart: true });
    context.eventVisuals.activate(this.name, this.durationMs);
    context.movement.start(this.direction, this.speedPxPerSecond);
    if (context.random.next() < RARE_EVENT_CONFIG.dialogueChance.CHAOS_RUN) {
      context.showRareEventDialogue(this.name);
    }
  }

  public update(context: PetContext, deltaTimeMs: number): void {
    if (!this.valid) {
      context.transitionTo("IDLE");
      return;
    }
    context.movement.update(deltaTimeMs);
    if (context.movement.consumeBoundaryReached()) {
      if (this.reversedAtBoundary) {
        context.transitionTo("IDLE");
        return;
      }
      this.reversedAtBoundary = true;
      this.reverse(context);
      this.scheduleDirectionChange(context);
    } else if (context.getStateElapsedMs() >= this.nextDirectionChangeAtMs) {
      this.reverse(context);
      this.scheduleDirectionChange(context);
    }
    if (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs) {
      context.transitionTo("IDLE");
    }
  }

  public exit(context: PetContext): void {
    context.movement.stop();
    context.eventVisuals.reset();
    if (this.valid) context.onRareEventFinished(this.name);
  }

  private reverse(context: PetContext): void {
    this.direction = opposite(this.direction);
    context.animation.setDirection(this.direction);
    context.movement.start(this.direction, this.speedPxPerSecond);
  }

  private scheduleDirectionChange(context: PetContext): void {
    const timing = RARE_EVENT_CONFIG.chaosDirectionChange;
    this.nextDirectionChangeAtMs =
      context.getStateElapsedMs() +
      randomBetween(context.random, timing.minMs, timing.maxMs);
  }
}
