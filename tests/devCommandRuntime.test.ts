import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THUKUNA_SETTINGS } from "../src/shared/settings";
import {
  DEFAULT_PLATFORM_CAPABILITIES,
  resolveMovementCapabilityPolicy
} from "../src/shared/platform";
import type { AnimationName } from "../src/renderer/animations/thukunaAnimations";
import type { AnimationController } from "../src/renderer/engine/AnimationController";
import type { InteractionController } from "../src/renderer/engine/InteractionController";
import type { ThukunaController, ThukunaSnapshot } from "../src/renderer/engine/ThukunaController";
import type { DevCommandId } from "../src/renderer/dev/devCommandRegistry";
import { DEV_COMMAND_REGISTRY } from "../src/renderer/dev/devCommandRegistry";
import { ThukunaDevCommandRuntime } from "../src/renderer/dev/ThukunaDevCommandRuntime";

const definition = (id: DevCommandId) => {
  const result = DEV_COMMAND_REGISTRY.find((command) => command.id === id);
  assert.ok(result);
  return result;
};

const baseSnapshot = (): ThukunaSnapshot => ({
  state: "IDLE",
  stateElapsedMs: 0,
  stateDurationMs: null,
  autonomyPaused: false,
  moving: false,
  movementSpeedPxPerSecond: 0,
  velocityX: 0,
  velocityY: 0,
  movementMode: "GROUND",
  grounded: true,
  floorY: 750,
  locomotion: { action: "NONE", mode: "GROUND", phase: "IDLE", elapsedMs: 0, airborneElapsedMs: 0, direction: "right" },
  movementMemory: {
    lastMovementType: "NONE",
    recentMovementTypes: [],
    lastJumpTimestamp: null,
    lastClimbTimestamp: null,
    lastPerchTimestamp: null
  },
  windowX: 0,
  windowY: 750,
  nearLeftEdge: true,
  nearRightEdge: false,
  cursorPlan: "WATCH",
  interactionOverride: false,
  rageActive: false,
  personality: { irritation: 15, energy: 75, boredom: 20, chaos: 30 },
  nextBehaviorWeights: { IDLE: 1 } as ThukunaSnapshot["nextBehaviorWeights"],
  cursor: {
    mode: "IDLE", cursorX: 100, cursorY: 100, distancePx: 50,
    horizontalDeltaPx: 10, verticalDeltaPx: 0, cursorDirection: "right",
    suggestedDirection: "right", sameDisplay: true, isNearby: true,
    isWithinChaseRadius: true, isInsideDeadZone: true, hasSample: true,
    sampleSequence: 1, sampleRateHz: 1, queryInFlight: false,
    queryCounts: { IDLE: 1, WATCH: 0, CHASE: 0 }, failed: false
  },
  rareEvent: {
    activeEvent: null, nextCheckInMs: 1_000, globalCooldownRemainingMs: 0,
    perEventCooldownRemainingMs: {
      SPRINT: 0, FALL_OVER: 0, CREEPY_FREEZE: 0,
      ZOOM_STARE: 0, CHAOS_RUN: 0, DOMAIN_EXPANSION: 0
    },
    eligible: true, chaosIntervalModifier: 1,
    occurrenceChance: 0.1, checkCount: 0,
    eventCounts: {
      SPRINT: 0, FALL_OVER: 0, CREEPY_FREEZE: 0,
      ZOOM_STARE: 0, CHAOS_RUN: 0, DOMAIN_EXPANSION: 0
    },
    intervalMultiplier: 1
  },
  eventVisual: {
    activeEvent: null,
    durationMs: 0,
    phase: "NONE",
    activationCount: 0,
    cleanupCount: 0
  },
  settings: { ...DEFAULT_THUKUNA_SETTINGS },
  powerPolicy: {
    mode: "NORMAL", autonomousMovementMultiplier: 1,
    mouseAwarenessAllowed: true, rareEventsAllowed: true,
    rareEventIntervalMultiplier: 1, rareEventOccurrenceBoost: 0,
    idleDurationMultiplier: 1, personalityUpdateIntervalMs: 250,
    cursorNoticeChanceBoost: 0, chaseChanceBoost: 0,
    chaseSpeedMultiplier: 1
  },
  platformCapabilities: DEFAULT_PLATFORM_CAPABILITIES,
  movementCapabilityPolicy: resolveMovementCapabilityPolicy(
    DEFAULT_PLATFORM_CAPABILITIES,
    DEFAULT_THUKUNA_SETTINGS
  ),
  visible: true,
  developmentOverrideActive: false,
  systemAwareness: {
    sessionState: "active",
    activityState: "active",
    powerSource: "ac",
    idleSeconds: 0,
    updatedAt: 0,
    capabilities: {
      idleAwareness: true,
      sessionEvents: true,
      suspendResume: true,
      powerSource: true,
      displayEvents: true
    },
    lastTransition: null,
    idleSamplerActive: true,
    listenerCount: 9
  },
  systemRuntimeContext: {
    hardPaused: false,
    blockReason: null,
    cursorIntervalMultiplier: 1,
    effectivePolicyLabel: "SYSTEM_NORMAL"
  },
  systemSafetyBlockReason: null
});

