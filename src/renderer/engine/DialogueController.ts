import { INTERACTION_CONFIG } from "../config/interactionConfig";
import {
  THUKUNA_DIALOGUE,
  type DialogueCategory
} from "../dialogue/thukunaDialogue";
import {
  mathRandomSource,
  randomBetween,
  type RandomSource
} from "../utils/random";

export interface DialogueSnapshot {
  active: boolean;
  category: DialogueCategory | null;
  line: string | null;
  remainingMs: number;
  cooldownRemainingMs: number;
}

export interface ShowDialogueOptions {
  durationMs?: number;
  bypassCooldown?: boolean;
  replace?: boolean;
  preferredLine?: string;
}

export class DialogueController {
  private activeUntilMs = 0;
  private cooldownUntilMs = 0;
  private category: DialogueCategory | null = null;
  private line: string | null = null;
  private readonly lastLineByCategory = new Map<DialogueCategory, string>();
  private enabled = true;

  public constructor(
    private readonly bubbleElement: HTMLElement,
    private readonly random: RandomSource = mathRandomSource
  ) {
    this.bubbleElement.setAttribute("aria-hidden", "true");
  }

  public show(
    category: DialogueCategory,
    nowMs: number,
    options: ShowDialogueOptions = {}
  ): boolean {
    if (!this.enabled) return false;
    const active = nowMs < this.activeUntilMs;
    if (active && !options.replace) {
      return false;
    }
    if (nowMs < this.cooldownUntilMs && !options.bypassCooldown) {
      return false;
    }

    const line =
      options.preferredLine !== undefined &&
      THUKUNA_DIALOGUE[category].includes(options.preferredLine)
        ? options.preferredLine
        : this.chooseLine(category);
    const durationMs =
      options.durationMs ??
      randomBetween(
        this.random,
        INTERACTION_CONFIG.dialogueDurationMs.min,
        INTERACTION_CONFIG.dialogueDurationMs.max
      );
    const cooldownMs = randomBetween(
      this.random,
      INTERACTION_CONFIG.dialogueCooldownMs.min,
      INTERACTION_CONFIG.dialogueCooldownMs.max
    );

    this.category = category;
    this.line = line;
    this.activeUntilMs = nowMs + durationMs;
    this.cooldownUntilMs = nowMs + cooldownMs;
    this.lastLineByCategory.set(category, line);
    this.bubbleElement.textContent = line;
    this.bubbleElement.dataset.category = category;
    this.bubbleElement.classList.add("is-visible");
    this.bubbleElement.setAttribute("aria-hidden", "false");
    return true;
  }

  public update(nowMs: number): void {
    if (this.category !== null && nowMs >= this.activeUntilMs) {
      this.hide();
    }
  }

  public hide(): void {
    this.category = null;
    this.line = null;
    this.activeUntilMs = 0;
    this.bubbleElement.classList.remove("is-visible");
    this.bubbleElement.setAttribute("aria-hidden", "true");
    delete this.bubbleElement.dataset.category;
  }

  public setEnabled(enabled: boolean): void {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) this.hide();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getSnapshot(nowMs: number): DialogueSnapshot {
    return {
      active: this.category !== null && nowMs < this.activeUntilMs,
      category: this.category,
      line: this.line,
      remainingMs: Math.max(this.activeUntilMs - nowMs, 0),
      cooldownRemainingMs: Math.max(this.cooldownUntilMs - nowMs, 0)
    };
  }

  private chooseLine(category: DialogueCategory): string {
    const lines = THUKUNA_DIALOGUE[category];
    const previous = this.lastLineByCategory.get(category);
    const candidates =
      lines.length > 1 && previous !== undefined
        ? lines.filter((line) => line !== previous)
        : lines;
    const index = Math.floor(this.random.next() * candidates.length);
    return candidates[Math.min(index, candidates.length - 1)];
  }
}
