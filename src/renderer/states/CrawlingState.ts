import { BEHAVIOR_CONFIG } from "../config/behaviorConfig";
import type { SpriteDirection } from "../engine/AnimationController";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

const CRAWL_STOP_DURATION_MS = 290;

export class CrawlingState implements PetState {
  public readonly name = "CRAWLING" as const;
  public durationMs: number | null = null;
  private stopping = false;

  public enter(context: PetContext): void {
    this.stopping = false;
    if (context.canUseMovement?.("CRAWL") === false) {
      this.durationMs = 0;
      return;
    }
    const direction: SpriteDirection =
      context.random.next() < 0.5 ? "left" : "right";
    const speed = randomBetween(
      context.random,
      BEHAVIOR_CONFIG.crawl.minSpeedPxPerSecond,
      BEHAVIOR_CONFIG.crawl.maxSpeedPxPerSecond
    ) * context.getPowerPolicy().autonomousMovementMultiplier;
    this.durationMs = randomBetween(
      context.random,
      BEHAVIOR_CONFIG.crawl.minDurationMs,
      BEHAVIOR_CONFIG.crawl.maxDurationMs
    );
    context.animation.setMotionEnabled(true);
    context.animation.setDirection(direction);
    context.animation.playSequence?.(["crawl_start", "crawl_loop"]);
    if (context.animation.playSequence === undefined) context.animation.play("crawl");
    context.movement.start(direction, speed);
    context.recordMovement?.("CRAWL");
  }

  public update(context: PetContext, deltaTimeMs: number): void {
    if (this.durationMs === 0) {
      context.transitionTo("IDLE");
      return;
    }
    if (this.stopping) {
      if (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs) {
        context.transitionTo("IDLE");
      }
      return;
    }

    context.movement.update(deltaTimeMs);
    if (
      context.movement.consumeBoundaryReached() ||
      (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs)
    ) {
      context.movement.stop();
      context.animation.play("crawl_stop", { restart: true });
      this.stopping = true;
      this.durationMs = context.getStateElapsedMs() + CRAWL_STOP_DURATION_MS;
    }
  }

  public exit(context: PetContext): void {
    context.movement.stop();
  }
}
