import type { AnimationName } from "../animations/thukunaAnimations";
import {
  DEFAULT_PLATFORM_CAPABILITIES,
  resolveMovementCapabilityPolicy,
  type MovementCapabilityPolicy,
  type PlatformCapabilities
} from "../../shared/platform";
import {
  DEFAULT_THUKUNA_SETTINGS,
  sanitizeThukunaSettings,
  type ThukunaSettings
} from "../../shared/settings";
import { BEHAVIOR_CONFIG } from "../config/behaviorConfig";
import { INTERACTION_CONFIG } from "../config/interactionConfig";
import { LOCOMOTION_CONFIG } from "../config/locomotionConfig";
import { PERSONALITY_CONFIG } from "../config/personalityConfig";
import {
  RARE_EVENT_NAMES,
  type RareEventName
} from "../config/rareEventConfig";
import { AngryState } from "../states/AngryState";
import { ChaosRunState } from "../states/ChaosRunState";
import { ChaseMouseState } from "../states/ChaseMouseState";
import { CreepyFreezeState } from "../states/CreepyFreezeState";
import { CrawlingState } from "../states/CrawlingState";
import { DomainExpansionState } from "../states/DomainExpansionState";
import { DraggedState } from "../states/DraggedState";
import { FallenState } from "../states/FallenState";
import { IdleState } from "../states/IdleState";
import { LaughingState } from "../states/LaughingState";
import { RageState } from "../states/RageState";
import type {
  PetAnimation,
  AutonomousStateName,
  PetContext,
  PetStateName
} from "../states/PetState";
import { SleepingState } from "../states/SleepingState";
import { StaringState } from "../states/StaringState";
import { SprintState } from "../states/SprintState";
import { WatchingCursorState } from "../states/WatchingCursorState";
import { ZoomStareState } from "../states/ZoomStareState";
import { JumpingState } from "../states/JumpingState";
import { FallingState } from "../states/FallingState";
import { ClimbingState } from "../states/ClimbingState";
import { PerchedState } from "../states/PerchedState";
import { LandingState } from "../states/LandingState";
import {
  mathRandomSource,
  type RandomSource
} from "../utils/random";
import { calculateBehaviorWeights } from "../utils/behaviorWeights";
import type { AnimationController } from "./AnimationController";
import {
  CursorAwarenessController,
  type CursorAwarenessSnapshot,
  type CursorPositionProvider
} from "./CursorAwarenessController";
import type { EventVisualPort, EventVisualSnapshot } from "./EventVisualController";
import {
  MovementController,
  type MovementApi
} from "./MovementController";
import { StateMachine } from "./StateMachine";
import {
  PersonalityController,
  type PersonalitySnapshot
} from "./PersonalityController";
import {
  RareEventController,
  type RareEventSnapshot
} from "./RareEventController";
import type {
  DragMetrics,
  InteractionBehaviorPort,
  InteractionReaction,
  PostDragReaction
} from "./InteractionController";
import {
  PowerPolicyController,
  type PowerPolicySnapshot
} from "./PowerPolicyController";
import { LocomotionController, type LocomotionSnapshot } from "./LocomotionController";
import {
  MovementMemory,
  type MovementAction,
  type MovementMemorySnapshot
} from "./MovementMemory";
import { planCursorMovement, type ChaseMovementPlan } from "./MovementPlanner";
import {
  copySystemAwarenessSnapshot,
  createUnknownSystemAwarenessSnapshot,
  type SystemAwarenessSnapshot
} from "../../shared/systemAwareness";
import {
  resolveSystemRuntimeContext,
  type SystemRuntimeContext,
  type SystemSafetyBlockReason
} from "./SystemAwarenessController";

export interface WindowPosition {
  x: number;
  y: number;
}

export interface ThukunaSnapshot {
  state: PetStateName | null;
  stateElapsedMs: number;
  stateDurationMs: number | null;
  autonomyPaused: boolean;
  moving: boolean;
  movementSpeedPxPerSecond: number;
  velocityX: number;
  velocityY: number;
  movementMode: string;
  grounded: boolean;
  floorY: number | null;
  locomotion: LocomotionSnapshot;
  movementMemory: MovementMemorySnapshot;
  windowX: number;
  windowY: number;
  nearLeftEdge: boolean;
  nearRightEdge: boolean;
  cursorPlan: ChaseMovementPlan;
  interactionOverride: boolean;
  rageActive: boolean;
  personality: PersonalitySnapshot;
  nextBehaviorWeights: Readonly<Record<AutonomousStateName, number>>;
  cursor: CursorAwarenessSnapshot;
  rareEvent: RareEventSnapshot;
  eventVisual: EventVisualSnapshot;
  settings: ThukunaSettings;
  powerPolicy: PowerPolicySnapshot;
  platformCapabilities: PlatformCapabilities;
  movementCapabilityPolicy: MovementCapabilityPolicy;
  visible: boolean;
  developmentOverrideActive: boolean;
  systemAwareness: SystemAwarenessSnapshot;
  systemRuntimeContext: SystemRuntimeContext;
  systemSafetyBlockReason: SystemSafetyBlockReason | null;
}

export interface DevelopmentForceOptions {
  readonly bypassProductPolicy?: boolean;
}

type SnapshotListener = (snapshot: ThukunaSnapshot) => void;
const WAKE_DURATION_MS = 510;

const NO_EVENT_VISUALS: EventVisualPort = {
  activate: () => undefined,
  reset: () => undefined,
  getSnapshot: () => ({
    activeEvent: null,
    durationMs: 0,
    phase: "NONE",
    activationCount: 0,
    cleanupCount: 0
  })
};

export const isRareEventState = (
  state: PetStateName | null
): state is RareEventName =>
  state !== null && RARE_EVENT_NAMES.includes(state as RareEventName);

const isAutonomousState = (
  state: PetStateName
): state is AutonomousStateName =>
  state === "IDLE" ||
  state === "CRAWLING" ||
  state === "STARING" ||
  state === "SLEEPING" ||
  state === "LAUGHING" ||
  state === "ANGRY" ||
  state === "JUMPING" ||
  state === "HOPPING" ||
  state === "CLIMBING" ||
  state === "PERCHED";

