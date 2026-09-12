import { INTERACTION_CONFIG } from "../config/interactionConfig";
import type { DialogueCategory } from "../dialogue/thukunaDialogue";
import {
  mathRandomSource,
  weightedChoice,
  type RandomSource
} from "../utils/random";
import type { DialogueController, DialogueSnapshot } from "./DialogueController";
import type { PersonalitySnapshot } from "./PersonalityController";

export type ReactionLevel = "NORMAL" | "ANNOYED" | "ANGRY" | "RAGE";
export type InteractionReaction =
  | "IDLE"
  | "BLINK"
  | "STARING"
  | "LAUGHING"
  | "ANGRY"
  | "RAGE";
export type PostDragReaction = "IDLE" | "ANGRY" | "LAUGHING" | "STARING";

export interface InteractionPoint {
  x: number;
  y: number;
}

export interface DragMetrics {
  durationMs: number;
  distancePx: number;
  longDrag: boolean;
}

export interface PointerMoveResult {
  dragStarted: boolean;
  dragging: boolean;
  dragOrigin: InteractionPoint | null;
}

export interface PointerEndResult {
  kind: "none" | "click" | "drag";
  dragMetrics: DragMetrics | null;
}

export interface InteractionBehaviorPort {
  beginDrag(): void;
  endDrag(reaction: PostDragReaction): void;
  beginInteractionReaction(
    reaction: InteractionReaction,
    durationMs?: number
  ): boolean;
  isRageActive(): boolean;
  isInteractionOverrideActive(): boolean;
  getPersonalitySnapshot(): PersonalitySnapshot;
  onClick(): void;
  onAnnoyedCombo(): void;
  onAngryCombo(): void;
  onRage(): void;
  onDragComplete(metrics: DragMetrics): void;
}

export interface InteractionSnapshot {
  clickCount: number;
  comboResetRemainingMs: number;
  lastClickAgeMs: number | null;
  reactionLevel: ReactionLevel;
  interactionOverride: boolean;
  rageActive: boolean;
  rageCooldownRemainingMs: number;
  dragging: boolean;
  lastDrag: DragMetrics | null;
  dialogue: DialogueSnapshot;
}

interface PointerSession {
  start: InteractionPoint;
  last: InteractionPoint;
  startedAtMs: number;
  totalDistancePx: number;
  dragging: boolean;
  dragDialogueShown: boolean;
}

const distance = (first: InteractionPoint, second: InteractionPoint): number =>
  Math.hypot(second.x - first.x, second.y - first.y);

export const isLongDrag = (metrics: Pick<DragMetrics, "durationMs" | "distancePx">): boolean =>
  metrics.durationMs > INTERACTION_CONFIG.longDragDurationMs ||
  metrics.distancePx > INTERACTION_CONFIG.longDragDistancePx;

export class InteractionController {
  private pointerSession: PointerSession | null = null;
  private clickCount = 0;
  private comboResetAtMs = 0;
  private lastClickAtMs: number | null = null;
  private readonly firedThresholds = new Set<number>();
  private reactionLevel: ReactionLevel = "NORMAL";
  private rageCooldownUntilMs = 0;
  private lastDrag: DragMetrics | null = null;
  private nowMs = 0;

  public constructor(
    private readonly behavior: InteractionBehaviorPort,
    private readonly dialogue: DialogueController,
    private readonly random: RandomSource = mathRandomSource,
    private readonly onChange?: () => void
  ) {}

  public pointerDown(
    button: number,
    point: InteractionPoint,
    nowMs: number
  ): boolean {
    this.nowMs = nowMs;
    if (button !== 0 || this.pointerSession !== null) {
      return false;
    }
    this.pointerSession = {
      start: point,
      last: point,
      startedAtMs: nowMs,
      totalDistancePx: 0,
      dragging: false,
      dragDialogueShown: false
    };
    return true;
  }

  public pointerMove(point: InteractionPoint, nowMs: number): PointerMoveResult {
    this.nowMs = nowMs;
    const session = this.pointerSession;
    if (session === null) {
      return { dragStarted: false, dragging: false, dragOrigin: null };
    }

    session.totalDistancePx += distance(session.last, point);
    session.last = point;
    let dragStarted = false;
    if (
      !session.dragging &&
      distance(session.start, point) >= INTERACTION_CONFIG.dragThresholdPx
    ) {
      session.dragging = true;
      dragStarted = true;
      this.behavior.beginDrag();
      if (this.random.next() < 0.45) {
        session.dragDialogueShown = this.dialogue.show("dragged", nowMs);
      }
      this.emitChange();
    }

    return {
      dragStarted,
      dragging: session.dragging,
      dragOrigin: dragStarted ? session.start : null
    };
  }

