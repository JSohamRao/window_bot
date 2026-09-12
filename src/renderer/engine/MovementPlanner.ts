import type { PersonalitySnapshot } from "./PersonalityController";
import type { PowerMode } from "./PowerPolicyController";
import type { MovementSnapshot } from "./MovementController";

export type ChaseMovementPlan =
  | "CRAWL_LEFT" | "CRAWL_RIGHT" | "HOP_LEFT" | "HOP_RIGHT"
  | "JUMP_LEFT" | "JUMP_RIGHT" | "CLIMB_UP" | "DROP" | "WATCH" | "GIVE_UP";

export interface ChasePlanInput {
  readonly cursorHorizontalDeltaPx: number | null;
  readonly cursorVerticalDeltaPx: number | null;
  readonly cursorDistancePx: number | null;
  readonly sameDisplay: boolean;
  readonly movement: MovementSnapshot;
  readonly powerMode: PowerMode;
}

export const planCursorMovement = (input: ChasePlanInput): ChaseMovementPlan => {
  if (input.powerMode === "LOW_POWER") return "GIVE_UP";
  if (!input.sameDisplay || input.cursorDistancePx === null || input.cursorDistancePx > 700) return "GIVE_UP";
  const horizontal = input.cursorHorizontalDeltaPx ?? 0;
  const vertical = input.cursorVerticalDeltaPx ?? 0;
  const direction = horizontal < 0 ? "LEFT" : "RIGHT";
  if (!input.movement.grounded && vertical > 80) return "DROP";
  if (vertical < -150) {
    const nearEdge =
      (direction === "LEFT" && input.movement.x !== null && input.movement.workAreaLeft !== null && input.movement.x - input.movement.workAreaLeft <= 10) ||
      (direction === "RIGHT" && input.movement.x !== null && input.movement.workAreaRight !== null && input.movement.workAreaRight - input.movement.x <= 10);
    return nearEdge ? "CLIMB_UP" : `JUMP_${direction}`;
  }
  if (vertical < -55) return `HOP_${direction}`;
  if (Math.abs(horizontal) < 20) return "WATCH";
  return `CRAWL_${direction}`;
};

export const calculateVerticalExplorationChance = (
  personality: PersonalitySnapshot,
  powerMode: PowerMode
): number => {
  if (powerMode === "LOW_POWER") return 0;
  const base = 0.025 + personality.energy * 0.0005 + personality.boredom * 0.0006 + personality.chaos * 0.00025;
  return Math.min(base * (powerMode === "CHAOS" ? 1.45 : 1), 0.16);
};