const setup = (assetValidationError: string | null = null) => {
  let snapshot = baseSnapshot();
  let animationName: AnimationName | null = "idle";
  const calls: string[] = [];
  const updateState = (state: ThukunaSnapshot["state"], animation: AnimationName) => {
    snapshot = { ...snapshot, state };
    animationName = animation;
  };
  const controller = {
    getSnapshot: () => snapshot,
    forceState: (state: string) => {
      calls.push(`state:${state}`);
      const animations: Record<string, AnimationName> = {
        IDLE: "idle", CRAWLING: "crawl_start", SLEEPING: "sleep_enter",
        LAUGHING: "laugh", ANGRY: "angry_enter"
      };
      updateState(state as ThukunaSnapshot["state"], animations[state] ?? "idle");
      return true;
    },
    forceRareEvent: (event: string) => {
      calls.push(`rare:${event}`);
      const animations: Record<string, AnimationName> = {
        SPRINT: "sprint", FALL_OVER: "fall_over", CHAOS_RUN: "sprint",
        DOMAIN_EXPANSION: "domain_charge", CREEPY_FREEZE: "idle", ZOOM_STARE: "watch_cursor"
      };
      updateState(event as ThukunaSnapshot["state"], animations[event]);
      return true;
    },
    forceLocomotion: (action: string) => {
      calls.push(`locomotion:${action}`);
      const state = action.startsWith("JUMP") ? "JUMPING"
        : action === "HOP" ? "HOPPING"
          : action === "FALL" ? "FALLING"
            : action.startsWith("CLIMB") ? "CLIMBING"
              : action === "PERCH" ? "PERCHED" : "LANDING";
      const animation = state === "JUMPING" ? "jump_prepare"
        : state === "HOPPING" ? "hop_prepare"
          : state === "FALLING" ? "fall"
            : state === "CLIMBING" ? "climb_enter"
              : state === "PERCHED" ? "perch_enter" : "land";
      updateState(state, animation);
      return true;
    },
    forceCursorBehavior: (state: string) => {
      calls.push(`cursor:${state}`);
      updateState(state as ThukunaSnapshot["state"], "watch_cursor");
      return true;
    },
    beginInteractionReaction: (reaction: string) => {
      calls.push(`reaction:${reaction}`);
      updateState("RAGE", "rage");
      return true;
    },
    forceWake: () => {
      calls.push("wake");
      updateState("IDLE", "wake");
      return true;
    },
    prepareForPositionReset: () => { calls.push("prepare-reset"); },
    getPersonalitySnapshot: () => snapshot.personality,
    setPersonalityValues: () => undefined,
    resetPersonality: () => undefined
  } as unknown as ThukunaController;
  const animation = {
    getCurrentAnimation: () => animationName,
    play: (name: AnimationName) => { animationName = name; calls.push(`preview:${name}`); },
    setDirection: (direction: string) => { calls.push(`direction:${direction}`); },
    isPlaying: () => true,
    pause: () => { calls.push("pause"); },
    resume: () => { calls.push("resume"); }
  } as unknown as AnimationController<AnimationName>;
  const interactions = {
    showRandomDialogue: () => { calls.push("show-dialogue"); },
    hideDialogue: () => { calls.push("hide-dialogue"); }
  } as unknown as InteractionController;
  const runtime = new ThukunaDevCommandRuntime(controller, animation, interactions, {
    toggleDiagnostics: () => { calls.push("diagnostics"); },
    updateAutonomy: async () => { calls.push("autonomy"); },
    resetPosition: async () => { calls.push("reset"); return true; },
    getSettings: () => snapshot.settings,
    validateCommandAssets: () => assetValidationError
  });
  return {
    runtime,
    calls,
    get snapshot() { return snapshot; },
    setSnapshot: (patch: Partial<ThukunaSnapshot>) => { snapshot = { ...snapshot, ...patch }; }
  };
};