const isVerticalLocomotionState = (state: PetStateName | null): boolean =>
  state === "JUMPING" ||
  state === "HOPPING" ||
  state === "FALLING" ||
  state === "LANDING" ||
  state === "CLIMBING" ||
  state === "PERCHED";

const isExploratoryVerticalState = (state: PetStateName | null): boolean =>
  state === "JUMPING" ||
  state === "HOPPING" ||
  state === "CLIMBING" ||
  state === "PERCHED";

export class ThukunaController implements InteractionBehaviorPort {
  private readonly movement: MovementController;
  private readonly locomotion: LocomotionController;
  private readonly movementMemory = new MovementMemory();
  private readonly stateMachine: StateMachine<PetStateName, PetContext>;
  private readonly context: PetContext;
  private readonly personality: PersonalityController;
  private readonly cursor: CursorAwarenessController;
  private readonly rareEvents: RareEventController;
  private readonly powerPolicy = new PowerPolicyController(DEFAULT_THUKUNA_SETTINGS);
  private movementCapabilityPolicy: MovementCapabilityPolicy;
  private readonly recentBehaviorStates: AutonomousStateName[] = [];
  private frameRequestId: number | null = null;
  private previousTimestamp: number | null = null;
  private debugElapsedMs = 0;
  private autonomyPaused = false;
  private visible = true;
  private settings: ThukunaSettings = { ...DEFAULT_THUKUNA_SETTINGS };
  private debugLogging = false;
  private started = false;
  private interactionOverride = false;
  private interactionOverrideElapsedMs = 0;
  private interactionOverrideDurationMs = 0;
  private bypassMovementCooldown = false;
  private developmentPolicyTransition = false;
  private developmentOverrideActive = false;
  private interactionUpdate: ((timestamp: number) => void) | null = null;
  private personalityAccumulatorMs = 0;
  private mouseDialogueHandler: (() => void) | null = null;
  private rareEventDialogueHandler:
    | ((event: RareEventName, bypassCooldown: boolean) => void)
    | null = null;
  private systemAwareness = createUnknownSystemAwarenessSnapshot();
  private systemRuntimeContext = resolveSystemRuntimeContext(this.systemAwareness);
  private systemRuntimePaused = false;

  public constructor(
    animation: AnimationController<AnimationName>,
    movementApi: MovementApi,
    private readonly getWindowPosition: () => WindowPosition,
    private readonly onSnapshot?: SnapshotListener,
    random: RandomSource = mathRandomSource,
    cursorProvider: CursorPositionProvider = {
      getCursorPosition: async () => ({ x: 0, y: 0, sameDisplay: false })
    },
    private readonly eventVisuals: EventVisualPort = NO_EVENT_VISUALS,
    locomotionVisualLayer?: HTMLElement,
    private readonly platformCapabilities: PlatformCapabilities =
      DEFAULT_PLATFORM_CAPABILITIES
  ) {
    this.movementCapabilityPolicy = resolveMovementCapabilityPolicy(
      this.platformCapabilities,
      this.settings
    );
    this.personality = new PersonalityController();
    this.rareEvents = new RareEventController(random);
    this.movement = new MovementController(
      movementApi,
      BEHAVIOR_CONFIG.movementUpdatesPerSecond
    );
    this.locomotion = new LocomotionController(this.movement, locomotionVisualLayer);
    this.cursor = new CursorAwarenessController(
      cursorProvider,
      () => {
        const movement = this.movement.getSnapshot();
        const position = this.getWindowPosition();
        return {
          windowX: movement.x ?? position.x,
          windowY: movement.y ?? position.y
        };
      },
      random,
      () => this.emitSnapshot(),
      () => this.handleCursorFailure()
    );
    const petAnimation: PetAnimation = animation;
    this.stateMachine = new StateMachine(
      [
        new IdleState(),
        new CrawlingState(),
        new StaringState(),
        new SleepingState(),
        new LaughingState(),
        new AngryState(),
        new WatchingCursorState(),
        new ChaseMouseState(),
        new JumpingState("JUMP"),
        new JumpingState("HOP"),
        new FallingState(),
        new LandingState(),
        new ClimbingState(),
        new PerchedState(),
        new SprintState(),
        new FallenState(),
        new CreepyFreezeState(),
        new ZoomStareState(),
        new ChaosRunState(),
        new DomainExpansionState(),
        new RageState(),
        new DraggedState()
      ],
      (previous, next) => {
        if (
          this.developmentOverrideActive &&
          (next === "IDLE" || next === "DRAGGED" || next === "RAGE")
        ) {
          this.developmentOverrideActive = false;
        }
        if (previous !== null) {
          this.personality.onStateExited(previous);
        }
        if (isAutonomousState(next) && next !== "IDLE") {
          this.recentBehaviorStates.unshift(next);
          this.recentBehaviorStates.length = Math.min(
            this.recentBehaviorStates.length,
            PERSONALITY_CONFIG.recentStateLimit
          );
        }
        if (
          next !== "IDLE" &&
          next !== "WATCHING_CURSOR" &&
          next !== "CHASE_MOUSE"
        ) {
          this.cursor.disable();
        }
        if (this.debugLogging) {
          console.debug(`[THUKUNA] ${previous ?? "START"} -> ${next}`);
        }
      }
    );
    this.context = {
      animation: petAnimation,
      movement: this.movement,
      locomotion: this.locomotion,
      cursor: this.cursor,
      eventVisuals: this.eventVisuals,
      random,
      transitionTo: (name) => {
        this.transitionToSupportedState(name);
        this.emitSnapshot();
      },
      restartCurrentState: () => {
        this.stateMachine.restart(this.context);
        this.emitSnapshot();
      },
      getStateElapsedMs: () => this.stateMachine.getElapsedMs(),
      getBehaviorWeights: () => this.getBehaviorWeights(),
      getPersonalitySnapshot: () => this.personality.getSnapshot(),
      onCursorWatch: () => this.personality.onCursorWatch(),
      onMouseChase: () => this.personality.onMouseChase(),
      showMouseDialogue: () => {
        if (this.settings.dialogueEnabled) this.mouseDialogueHandler?.();
      },
      showRareEventDialogue: (event, bypassCooldown = false) =>
        this.settings.dialogueEnabled
          ? this.rareEventDialogueHandler?.(event, bypassCooldown)
          : undefined,
      onRareEventFinished: (event) => {
        this.personality.onRareEventFinished(event);
        this.rareEvents.completeEvent(event, this.personality.getSnapshot());
      },
      isAutonomyPaused: () =>
        this.systemRuntimePaused ||
        (!this.developmentPolicyTransition && (this.autonomyPaused || !this.visible)),
      isMouseAwarenessAllowed: () =>
        !this.systemRuntimePaused && (this.developmentPolicyTransition
          ? this.visible && this.platformCapabilities.supportsCursorScreenPosition
          : this.visible &&
            !this.autonomyPaused &&
            this.powerPolicy.getSnapshot().mouseAwarenessAllowed &&
            this.movementCapabilityPolicy.cursorScreenPositionAllowed),
      getPowerPolicy: () => this.powerPolicy.getSnapshot(),
      recordMovement: (action) =>
        this.movementMemory.record(action, performance.now()),
      canUseMovement: (action) =>
        (this.developmentPolicyTransition
          ? this.isMovementActionHardAllowed(action)
          : this.isMovementActionAllowed(action)) &&
        (this.bypassMovementCooldown ||
          this.movementMemory.canUse(action, performance.now()))
    };
  }

