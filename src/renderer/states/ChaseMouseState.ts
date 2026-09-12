import { CURSOR_CONFIG } from "../config/cursorConfig";
import { calculateMouseChaseSpeed } from "../engine/CursorAwarenessController";
import { planCursorMovement } from "../engine/MovementPlanner";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

export class ChaseMouseState implements PetState {
  public readonly name = "CHASE_MOUSE" as const;
  public durationMs: number | null = null;
  private speedPxPerSecond: number = CURSOR_CONFIG.minChaseSpeedPxPerSecond;
  private lastSampleSequence = 0;
  private deadZoneElapsedMs = 0;
  private valid = false;

  public enter(context: PetContext): void {
    this.valid =
      context.isMouseAwarenessAllowed() &&
      context.canUseMovement?.("CRAWL") !== false;
    if (!this.valid) {
      this.durationMs = 0;
      context.cursor.disable();
      return;
    }
    context.movement.stop();
    context.animation.setMotionEnabled(true);
    context.animation.play("crawl");
    context.cursor.enableChasing();
    context.onMouseChase();
    if (context.random.next() < CURSOR_CONFIG.mouseDialogueChance) {
      context.showMouseDialogue();
    }
    this.durationMs = randomBetween(
      context.random,
      CURSOR_CONFIG.chaseMinDurationMs,
      CURSOR_CONFIG.chaseMaxDurationMs
    );
    this.speedPxPerSecond = calculateMouseChaseSpeed(
      context.getPersonalitySnapshot(),
      context.getPowerPolicy().chaseSpeedMultiplier
    );
    this.lastSampleSequence = context.cursor.getSnapshot().sampleSequence;
    this.deadZoneElapsedMs = 0;
  }

  public update(context: PetContext, deltaTimeMs: number): void {
    if (!this.valid) {
      context.transitionTo("IDLE");
      return;
    }
    context.movement.update(deltaTimeMs);
    if (context.movement.consumeBoundaryReached()) {
      context.transitionTo("IDLE");
      return;
    }

    const cursor = context.cursor.getSnapshot();
    if (cursor.sampleSequence !== this.lastSampleSequence) {
      this.lastSampleSequence = cursor.sampleSequence;
      if (
        !cursor.sameDisplay ||
        cursor.distancePx === null ||
        cursor.distancePx > CURSOR_CONFIG.chaseGiveUpRadiusPx
      ) {
        context.transitionTo("IDLE");
        return;
      }
      const plan = planCursorMovement({
        cursorHorizontalDeltaPx: cursor.horizontalDeltaPx,
        cursorVerticalDeltaPx: cursor.verticalDeltaPx ?? null,
        cursorDistancePx: cursor.distancePx,
        sameDisplay: cursor.sameDisplay,
        movement: context.movement.getSnapshot(),
        powerMode: context.getPowerPolicy().mode
      });
      if (plan === "GIVE_UP") {
        context.transitionTo("IDLE");
        return;
      }
      if (context.locomotion !== undefined && plan.startsWith("JUMP_")) {
        context.transitionTo("JUMPING");
        return;
      }
      if (context.locomotion !== undefined && plan.startsWith("HOP_")) {
        context.transitionTo("HOPPING");
        return;
      }
      if (context.locomotion !== undefined && plan === "CLIMB_UP") {
        context.locomotion.requestClimbDirection(-1);
        context.transitionTo("CLIMBING");
        return;
      }
      if (context.locomotion !== undefined && plan === "DROP") {
        context.transitionTo("FALLING");
        return;
      }
      if (
        plan === "WATCH" ||
        cursor.isInsideDeadZone ||
        cursor.suggestedDirection === null
      ) {
        context.movement.stop();
      } else {
        const direction = cursor.suggestedDirection;
        context.animation.setDirection(direction);
        if (
          !context.movement.isMoving() ||
          context.movement.getDirection() !== direction
        ) {
          context.movement.start(direction, this.speedPxPerSecond);
        }
      }
    }

    if (cursor.isInsideDeadZone) {
      this.deadZoneElapsedMs += deltaTimeMs;
      if (this.deadZoneElapsedMs >= CURSOR_CONFIG.deadZoneHoldMs) {
        context.transitionTo("IDLE");
        return;
      }
    } else {
      this.deadZoneElapsedMs = 0;
    }

    if (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs) {
      context.transitionTo("IDLE");
    }
  }

  public exit(context: PetContext): void {
    context.cursor.disable();
    context.movement.stop();
  }
}
