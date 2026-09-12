import { CURSOR_CONFIG } from "../config/cursorConfig";
import { calculateMouseChaseChance } from "../engine/CursorAwarenessController";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

export class WatchingCursorState implements PetState {
  public readonly name = "WATCHING_CURSOR" as const;
  public durationMs: number | null = null;
  private lastSampleSequence = 0;

  public enter(context: PetContext): void {
    context.movement.stop();
    context.animation.play("watch_cursor");
    context.animation.setMotionEnabled(false);
    context.cursor.enableWatching();
    context.onCursorWatch();
    if (context.random.next() < CURSOR_CONFIG.mouseDialogueChance) {
      context.showMouseDialogue();
    }
    this.durationMs = randomBetween(
      context.random,
      CURSOR_CONFIG.watchMinDurationMs,
      CURSOR_CONFIG.watchMaxDurationMs
    );
    this.lastSampleSequence = context.cursor.getSnapshot().sampleSequence;
  }

  public update(context: PetContext, _deltaTimeMs: number): void {
    const cursor = context.cursor.getSnapshot();
    if (cursor.sampleSequence !== this.lastSampleSequence) {
      this.lastSampleSequence = cursor.sampleSequence;
      if (!cursor.sameDisplay || !cursor.isNearby) {
        context.transitionTo("IDLE");
        return;
      }
      if (cursor.cursorDirection !== null) {
        context.animation.setDirection(cursor.cursorDirection);
      }
    }

    if (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs) {
      const chaseChance = calculateMouseChaseChance(
        context.getPersonalitySnapshot(),
        context.getPowerPolicy().chaseChanceBoost
      );
      if (
        cursor.hasSample &&
        cursor.sameDisplay &&
        cursor.isWithinChaseRadius &&
        context.random.next() < chaseChance
      ) {
        context.transitionTo("CHASE_MOUSE");
      } else {
        context.transitionTo("IDLE");
      }
    }
  }

  public exit(context: PetContext): void {
    context.cursor.disable();
    context.animation.setMotionEnabled(true);
  }
}