  public start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.stateMachine.start("IDLE", this.context);
    this.applyRareEventPolicy();
    this.rareEvents.start(this.personality.getSnapshot());
    if (!this.canScheduleRareEvents()) this.rareEvents.suspend();
    this.emitSnapshot();
    if (this.platformCapabilities.supportsAbsoluteWindowPosition) {
      void this.movement.syncPosition().then(() => this.emitSnapshot());
    }
    if (this.systemRuntimePaused) this.context.animation.pause?.();
    if (this.visible && !this.systemRuntimePaused) {
      this.frameRequestId = requestAnimationFrame(this.tick);
    }
  }

  public applySystemAwareness(snapshot: SystemAwarenessSnapshot): void {
    const previousAwareness = this.systemAwareness;
    const wasPaused = this.systemRuntimePaused;
    this.systemAwareness = copySystemAwarenessSnapshot(snapshot);
    this.systemRuntimeContext = resolveSystemRuntimeContext(snapshot);
    this.systemRuntimePaused = this.systemRuntimeContext.hardPaused;
    this.powerPolicy.updateSystemAwareness(snapshot);
    this.cursor.setIntervalMultiplier(
      this.systemRuntimeContext.cursorIntervalMultiplier
    );
    this.applyRareEventPolicy();
    if (!this.started) return;

    if (this.systemRuntimePaused) {
      if (this.frameRequestId !== null) {
        cancelAnimationFrame(this.frameRequestId);
        this.frameRequestId = null;
      }
      this.rebaseTiming();
      this.locomotion.cancel();
      this.movement.stop();
      this.cursor.disable();
      this.clearInteractionOverride();
      if (this.stateMachine.getCurrentState() !== "IDLE") {
        this.stateMachine.transition("IDLE", this.context);
      }
      this.context.animation.pause?.();
      this.rareEvents.suspend();
      this.emitSnapshot();
      return;
    }

    if (wasPaused) {
      this.rebaseTiming();
      this.stateMachine.restart(this.context);
      if (this.canScheduleRareEvents()) {
        this.rareEvents.resume(this.personality.getSnapshot());
      }
      void this.movement.syncPosition().then(() => this.emitSnapshot());
      if (this.visible && this.frameRequestId === null) {
        this.frameRequestId = requestAnimationFrame(this.tick);
      }
    } else if (
      snapshot.lastTransition?.kind === "display" ||
      (snapshot.lastTransition?.kind === "session" &&
        snapshot.lastTransition.from === "suspended")
    ) {
      this.rebaseTiming();
      void this.movement.syncPosition().then(() => this.emitSnapshot());
    }

    if (
      previousAwareness.activityState !== snapshot.activityState ||
      previousAwareness.powerSource !== snapshot.powerSource
    ) {
      this.applyRareEventPolicy();
    }
    this.emitSnapshot();
  }

  public rebaseTiming(): void {
    this.previousTimestamp = null;
    this.debugElapsedMs = 0;
    this.context.animation.rebaseClock?.();
  }

  public applySettings(value: ThukunaSettings): void {
    const previous = this.settings;
    this.settings = sanitizeThukunaSettings(value);
    this.powerPolicy.update(this.settings);
    this.movementCapabilityPolicy = resolveMovementCapabilityPolicy(
      this.platformCapabilities,
      this.settings
    );
    this.autonomyPaused = !this.settings.autonomyEnabled;
    this.applyRareEventPolicy();
    if (!this.started) return;

    const state = this.stateMachine.getCurrentState();
    const policy = this.powerPolicy.getSnapshot();
    const autonomyChanged =
      previous.autonomyEnabled !== this.settings.autonomyEnabled;
    const autonomousFeatureState =
      ((state === "WATCHING_CURSOR" || state === "CHASE_MOUSE") &&
        !policy.mouseAwarenessAllowed) ||
      (isRareEventState(state) && !policy.rareEventsAllowed) ||
      (policy.mode === "LOW_POWER" &&
        (state === "CRAWLING" || isExploratoryVerticalState(state))) ||
      (state !== null && !this.isStateSupported(state));
    if (!this.visible || this.autonomyPaused || autonomousFeatureState) {
      this.locomotion.cancel();
      this.movement.stop();
      this.cursor.disable();
      if (
        (autonomousFeatureState || autonomyChanged) &&
        !this.interactionOverride &&
        state !== "DRAGGED" &&
        state !== "RAGE" &&
        state !== "IDLE"
      ) {
        this.stateMachine.transition("IDLE", this.context);
      }
    }

    if (!this.canScheduleRareEvents()) {
      this.rareEvents.suspend();
    } else if (
      !previous.rareEventsEnabled ||
      previous.lowPowerMode ||
      previous.chaosMode !== this.settings.chaosMode ||
      previous.autonomyEnabled !== this.settings.autonomyEnabled
    ) {
      this.rareEvents.resume(this.personality.getSnapshot());
    }

    if (
      this.visible &&
      !this.autonomyPaused &&
      this.stateMachine.getCurrentState() === "IDLE"
    ) {
      if (policy.mouseAwarenessAllowed) this.cursor.enableIdleAwareness();
      else this.cursor.disable();
      if (
        previous.lowPowerMode !== this.settings.lowPowerMode ||
        previous.chaosMode !== this.settings.chaosMode
      ) {
        this.stateMachine.restart(this.context);
      }
    }
    this.emitSnapshot();
  }

  public setRuntimeVisible(visible: boolean): void {
    if (this.visible === visible) return;
    this.visible = visible;
    if (!this.started) return;
    if (!visible) {
      if (this.frameRequestId !== null) {
        cancelAnimationFrame(this.frameRequestId);
        this.frameRequestId = null;
      }
      this.previousTimestamp = null;
      this.locomotion.cancel();
      this.movement.stop();
      this.cursor.disable();
      this.clearInteractionOverride();
      if (this.stateMachine.getCurrentState() !== "IDLE") {
        this.stateMachine.transition("IDLE", this.context);
      }
      this.context.animation.pause?.();
      this.rareEvents.suspend();
      this.emitSnapshot();
      return;
    }

    if (this.systemRuntimePaused) {
      this.context.animation.pause?.();
      this.emitSnapshot();
      return;
    }
    this.stateMachine.restart(this.context);
    if (this.canScheduleRareEvents()) {
      this.rareEvents.resume(this.personality.getSnapshot());
    }
    this.previousTimestamp = null;
    if (this.frameRequestId === null) {
      this.frameRequestId = requestAnimationFrame(this.tick);
    }
    this.emitSnapshot();
  }

  public prepareForPositionReset(): void {
    if (!this.started) return;
    this.locomotion.cancel();
    this.movement.stop();
    this.cursor.disable();
    this.clearInteractionOverride();
    const state = this.stateMachine.getCurrentState();
    if (state !== "DRAGGED" && state !== "RAGE") {
      this.transitionOrRestart("IDLE");
    }
    void this.movement.syncPosition().then(() => this.emitSnapshot());
    this.emitSnapshot();
  }

  public pauseAutonomy(): void {
    if (this.autonomyPaused) {
      return;
    }
    this.settings = { ...this.settings, autonomyEnabled: false };
    this.autonomyPaused = true;
    this.locomotion.cancel();
    this.cursor.disable();
    const state = this.stateMachine.getCurrentState();
    if (
      state === "WATCHING_CURSOR" ||
      state === "CHASE_MOUSE" ||
      isRareEventState(state)
    ) {
      this.movement.stop();
      this.stateMachine.transition("IDLE", this.context);
    } else {
      this.movement.pause();
    }
    this.rareEvents.suspend();
    this.emitSnapshot();
  }

  public resumeAutonomy(): void {
    if (!this.autonomyPaused) {
      return;
    }
    this.settings = { ...this.settings, autonomyEnabled: true };
    this.autonomyPaused = false;
    if (this.canScheduleRareEvents()) {
      this.rareEvents.resume(this.personality.getSnapshot());
    }
    if (this.stateMachine.getCurrentState() === "CRAWLING") {
      this.movement.resume();
    } else if (this.stateMachine.getCurrentState() === "IDLE") {
      if (this.powerPolicy.getSnapshot().mouseAwarenessAllowed) {
        this.cursor.enableIdleAwareness();
      }
    }
    this.emitSnapshot();
  }

  public toggleAutonomy(): boolean {
    if (this.autonomyPaused) {
      this.resumeAutonomy();
    } else {
      this.pauseAutonomy();
    }
    return !this.autonomyPaused;
  }

  public beginDrag(): void {
    if (
      !this.started ||
      this.systemRuntimePaused ||
      this.stateMachine.getCurrentState() === "DRAGGED"
    ) {
      return;
    }
    this.locomotion.cancel();
    this.clearInteractionOverride();
    this.stateMachine.transition("DRAGGED", this.context);
    this.emitSnapshot();
  }

  public endDrag(reaction: PostDragReaction = "IDLE"): void {
    if (this.stateMachine.getCurrentState() !== "DRAGGED") {
      return;
    }
    this.stateMachine.transition("IDLE", this.context);
    if (reaction !== "IDLE") {
      const durationMs =
        reaction === "ANGRY"
          ? INTERACTION_CONFIG.reactionDurationMs.droppedAngry
          : reaction === "LAUGHING"
            ? INTERACTION_CONFIG.reactionDurationMs.droppedLaugh
            : INTERACTION_CONFIG.reactionDurationMs.droppedStare;
      this.beginInteractionReaction(reaction, durationMs);
    }
    this.emitSnapshot();
    void this.movement.syncPosition().then(() => this.emitSnapshot());
  }

  public beginInteractionReaction(
    reaction: InteractionReaction,
    durationMs?: number
  ): boolean {
    const currentState = this.stateMachine.getCurrentState();
    if (!this.started || this.systemRuntimePaused || currentState === "DRAGGED") {
      return false;
    }
    if (currentState === "RAGE" && reaction !== "RAGE") {
      return false;
    }

    this.locomotion.cancel();
    this.movement.stop();
    this.cursor.disable();
    this.interactionOverride = true;
    this.interactionOverrideElapsedMs = 0;
    this.interactionOverrideDurationMs =
      durationMs ?? INTERACTION_CONFIG.rageDurationMs;

    if (reaction === "BLINK") {
      this.transitionOrRestart("IDLE");
      this.context.animation.play("blink", { restart: true });
    } else {
      this.transitionOrRestart(reaction);
    }
    this.emitSnapshot();
    return true;
  }

  public isRageActive(): boolean {
    return this.stateMachine.getCurrentState() === "RAGE";
  }

  public isInteractionOverrideActive(): boolean {
    return this.interactionOverride;
  }

  public onClick(): void {
    if (this.systemRuntimePaused) return;
    this.personality.onClick();
    this.emitSnapshot();
  }

  public onAnnoyedCombo(): void {
    if (this.systemRuntimePaused) return;
    this.personality.onAnnoyedCombo();
    this.emitSnapshot();
  }

  public onAngryCombo(): void {
    if (this.systemRuntimePaused) return;
    this.personality.onAngryCombo();
    this.emitSnapshot();
  }

  public onRage(): void {
    if (this.systemRuntimePaused) return;
    this.personality.onRage();
    this.emitSnapshot();
  }

  public onDragComplete(metrics: DragMetrics): void {
    this.personality.onDragComplete(metrics.longDrag);
    this.emitSnapshot();
  }

  public setPersonalityValues(values: Partial<PersonalitySnapshot>): void {
    this.personality.setValues(values);
    this.emitSnapshot();
  }

  public resetPersonality(): void {
    this.personality.reset();
    this.recentBehaviorStates.length = 0;
    this.emitSnapshot();
  }

  public getPersonalitySnapshot(): PersonalitySnapshot {
    return this.personality.getSnapshot();
  }

  public setMouseDialogueHandler(handler: (() => void) | null): void {
    this.mouseDialogueHandler = handler;
  }

  public setRareEventDialogueHandler(
    handler: ((event: RareEventName, bypassCooldown: boolean) => void) | null
  ): void {
    this.rareEventDialogueHandler = handler;
  }

  public forceRareEvent(
    event: RareEventName,
    options: DevelopmentForceOptions = {}
  ): boolean {
    const currentState = this.stateMachine.getCurrentState();
    const devOverride = options.bypassProductPolicy === true;
    if (
      !this.started ||
      !this.visible ||
      this.systemRuntimePaused ||
      (!devOverride && this.autonomyPaused) ||
      (!devOverride && !this.powerPolicy.getSnapshot().rareEventsAllowed) ||
      this.interactionOverride ||
      currentState === "DRAGGED" ||
      currentState === "RAGE" ||
      isRareEventState(currentState) ||
      isVerticalLocomotionState(currentState) ||
      !(devOverride
        ? this.isRareEventHardSupported(event)
        : this.isRareEventSupported(event)) ||
      !this.rareEvents.forceStart(event)
    ) {
      return false;
    }
    this.cursor.disable();
    this.locomotion.cancel();
    this.movement.stop();
    this.developmentOverrideActive = devOverride;
    this.developmentPolicyTransition = devOverride;
    this.bypassMovementCooldown = devOverride;
    try {
      this.stateMachine.transition(event, this.context);
    } finally {
      this.developmentPolicyTransition = false;
      this.bypassMovementCooldown = false;
    }
    this.emitSnapshot();
    return true;
  }

  public forceCursorBehavior(
    state: "WATCHING_CURSOR" | "CHASE_MOUSE",
    options: DevelopmentForceOptions = {}
  ): boolean {
    const currentState = this.stateMachine.getCurrentState();
    const devOverride = options.bypassProductPolicy === true;
    if (
      !this.started ||
      !this.visible ||
      this.systemRuntimePaused ||
      (!devOverride && this.autonomyPaused) ||
      (!devOverride && !this.powerPolicy.getSnapshot().mouseAwarenessAllowed) ||
      !(devOverride
        ? this.platformCapabilities.supportsCursorScreenPosition
        : this.movementCapabilityPolicy.cursorScreenPositionAllowed) ||
      (state === "CHASE_MOUSE" &&
        !(devOverride
          ? this.platformCapabilities.supportsProgrammaticWindowMove
          : this.movementCapabilityPolicy.cursorChaseAllowed)) ||
      currentState === "DRAGGED" ||
      currentState === "RAGE" ||
      isRareEventState(currentState) ||
      isVerticalLocomotionState(currentState)
    ) {
      return false;
    }
    this.clearInteractionOverride();
    this.developmentOverrideActive = devOverride;
    this.developmentPolicyTransition = devOverride;
    this.bypassMovementCooldown = true;
    try {
      this.transitionOrRestart(state);
    } finally {
      this.bypassMovementCooldown = false;
      this.developmentPolicyTransition = false;
    }
    this.emitSnapshot();
    return true;
  }

  public forceLocomotion(
    action:
      | "JUMP"
      | "JUMP_LEFT"
      | "JUMP_RIGHT"
      | "HOP"
      | "FALL"
      | "CLIMB_UP"
      | "CLIMB_DOWN"
      | "PERCH"
      | "LAND",
    options: DevelopmentForceOptions = {}
  ): boolean {
    const state = this.stateMachine.getCurrentState();
    const devOverride = options.bypassProductPolicy === true;
    if (
      !this.started ||
      !this.visible ||
      this.systemRuntimePaused ||
      (!devOverride && this.autonomyPaused) ||
      !(devOverride
        ? this.isForcedLocomotionHardAllowed(action)
        : this.isForcedLocomotionAllowed(action)) ||
      (!devOverride && this.powerPolicy.getSnapshot().mode === "LOW_POWER" &&
        action !== "FALL" &&
        action !== "LAND") ||
      this.interactionOverride ||
      state === "DRAGGED" ||
      state === "RAGE" ||
      isRareEventState(state)
    ) {
      return false;
    }
    const nextState: PetStateName =
      action === "JUMP" || action === "JUMP_LEFT" || action === "JUMP_RIGHT"
        ? "JUMPING"
        : action === "HOP"
          ? "HOPPING"
          : action === "FALL"
            ? "FALLING"
            : action === "CLIMB_UP" || action === "CLIMB_DOWN"
              ? "CLIMBING"
              : action === "PERCH"
                ? "PERCHED"
                : "LANDING";
    if (
      (action === "CLIMB_UP" || action === "CLIMB_DOWN" || action === "PERCH") &&
      !this.locomotion.canClimb()
    ) {
      return false;
    }
    if (action === "CLIMB_UP" || action === "CLIMB_DOWN") {
      this.locomotion.requestClimbDirection(action === "CLIMB_UP" ? -1 : 1);
    }
    if (action === "JUMP_LEFT" || action === "JUMP_RIGHT") {
      this.locomotion.requestHorizontalDirection(
        action === "JUMP_LEFT" ? "left" : "right"
      );
    }
    this.clearInteractionOverride();
    this.developmentOverrideActive = devOverride;
    this.developmentPolicyTransition = devOverride;
    this.bypassMovementCooldown = true;
    try {
      this.transitionOrRestart(nextState);
    } finally {
      this.bypassMovementCooldown = false;
      this.developmentPolicyTransition = false;
    }
    this.emitSnapshot();
    return true;
  }

  public forceWake(): boolean {
    if (
      !this.started ||
      !this.visible ||
      this.systemRuntimePaused ||
      this.stateMachine.getCurrentState() !== "SLEEPING"
    ) {
      return false;
    }
    this.locomotion.cancel();
    this.movement.stop();
    this.cursor.disable();
    this.clearInteractionOverride();
    this.transitionOrRestart("IDLE");
    this.context.animation.play("wake", { restart: true });
    this.interactionOverride = true;
    this.interactionOverrideDurationMs = WAKE_DURATION_MS;
    this.emitSnapshot();
    return true;
  }

  public reactToTimerCompletion(): boolean {
    const state = this.stateMachine.getCurrentState();
    if (
      !this.started ||
      !this.visible ||
      this.systemRuntimePaused ||
      this.interactionOverride ||
      (state !== "IDLE" &&
        state !== "STARING" &&
        state !== "LAUGHING" &&
        state !== "SLEEPING")
    ) return false;

    if (state === "SLEEPING") return this.forceWake();
    this.locomotion.cancel();
    this.movement.stop();
    this.cursor.disable();
    this.clearInteractionOverride();
    this.developmentOverrideActive = false;
    this.transitionOrRestart("LAUGHING");
    this.emitSnapshot();
    return true;
  }

  public setInteractionUpdate(
    update: ((timestamp: number) => void) | null
  ): void {
    this.interactionUpdate = update;
  }

  public forceState(
    name: AutonomousStateName,
    options: DevelopmentForceOptions = {}
  ): boolean {
    const devOverride = options.bypassProductPolicy === true;
    if (
      !this.started ||
      !this.visible ||
      this.systemRuntimePaused ||
      this.stateMachine.getCurrentState() === "DRAGGED"
    ) {
      return false;
    }
    if (
      !devOverride &&
      this.powerPolicy.getSnapshot().mode === "LOW_POWER" &&
      (name === "CRAWLING" || isVerticalLocomotionState(name))
    ) return false;
    if (!(devOverride ? this.isStateHardSupported(name) : this.isStateSupported(name))) {
      return false;
    }
    this.clearInteractionOverride();
    this.developmentOverrideActive = devOverride && name !== "IDLE";
    this.developmentPolicyTransition = devOverride;
    this.bypassMovementCooldown = name === "CRAWLING" || isVerticalLocomotionState(name);
    try {
      if (this.stateMachine.getCurrentState() === name) {
        this.stateMachine.restart(this.context);
      } else {
        this.stateMachine.transition(name, this.context);
      }
    } finally {
      this.bypassMovementCooldown = false;
      this.developmentPolicyTransition = false;
    }
    if (this.autonomyPaused && !devOverride) {
      this.movement.pause();
      this.cursor.disable();
    }
    this.emitSnapshot();
    return true;
  }

  public setDebugLogging(enabled: boolean): void {
    this.debugLogging = enabled;
  }

  public getSnapshot(): ThukunaSnapshot {
    const state = this.stateMachine.getSnapshot();
    const movement = this.movement.getSnapshot();
    const position = this.getWindowPosition();
    const behaviorWeights = this.getBehaviorWeights();
    const nearLeftEdge =
      movement.x !== null &&
      movement.workAreaLeft !== null &&
      movement.x - movement.workAreaLeft <= LOCOMOTION_CONFIG.edgeAttachTolerancePx;
    const nearRightEdge =
      movement.x !== null &&
      movement.workAreaRight !== null &&
      movement.workAreaRight - movement.x <= LOCOMOTION_CONFIG.edgeAttachTolerancePx;
    const cursorSnapshot = this.cursor.getSnapshot();
    return {
      state: state.state,
      stateElapsedMs: state.elapsedMs,
      stateDurationMs: state.durationMs,
      autonomyPaused: this.autonomyPaused,
      moving: movement.moving,
      movementSpeedPxPerSecond: movement.speedPxPerSecond,
      velocityX: movement.velocityX,
      velocityY: movement.velocityY,
      movementMode: movement.mode,
      grounded: movement.grounded,
      floorY: movement.floorY,
      locomotion: this.locomotion.getSnapshot(),
      movementMemory: this.movementMemory.getSnapshot(),
      windowX: Math.round(movement.x ?? position.x),
      windowY: Math.round(movement.y ?? position.y),
      nearLeftEdge,
      nearRightEdge,
      cursorPlan: planCursorMovement({
        cursorHorizontalDeltaPx: cursorSnapshot.horizontalDeltaPx,
        cursorVerticalDeltaPx: cursorSnapshot.verticalDeltaPx ?? null,
        cursorDistancePx: cursorSnapshot.distancePx,
        sameDisplay: cursorSnapshot.sameDisplay,
        movement,
        powerMode: this.powerPolicy.getSnapshot().mode
      }),
      interactionOverride: this.interactionOverride,
      rageActive: this.isRageActive(),
      personality: this.personality.getSnapshot(),
      nextBehaviorWeights: Object.fromEntries(
        behaviorWeights.map(({ value, weight }) => [value, weight])
      ) as Record<AutonomousStateName, number>,
      cursor: cursorSnapshot,
      rareEvent: this.rareEvents.getSnapshot(),
      eventVisual: this.eventVisuals.getSnapshot(),
      settings: { ...this.settings },
      powerPolicy: this.powerPolicy.getSnapshot(),
      platformCapabilities: { ...this.platformCapabilities },
      movementCapabilityPolicy: { ...this.movementCapabilityPolicy },
      visible: this.visible,
      developmentOverrideActive: this.developmentOverrideActive,
      systemAwareness: copySystemAwarenessSnapshot(this.systemAwareness),
      systemRuntimeContext: { ...this.systemRuntimeContext },
      systemSafetyBlockReason: this.systemRuntimeContext.blockReason
    };
  }

  public destroy(): void {
    if (this.frameRequestId !== null) {
      cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = null;
    }
    this.locomotion.cancel();
    this.movement.stop();
    this.cursor.disable();
    this.eventVisuals.reset();
    this.context.animation.setRageActive(false);
    this.interactionUpdate = null;
    this.clearInteractionOverride();
    this.personalityAccumulatorMs = 0;
    this.started = false;
  }

  private readonly tick = (timestamp: number): void => {
    this.frameRequestId = null;
    if (!this.started) {
      return;
    }

    if (this.previousTimestamp === null) {
      this.previousTimestamp = timestamp;
    } else {
      const deltaTimeMs = Math.min(
        Math.max(timestamp - this.previousTimestamp, 0),
        250
      );
      this.previousTimestamp = timestamp;
      this.interactionUpdate?.(timestamp);
      this.cursor.update(deltaTimeMs);
      this.updatePersonality(deltaTimeMs);
      if (
        !this.interactionOverride &&
        !this.autonomyPaused &&
        this.stateMachine.getCurrentState() === "IDLE" &&
        this.movementCapabilityPolicy.gravityMovementAllowed &&
        this.movement.getSnapshot().floorY !== null &&
        !this.movement.getSnapshot().grounded
      ) {
        this.stateMachine.transition("FALLING", this.context);
        this.emitSnapshot();
      }
      const stateBeforeRareEvent = this.stateMachine.getCurrentState();
      const selectedRareEvent = this.rareEvents.update(deltaTimeMs, {
        canStart:
          stateBeforeRareEvent === "IDLE" &&
          this.canScheduleRareEvents() &&
          !this.interactionOverride,
        suspended:
          !this.canScheduleRareEvents() ||
          this.interactionOverride ||
          stateBeforeRareEvent === "SLEEPING" ||
          stateBeforeRareEvent === "DRAGGED" ||
          stateBeforeRareEvent === "RAGE",
        personality: this.personality.getSnapshot(),
        allowedEvents: RARE_EVENT_NAMES.filter((event) =>
          this.isRareEventSupported(event)
        )
      });
      if (selectedRareEvent !== null) {
        this.cursor.disable();
        this.movement.stop();
        this.stateMachine.transition(selectedRareEvent, this.context);
        this.emitSnapshot();
      }
      if (this.interactionOverride) {
        if (this.isRageActive()) {
          this.stateMachine.update(this.context, deltaTimeMs);
          if (this.stateMachine.getCurrentState() === "IDLE") {
            this.clearInteractionOverride();
            this.emitSnapshot();
          }
        } else {
          this.stateMachine.advanceElapsed(deltaTimeMs);
          this.interactionOverrideElapsedMs += deltaTimeMs;
          if (
            this.interactionOverrideElapsedMs >=
            this.interactionOverrideDurationMs
          ) {
            this.finishInteractionOverride();
          }
        }
      } else if (!this.autonomyPaused || this.developmentOverrideActive) {
        this.stateMachine.update(this.context, deltaTimeMs);
      }
      this.debugElapsedMs += deltaTimeMs;
      const debugIntervalMs =
        this.powerPolicy.getSnapshot().mode === "LOW_POWER" ? 1_000 : 250;
      if (this.debugElapsedMs >= debugIntervalMs) {
        this.debugElapsedMs = 0;
        this.emitSnapshot();
      }
    }

    if (this.visible && !this.systemRuntimePaused) {
      this.frameRequestId = requestAnimationFrame(this.tick);
    }
  };

  private emitSnapshot(): void {
    this.onSnapshot?.(this.getSnapshot());
  }

  private getBehaviorWeights() {
    const choices = this.powerPolicy.applyBehaviorWeights(
      calculateBehaviorWeights(
        this.personality.getSnapshot(),
        this.recentBehaviorStates
      )
    );
    return choices.map((choice) => ({
      ...choice,
      weight: this.isStateSupported(choice.value) ? choice.weight : 0
    }));
  }

  private updatePersonality(deltaTimeMs: number): void {
    this.personalityAccumulatorMs += deltaTimeMs;
    if (
      this.personalityAccumulatorMs <
        this.powerPolicy.getSnapshot().personalityUpdateIntervalMs
    ) {
      return;
    }
    const state = this.stateMachine.getCurrentState() ?? "IDLE";
    const effectiveState =
      this.autonomyPaused && !this.interactionOverride && state !== "DRAGGED"
        ? "IDLE"
        : state;
    this.personality.update(this.personalityAccumulatorMs, effectiveState);
    this.personalityAccumulatorMs = 0;
  }

  private handleCursorFailure(): void {
    if (!this.started) {
      return;
    }
    const state = this.stateMachine.getCurrentState();
    if (state === "WATCHING_CURSOR" || state === "CHASE_MOUSE") {
      this.movement.stop();
      this.stateMachine.transition("IDLE", this.context);
      this.emitSnapshot();
    }
  }

  private transitionOrRestart(name: Exclude<PetStateName, "DRAGGED">): void {
    if (this.stateMachine.getCurrentState() === name) {
      this.stateMachine.restart(this.context);
    } else {
      this.stateMachine.transition(name, this.context);
    }
  }

  private transitionToSupportedState(name: PetStateName): void {
    this.stateMachine.transition(
      (this.developmentOverrideActive
        ? this.isStateHardSupported(name)
        : this.isStateSupported(name)) ? name : "IDLE",
      this.context
    );
  }

  private isMovementActionAllowed(action: MovementAction): boolean {
    switch (action) {
      case "CRAWL":
        return this.movementCapabilityPolicy.groundMovementAllowed;
      case "JUMP":
        return this.movementCapabilityPolicy.jumpAllowed;
      case "HOP":
        return this.movementCapabilityPolicy.hopAllowed;
      case "FALL":
      case "LAND":
        return this.movementCapabilityPolicy.gravityMovementAllowed;
      case "CLIMB":
        return this.movementCapabilityPolicy.edgeClimbAllowed;
      case "PERCH":
        return this.movementCapabilityPolicy.perchAllowed;
      case "NONE":
        return true;
    }
  }

  private isForcedLocomotionAllowed(
    action:
      | "JUMP"
      | "JUMP_LEFT"
      | "JUMP_RIGHT"
      | "HOP"
      | "FALL"
      | "CLIMB_UP"
      | "CLIMB_DOWN"
      | "PERCH"
      | "LAND"
  ): boolean {
    if (action.startsWith("JUMP")) {
      return this.movementCapabilityPolicy.jumpAllowed;
    }
    if (action === "HOP") return this.movementCapabilityPolicy.hopAllowed;
    if (action === "FALL" || action === "LAND") {
      return this.movementCapabilityPolicy.gravityMovementAllowed;
    }
    if (action.startsWith("CLIMB")) {
      return this.movementCapabilityPolicy.edgeClimbAllowed;
    }
    return this.movementCapabilityPolicy.perchAllowed;
  }

  private isMovementActionHardAllowed(action: MovementAction): boolean {
    switch (action) {
      case "CRAWL":
      case "JUMP":
      case "HOP":
      case "FALL":
      case "LAND":
        return this.platformCapabilities.supportsProgrammaticWindowMove;
      case "CLIMB":
        return this.platformCapabilities.supportsProgrammaticWindowMove &&
          this.platformCapabilities.supportsEdgeClimbing;
      case "PERCH":
        return this.platformCapabilities.supportsProgrammaticWindowMove &&
          this.platformCapabilities.supportsPerching;
      case "NONE":
        return true;
    }
  }

  private isForcedLocomotionHardAllowed(
    action:
      | "JUMP" | "JUMP_LEFT" | "JUMP_RIGHT" | "HOP" | "FALL"
      | "CLIMB_UP" | "CLIMB_DOWN" | "PERCH" | "LAND"
  ): boolean {
    if (action.startsWith("CLIMB")) {
      return this.platformCapabilities.supportsProgrammaticWindowMove &&
        this.platformCapabilities.supportsEdgeClimbing;
    }
    if (action === "PERCH") {
      return this.platformCapabilities.supportsProgrammaticWindowMove &&
        this.platformCapabilities.supportsPerching;
    }
    return this.platformCapabilities.supportsProgrammaticWindowMove;
  }

  private isRareEventHardSupported(event: RareEventName): boolean {
    return event === "SPRINT" || event === "CHAOS_RUN"
      ? this.platformCapabilities.supportsProgrammaticWindowMove
      : true;
  }

  private isStateHardSupported(state: PetStateName): boolean {
    switch (state) {
      case "CRAWLING":
      case "JUMPING":
      case "HOPPING":
      case "FALLING":
      case "LANDING":
      case "SPRINT":
      case "CHAOS_RUN":
        return this.platformCapabilities.supportsProgrammaticWindowMove;
      case "CLIMBING":
        return this.platformCapabilities.supportsProgrammaticWindowMove &&
          this.platformCapabilities.supportsEdgeClimbing;
      case "PERCHED":
        return this.platformCapabilities.supportsProgrammaticWindowMove &&
          this.platformCapabilities.supportsPerching;
      case "WATCHING_CURSOR":
        return this.platformCapabilities.supportsCursorScreenPosition;
      case "CHASE_MOUSE":
        return this.platformCapabilities.supportsCursorScreenPosition &&
          this.platformCapabilities.supportsProgrammaticWindowMove;
      default:
        return true;
    }
  }

  private isRareEventSupported(event: RareEventName): boolean {
    if (!this.movementCapabilityPolicy.localRareEventsAllowed) return false;
    return event === "SPRINT" || event === "CHAOS_RUN"
      ? this.movementCapabilityPolicy.movingRareEventsAllowed
      : true;
  }

  private isStateSupported(state: PetStateName): boolean {
    switch (state) {
      case "CRAWLING":
        return this.movementCapabilityPolicy.groundMovementAllowed;
      case "JUMPING":
        return this.movementCapabilityPolicy.jumpAllowed;
      case "HOPPING":
        return this.movementCapabilityPolicy.hopAllowed;
      case "FALLING":
      case "LANDING":
        return this.movementCapabilityPolicy.gravityMovementAllowed;
      case "CLIMBING":
        return this.movementCapabilityPolicy.edgeClimbAllowed;
      case "PERCHED":
        return this.movementCapabilityPolicy.perchAllowed;
      case "WATCHING_CURSOR":
        return this.movementCapabilityPolicy.cursorScreenPositionAllowed;
      case "CHASE_MOUSE":
        return this.movementCapabilityPolicy.cursorChaseAllowed;
      case "SPRINT":
      case "CHAOS_RUN":
        return this.movementCapabilityPolicy.movingRareEventsAllowed;
      case "FALL_OVER":
      case "CREEPY_FREEZE":
      case "ZOOM_STARE":
      case "DOMAIN_EXPANSION":
        return this.movementCapabilityPolicy.localRareEventsAllowed;
      default:
        return true;
    }
  }

  private finishInteractionOverride(): void {
    if (!this.interactionOverride) {
      return;
    }
    this.clearInteractionOverride();
    this.transitionOrRestart("IDLE");
    this.emitSnapshot();
  }

  private clearInteractionOverride(): void {
    this.interactionOverride = false;
    this.interactionOverrideElapsedMs = 0;
    this.interactionOverrideDurationMs = 0;
  }

  private canScheduleRareEvents(): boolean {
    return (
      this.visible &&
      !this.systemRuntimePaused &&
      !this.autonomyPaused &&
      this.powerPolicy.getSnapshot().rareEventsAllowed &&
      this.movementCapabilityPolicy.localRareEventsAllowed
    );
  }

  private applyRareEventPolicy(): void {
    const policy = this.powerPolicy.getSnapshot();
    this.rareEvents.setRuntimePolicy(
      {
        intervalMultiplier: policy.rareEventIntervalMultiplier,
        occurrenceChanceBoost: policy.rareEventOccurrenceBoost
      },
      this.personality.getSnapshot()
    );
  }
}