  public pointerUp(point: InteractionPoint, nowMs: number): PointerEndResult {
    this.nowMs = nowMs;
    const session = this.pointerSession;
    if (session === null) {
      return { kind: "none", dragMetrics: null };
    }
    session.totalDistancePx += distance(session.last, point);
    this.pointerSession = null;

    if (
      !session.dragging &&
      distance(session.start, point) >= INTERACTION_CONFIG.dragThresholdPx
    ) {
      session.dragging = true;
      this.behavior.beginDrag();
    }

    if (!session.dragging) {
      this.registerClick(nowMs);
      this.emitChange();
      return { kind: "click", dragMetrics: null };
    }

    const metrics = this.createDragMetrics(session, nowMs);
    this.lastDrag = metrics;
    const reaction = weightedChoice<PostDragReaction>(
      this.random,
      metrics.longDrag
        ? INTERACTION_CONFIG.longDropWeights
        : INTERACTION_CONFIG.normalDropWeights
    );
    this.behavior.onDragComplete(metrics);
    this.behavior.endDrag(reaction);
    if (!session.dragDialogueShown && this.random.next() < 0.6) {
      this.dialogue.show("dropped", nowMs);
    }
    this.emitChange();
    return { kind: "drag", dragMetrics: metrics };
  }

  public pointerCancel(point: InteractionPoint, nowMs: number): PointerEndResult {
    this.nowMs = nowMs;
    const session = this.pointerSession;
    if (session === null) {
      return { kind: "none", dragMetrics: null };
    }
    session.totalDistancePx += distance(session.last, point);
    this.pointerSession = null;
    if (!session.dragging) {
      return { kind: "none", dragMetrics: null };
    }
    const metrics = this.createDragMetrics(session, nowMs);
    this.lastDrag = metrics;
    this.behavior.onDragComplete(metrics);
    this.behavior.endDrag("IDLE");
    this.emitChange();
    return { kind: "drag", dragMetrics: metrics };
  }

  public update(nowMs: number): void {
    this.nowMs = nowMs;
    let changed = false;
    if (this.clickCount > 0 && nowMs >= this.comboResetAtMs) {
      this.resetCombo();
      changed = true;
    }
    const dialogueCategoryBeforeUpdate = this.dialogue.getSnapshot(nowMs).category;
    this.dialogue.update(nowMs);
    if (
      changed ||
      dialogueCategoryBeforeUpdate !== this.dialogue.getSnapshot(nowMs).category
    ) {
      this.emitChange();
    }
  }

  public forceRage(nowMs: number): void {
    this.nowMs = nowMs;
    this.triggerRage(nowMs, true, false);
    this.emitChange();
  }

  public showRandomDialogue(nowMs: number): void {
    this.nowMs = nowMs;
    const categories: readonly DialogueCategory[] = [
      "clicked",
      "annoyed",
      "angry",
      "dragged",
      "dropped",
      "sleeping",
      "laughing"
    ];
    const index = Math.floor(this.random.next() * categories.length);
    this.dialogue.show(categories[Math.min(index, categories.length - 1)], nowMs, {
      bypassCooldown: true,
      replace: true
    });
    this.emitChange();
  }

  public hideDialogue(): void {
    this.dialogue.hide();
    this.emitChange();
  }

  public isDragging(): boolean {
    return this.pointerSession?.dragging ?? false;
  }

  public hasPointerSession(): boolean {
    return this.pointerSession !== null;
  }

  public cancelPointerSession(nowMs: number): void {
    this.nowMs = nowMs;
    if (this.pointerSession?.dragging) this.behavior.endDrag("IDLE");
    this.pointerSession = null;
    this.emitChange();
  }

  public getSnapshot(nowMs = this.nowMs): InteractionSnapshot {
    const rageActive = this.behavior.isRageActive();
    return {
      clickCount: this.clickCount,
      comboResetRemainingMs: Math.max(this.comboResetAtMs - nowMs, 0),
      lastClickAgeMs:
        this.lastClickAtMs === null ? null : Math.max(nowMs - this.lastClickAtMs, 0),
      reactionLevel: this.reactionLevel,
      interactionOverride: this.behavior.isInteractionOverrideActive(),
      rageActive,
      rageCooldownRemainingMs: Math.max(this.rageCooldownUntilMs - nowMs, 0),
      dragging: this.isDragging(),
      lastDrag: this.lastDrag,
      dialogue: this.dialogue.getSnapshot(nowMs)
    };
  }

