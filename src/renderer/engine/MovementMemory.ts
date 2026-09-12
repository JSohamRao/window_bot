import { LOCOMOTION_CONFIG } from "../config/locomotionConfig";

export type MovementAction = "NONE" | "CRAWL" | "HOP" | "JUMP" | "FALL" | "LAND" | "CLIMB" | "PERCH";

export interface MovementMemorySnapshot {
  readonly lastMovementType: MovementAction;
  readonly recentMovementTypes: readonly MovementAction[];
  readonly lastJumpTimestamp: number | null;
  readonly lastClimbTimestamp: number | null;
  readonly lastPerchTimestamp: number | null;
}

export class MovementMemory {
  private recent: MovementAction[] = [];
  private lastJumpTimestamp: number | null = null;
  private lastClimbTimestamp: number | null = null;
  private lastPerchTimestamp: number | null = null;

  public record(action: MovementAction, timestamp: number): void {
    if (action === "NONE") return;
    this.recent.unshift(action);
    this.recent.length = Math.min(this.recent.length, LOCOMOTION_CONFIG.recentMovementLimit);
    if (action === "JUMP" || action === "HOP") this.lastJumpTimestamp = timestamp;
    if (action === "CLIMB") this.lastClimbTimestamp = timestamp;
    if (action === "PERCH") this.lastPerchTimestamp = timestamp;
  }

  public canUse(action: MovementAction, timestamp: number): boolean {
    const recentRepeats = this.recent.filter((entry) => entry === action).length;
    if (recentRepeats >= 2) return false;
    const last = action === "JUMP" || action === "HOP"
      ? this.lastJumpTimestamp
      : action === "CLIMB"
        ? this.lastClimbTimestamp
        : action === "PERCH" ? this.lastPerchTimestamp : null;
    const cooldown = action === "JUMP" || action === "HOP" || action === "CLIMB" || action === "PERCH"
      ? LOCOMOTION_CONFIG.cooldownMs[action]
      : 0;
    return last === null || timestamp - last >= cooldown;
  }

  public getSnapshot(): MovementMemorySnapshot {
    return {
      lastMovementType: this.recent[0] ?? "NONE",
      recentMovementTypes: [...this.recent],
      lastJumpTimestamp: this.lastJumpTimestamp,
      lastClimbTimestamp: this.lastClimbTimestamp,
      lastPerchTimestamp: this.lastPerchTimestamp
    };
  }
}