test("DEV force bypasses Low Power while preserving hard movement capability", async () => {
  const harness = setup();
  const settings = { ...harness.snapshot.settings, lowPowerMode: true };
  harness.setSnapshot({
    settings,
    powerPolicy: { ...harness.snapshot.powerPolicy, mode: "LOW_POWER" },
    movementCapabilityPolicy: resolveMovementCapabilityPolicy(DEFAULT_PLATFORM_CAPABILITIES, settings)
  });
  const result = await harness.runtime.execute(definition("JUMP"));
  assert.equal(result.accepted, true);
  assert.equal(result.devOverride, true);
  assert.deepEqual(harness.calls, ["locomotion:JUMP"]);
});

test("system lock and suspend reject developer force but keep diagnostics available", async () => {
  for (const reason of ["SYSTEM_LOCKED", "SYSTEM_SUSPENDED"] as const) {
    const harness = setup();
    harness.setSnapshot({ systemSafetyBlockReason: reason });
    const domain = await harness.runtime.execute(definition("DOMAIN"));
    assert.equal(domain.accepted, false);
    assert.equal(domain.reason, reason);
    assert.deepEqual(harness.calls, []);
    const diagnostics = await harness.runtime.execute(definition("DIAGNOSTICS"));
    assert.equal(diagnostics.accepted, true);
    assert.deepEqual(harness.calls, ["diagnostics"]);
  }
});

test("platform capability rejection is distinct from geometry rejection", async () => {
  const blocked = setup();
  blocked.setSnapshot({
    nearLeftEdge: false,
    platformCapabilities: {
      ...blocked.snapshot.platformCapabilities,
      supportsEdgeClimbing: false
    }
  });
  assert.equal((await blocked.runtime.execute(definition("CLIMB_UP"))).reason, "MOVEMENT_CAPABILITY_DISABLED");
  const geometry = setup();
  geometry.setSnapshot({ nearLeftEdge: false, nearRightEdge: false });
  assert.equal((await geometry.runtime.execute(definition("CLIMB_UP"))).reason, "NOT_NEAR_EDGE");
});

test("Perch, Fall, Drop, and Wake expose their exact precondition failures", async () => {
  const harness = setup();
  harness.setSnapshot({ nearLeftEdge: false, nearRightEdge: false });
  assert.equal((await harness.runtime.execute(definition("PERCH"))).reason, "NOT_NEAR_EDGE");
  assert.equal((await harness.runtime.execute(definition("FALL"))).reason, "NOT_ELEVATED");
  assert.equal((await harness.runtime.execute(definition("DROP"))).reason, "NOT_PERCHED");
  assert.equal((await harness.runtime.execute(definition("WAKE"))).reason, "NOT_SLEEPING");
});

test("Domain bypasses scheduler state through canonical cleanup and forceStart path", async () => {
  const harness = setup();
  harness.setSnapshot({ state: "ZOOM_STARE" });
  const result = await harness.runtime.execute(definition("DOMAIN"));
  assert.equal(result.accepted, true);
  assert.deepEqual(harness.calls, ["state:IDLE", "rare:DOMAIN_EXPANSION"]);
  assert.equal(harness.runtime.getActualState().state, "DOMAIN_EXPANSION");
});

test("Domain DEV force ignores autonomy, rare-event setting, and Low Power product policy", async () => {
  const harness = setup();
  harness.setSnapshot({
    autonomyPaused: true,
    settings: {
      ...harness.snapshot.settings,
      autonomyEnabled: false,
      rareEventsEnabled: false,
      lowPowerMode: true
    },
    powerPolicy: {
      ...harness.snapshot.powerPolicy,
      mode: "LOW_POWER",
      rareEventsAllowed: false
    }
  });
  const result = await harness.runtime.execute(definition("DOMAIN"));
  assert.equal(result.accepted, true);
  assert.equal(result.devOverride, true);
  assert.equal(result.reason, "NONE");
  assert.equal(result.trace?.some(({ stage }) => stage === "EVENT_FORCE_STARTED"), true);
  assert.equal(harness.runtime.getActualState().state, "DOMAIN_EXPANSION");
});

test("Domain reports an exact asset-validation rejection before changing state", async () => {
  const harness = setup("Missing Domain frame 13 of 20.");
  const result = await harness.runtime.execute(definition("DOMAIN"));
  assert.equal(result.accepted, false);
  assert.equal(result.reason, "ASSET_VALIDATION_FAILED");
  assert.equal(result.detail, "Missing Domain frame 13 of 20.");
  assert.deepEqual(harness.calls, []);
});