  private registerClick(nowMs: number): void {
    if (this.clickCount > 0 && nowMs >= this.comboResetAtMs) {
      this.resetCombo();
    }
    this.clickCount += 1;
    this.lastClickAtMs = nowMs;
    this.comboResetAtMs = nowMs + INTERACTION_CONFIG.clickComboWindowMs;
    this.behavior.onClick();

    if (this.behavior.isRageActive()) {
      return;
    }

    if (this.clickCount === INTERACTION_CONFIG.rageThreshold) {
      this.fireThreshold(INTERACTION_CONFIG.rageThreshold, () => {
        this.triggerRage(nowMs, false, true);
      });
      return;
    }
    if (this.clickCount === INTERACTION_CONFIG.angryThreshold) {
      this.fireThreshold(INTERACTION_CONFIG.angryThreshold, () => {
        const started = this.behavior.beginInteractionReaction(
          "ANGRY",
          INTERACTION_CONFIG.reactionDurationMs.angry
        );
        if (started) {
          this.behavior.onAngryCombo();
          this.reactionLevel = "ANGRY";
          this.dialogue.show("angry", nowMs, {
            bypassCooldown: true,
            replace: true
          });
        }
      });
      return;
    }
    if (this.clickCount === INTERACTION_CONFIG.annoyedThreshold) {
      this.fireThreshold(INTERACTION_CONFIG.annoyedThreshold, () => {
        const started = this.behavior.beginInteractionReaction(
          "ANGRY",
          INTERACTION_CONFIG.reactionDurationMs.annoyed
        );
        if (started) {
          this.behavior.onAnnoyedCombo();
          this.reactionLevel = "ANNOYED";
          this.dialogue.show("annoyed", nowMs, {
            bypassCooldown: true,
            replace: true
          });
        }
      });
      return;
    }
    if (this.clickCount < INTERACTION_CONFIG.annoyedThreshold) {
      this.triggerNormalReaction(nowMs);
    }
  }

  private triggerNormalReaction(nowMs: number): void {
    this.reactionLevel = "NORMAL";
    const kind = weightedChoice(
      this.random,
      INTERACTION_CONFIG.normalReactionWeights
    );
    if (kind === "DIALOGUE") {
      const started = this.behavior.beginInteractionReaction(
        "IDLE",
        INTERACTION_CONFIG.reactionDurationMs.idle
      );
      if (started) {
        this.dialogue.show(this.chooseClickedDialogueCategory(), nowMs);
      }
      return;
    }
    if (kind === "STRONG") {
      const started = this.behavior.beginInteractionReaction(
        "ANGRY",
        INTERACTION_CONFIG.reactionDurationMs.annoyed
      );
      if (started) {
        this.dialogue.show(this.chooseClickedDialogueCategory(), nowMs);
      }
      return;
    }

    const reaction = weightedChoice(
      this.random,
      INTERACTION_CONFIG.visualReactionWeights
    );
    const duration =
      reaction === "BLINK"
        ? INTERACTION_CONFIG.reactionDurationMs.blink
        : reaction === "STARING"
          ? INTERACTION_CONFIG.reactionDurationMs.stare
          : INTERACTION_CONFIG.reactionDurationMs.laugh;
    this.behavior.beginInteractionReaction(reaction, duration);
  }

  private triggerRage(
    nowMs: number,
    bypassCooldown: boolean,
    affectPersonality: boolean
  ): boolean {
    if (!bypassCooldown && nowMs < this.rageCooldownUntilMs) {
      return false;
    }
    if (!this.behavior.beginInteractionReaction("RAGE")) {
      return false;
    }
    if (affectPersonality) {
      this.behavior.onRage();
    }
    this.reactionLevel = "RAGE";
    this.rageCooldownUntilMs = nowMs + INTERACTION_CONFIG.rageCooldownMs;
    this.dialogue.show("rage", nowMs, {
      durationMs: INTERACTION_CONFIG.rageDialogueDurationMs,
      bypassCooldown: true,
      replace: true
    });
    return true;
  }

  private chooseClickedDialogueCategory(): DialogueCategory {
    const personality = this.behavior.getPersonalitySnapshot();
    const roll = this.random.next();
    if (personality.irritation >= 60 && roll < 0.35) {
      return "angry";
    }
    if (personality.irritation >= 35 && roll < 0.3) {
      return "annoyed";
    }
    if (personality.energy < 20 && roll < 0.25) {
      return "sleeping";
    }
    if (personality.chaos >= 70 && roll < 0.2) {
      return "laughing";
    }
    return "clicked";
  }

  private fireThreshold(threshold: number, action: () => void): void {
    if (this.firedThresholds.has(threshold)) {
      return;
    }
    this.firedThresholds.add(threshold);
    action();
  }

  private resetCombo(): void {
    this.clickCount = 0;
    this.comboResetAtMs = 0;
    this.firedThresholds.clear();
    this.reactionLevel = "NORMAL";
  }

  private createDragMetrics(session: PointerSession, nowMs: number): DragMetrics {
    const metrics = {
      durationMs: Math.max(nowMs - session.startedAtMs, 0),
      distancePx: session.totalDistancePx
    };
    return { ...metrics, longDrag: isLongDrag(metrics) };
  }

  private emitChange(): void {
    this.onChange?.();
  }
}
