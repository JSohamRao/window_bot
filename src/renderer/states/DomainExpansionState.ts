import { RARE_EVENT_CONFIG } from "../config/rareEventConfig";
import { randomBetween } from "../utils/random";
import type { PetContext, PetState } from "./PetState";

export class DomainExpansionState implements PetState {
  public readonly name = "DOMAIN_EXPANSION" as const;
  public durationMs: number | null = null;
  private stage = -1;
  private dialogueShown = false;

  public enter(context: PetContext): void {
    const duration = RARE_EVENT_CONFIG.duration.DOMAIN_EXPANSION;
    this.durationMs = randomBetween(context.random, duration.minMs, duration.maxMs);
    context.movement.stop();
    context.cursor.disable();
    context.animation.play("domain_charge", { restart: true });
    context.animation.setMotionEnabled(false);
    context.eventVisuals.activate(this.name, this.durationMs);
    context.eventVisuals.setPhase?.("FREEZE");
    this.stage = 0;
    this.dialogueShown = false;
  }

  public update(context: PetContext, _deltaTimeMs: number): void {
    const elapsed = context.getStateElapsedMs();
    if (elapsed >= 450 && !this.dialogueShown) {
      this.dialogueShown = true;
      context.showRareEventDialogue(this.name, true);
    }
    if (elapsed >= 2_800 && this.stage < 5) {
      this.stage = 5;
      context.animation.play("domain_recover", { restart: true });
      context.eventVisuals.setPhase?.("RECOVER");
    } else if (elapsed >= 2_400 && this.stage < 4) {
      this.stage = 4;
      context.animation.play("domain_collapse", { restart: true });
      context.eventVisuals.setPhase?.("COLLAPSE");
    } else if (elapsed >= 1_600 && this.stage < 3) {
      this.stage = 3;
      context.animation.play("domain_peak", { restart: true });
      context.eventVisuals.setPhase?.("PEAK");
    } else if (elapsed >= 900 && this.stage < 2) {
      this.stage = 2;
      context.animation.play("domain_expand", { restart: true });
      context.eventVisuals.setPhase?.("EXPAND");
    } else if (elapsed >= 700 && this.stage < 1) {
      this.stage = 1;
      context.eventVisuals.setPhase?.("AURA");
    }
    if (this.durationMs !== null && context.getStateElapsedMs() >= this.durationMs) {
      context.transitionTo("IDLE");
    }
  }

  public exit(context: PetContext): void {
    context.eventVisuals.reset();
    context.animation.setMotionEnabled(true);
    this.stage = -1;
    this.dialogueShown = false;
    context.onRareEventFinished(this.name);
  }
}
