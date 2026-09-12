import type { AnimationName } from "../animations/thukunaAnimations";
import type { RareEventName } from "../config/rareEventConfig";
import type { SpriteDirection } from "../engine/AnimationController";
import type { CursorAwarenessController } from "../engine/CursorAwarenessController";
import type { EventVisualPort } from "../engine/EventVisualController";
import type { MovementController } from "../engine/MovementController";
import type { LocomotionController } from "../engine/LocomotionController";
import type { MovementAction } from "../engine/MovementMemory";
import type { PersonalitySnapshot } from "../engine/PersonalityController";
import type { PowerPolicySnapshot } from "../engine/PowerPolicyController";
import type { State } from "../engine/StateMachine";
import type { RandomSource, WeightedChoice } from "../utils/random";

export type PetStateName =
  | "IDLE"
  | "CRAWLING"
  | "STARING"
  | "SLEEPING"
  | "LAUGHING"
  | "ANGRY"
  | "RAGE"
  | "DRAGGED"
  | "WATCHING_CURSOR"
  | "CHASE_MOUSE"
  | "JUMPING"
  | "HOPPING"
  | "FALLING"
  | "LANDING"
  | "CLIMBING"
  | "PERCHED"
  | RareEventName;

export type AutonomousStateName =
  | "IDLE" | "CRAWLING" | "STARING" | "SLEEPING" | "LAUGHING" | "ANGRY"
  | "JUMPING" | "HOPPING" | "CLIMBING" | "PERCHED";

export interface PetAnimation {
  play(name: AnimationName, options?: { restart?: boolean }): void;
  playSequence?(names: readonly AnimationName[]): void;
  setDirection(direction: SpriteDirection): void;
  getCurrentAnimation(): AnimationName | null;
  setMotionEnabled(enabled: boolean): void;
  setRageActive(active: boolean): void;
  pause?(): void;
  resume?(): void;
  rebaseClock?(): void;
}

export interface PetContext {
  animation: PetAnimation;
  movement: MovementController;
  locomotion?: LocomotionController;
  cursor: CursorAwarenessController;
  eventVisuals: EventVisualPort;
  random: RandomSource;
  transitionTo(name: PetStateName): void;
  restartCurrentState(): void;
  getStateElapsedMs(): number;
  getBehaviorWeights(): readonly WeightedChoice<AutonomousStateName>[];
  getPersonalitySnapshot(): PersonalitySnapshot;
  onCursorWatch(): void;
  onMouseChase(): void;
  showMouseDialogue(): void;
  showRareEventDialogue(event: RareEventName, bypassCooldown?: boolean): void;
  onRareEventFinished(event: RareEventName): void;
  isAutonomyPaused(): boolean;
  isMouseAwarenessAllowed(): boolean;
  getPowerPolicy(): PowerPolicySnapshot;
  recordMovement?(action: MovementAction): void;
  canUseMovement?(action: MovementAction): boolean;
}

export type PetState = State<PetStateName, PetContext>;