test("Rage directly replaces an event through canonical cleanup", async () => {
  const harness = setup();
  harness.setSnapshot({ state: "DOMAIN_EXPANSION" });
  const result = await harness.runtime.execute(definition("RAGE"));
  assert.equal(result.accepted, true);
  assert.deepEqual(harness.calls, ["state:IDLE", "reaction:RAGE"]);
  assert.equal(harness.runtime.getActualState().state, "RAGE");
});

test("Drop, Wake, and Reset dispatch to their deterministic paths", async () => {
  const drop = setup();
  drop.setSnapshot({ state: "PERCHED" });
  assert.equal((await drop.runtime.execute(definition("DROP"))).accepted, true);
  assert.deepEqual(drop.calls, ["locomotion:FALL"]);

  const wake = setup();
  wake.setSnapshot({ state: "SLEEPING" });
  assert.equal((await wake.runtime.execute(definition("WAKE"))).accepted, true);
  assert.deepEqual(wake.calls, ["wake"]);

  const reset = setup();
  assert.equal((await reset.runtime.execute(definition("RESET_POSITION"))).accepted, true);
  assert.deepEqual(reset.calls, ["reset", "prepare-reset"]);
});

test("DEV force bypasses mouse-awareness and autonomy product policy", async () => {
  const cursor = setup();
  cursor.setSnapshot({ settings: { ...cursor.snapshot.settings, mouseAwarenessEnabled: false } });
  assert.equal((await cursor.runtime.execute(definition("WATCH"))).accepted, true);
  const paused = setup();
  paused.setSnapshot({ autonomyPaused: true });
  assert.equal((await paused.runtime.execute(definition("CRAWL"))).accepted, true);
});

test("active dragging blocks replacement and leaves canonical state untouched", async () => {
  const harness = setup();
  harness.setSnapshot({ state: "DRAGGED" });
  const result = await harness.runtime.execute(definition("DOMAIN"));
  assert.equal(result.reason, "DRAG_ACTIVE");
  assert.deepEqual(harness.calls, []);
});

test("every required manual command dispatches its canonical runtime path", async () => {
  const cases: readonly {
    id: DevCommandId;
    patch?: Partial<ThukunaSnapshot>;
    calls: readonly string[];
  }[] = [
    { id: "DIAGNOSTICS", calls: ["diagnostics"] },
    { id: "IDLE", calls: ["state:IDLE"] },
    { id: "CRAWL", calls: ["state:CRAWLING"] },
    { id: "SPRINT", calls: ["rare:SPRINT"] },
    { id: "JUMP", calls: ["locomotion:JUMP"] },
    { id: "JUMP_LEFT", calls: ["locomotion:JUMP_LEFT"] },
    { id: "JUMP_RIGHT", calls: ["locomotion:JUMP_RIGHT"] },
    { id: "HOP", calls: ["locomotion:HOP"] },
    { id: "FALL", patch: { grounded: false }, calls: ["locomotion:FALL"] },
    { id: "CLIMB_UP", calls: ["locomotion:CLIMB_UP"] },
    { id: "CLIMB_DOWN", calls: ["locomotion:CLIMB_DOWN"] },
    { id: "PERCH", calls: ["locomotion:PERCH"] },
    { id: "DROP", patch: { state: "PERCHED" }, calls: ["locomotion:FALL"] },
    { id: "WATCH", calls: ["cursor:WATCHING_CURSOR"] },
    { id: "CHASE", calls: ["cursor:CHASE_MOUSE"] },
    { id: "SLEEP", calls: ["state:SLEEPING"] },
    { id: "WAKE", patch: { state: "SLEEPING" }, calls: ["wake"] },
    { id: "LAUGH", calls: ["state:LAUGHING"] },
    { id: "ANGRY", calls: ["state:ANGRY"] },
    { id: "RAGE", calls: ["reaction:RAGE"] },
    { id: "FALL_OVER", calls: ["rare:FALL_OVER"] },
    { id: "CREEPY_FREEZE", calls: ["rare:CREEPY_FREEZE"] },
    { id: "ZOOM_STARE", calls: ["rare:ZOOM_STARE"] },
    { id: "CHAOS_RUN", calls: ["rare:CHAOS_RUN"] },
    { id: "DOMAIN", calls: ["rare:DOMAIN_EXPANSION"] },
    { id: "RESET_POSITION", calls: ["reset", "prepare-reset"] },
    { id: "LAND", calls: ["locomotion:LAND"] }
  ];

  for (const value of cases) {
    const harness = setup();
    if (value.patch !== undefined) harness.setSnapshot(value.patch);
    const result = await harness.runtime.execute(definition(value.id));
    assert.equal(result.accepted, true, value.id);
    assert.equal(result.reason, "NONE", value.id);
    assert.deepEqual(harness.calls, value.calls, value.id);
  }
});
