import assert from "node:assert/strict";
import test from "node:test";
import { THUKUNA_ANIMATIONS, type AnimationName } from "../src/renderer/animations/thukunaAnimations";
import { AnimationController } from "../src/renderer/engine/AnimationController";
import { ThukunaController } from "../src/renderer/engine/ThukunaController";
import type { RareEventName } from "../src/renderer/config/rareEventConfig";
import { DEFAULT_THUKUNA_SETTINGS } from "../src/shared/settings";
import {
  DEFAULT_PLATFORM_CAPABILITIES,
  detectPlatformCapabilities,
  type PlatformCapabilities
} from "../src/shared/platform";
import type { SystemAwarenessSnapshot } from "../src/shared/systemAwareness";

const awarenessSnapshot = (
  sessionState: SystemAwarenessSnapshot["sessionState"],
  updatedAt: number,
  from: string,
  to: string
): SystemAwarenessSnapshot => ({
  sessionState,
  activityState: "active",
  powerSource: "ac",
  idleSeconds: 0,
  updatedAt,
  capabilities: {
    idleAwareness: true,
    sessionEvents: true,
    suspendResume: true,
    powerSource: true,
    displayEvents: true
  },
  lastTransition: { kind: "session", from, to, at: updatedAt },
  idleSamplerActive: sessionState === "active",
  listenerCount: 9
});

class FakeClassList {
  private readonly values = new Set<string>();
  public add(value: string): void { this.values.add(value); }
  public remove(value: string): void { this.values.delete(value); }
  public contains(value: string): boolean { return this.values.has(value); }
  public toggle(value: string, force?: boolean): boolean {
    const enabled = force ?? !this.values.has(value);
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    return enabled;
  }
}

interface FakeElement {
  dataset: Record<string, string>;
  classList: FakeClassList;
  offsetWidth: number;
}

const element = (): FakeElement => ({
  dataset: {},
  classList: new FakeClassList(),
  offsetWidth: 180
});

const setup = (
  capabilities: PlatformCapabilities = DEFAULT_PLATFORM_CAPABILITIES
) => {
  let nextFrameId = 1;
  const frames = new Map<number, FrameRequestCallback>();
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const id = nextFrameId;
    nextFrameId += 1;
    frames.set(id, callback);
    return id;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => {
    frames.delete(id);
  }) as typeof cancelAnimationFrame;

  const image = {
    ...element(),
    src: "",
    getAttribute(name: string) {
      return name === "src"
        ? (this as unknown as { src: string }).src
        : null;
    }
  } as unknown as HTMLImageElement;
  const direction = element();
  const motion = element();
  const interaction = element();
  let activeRareVisual: RareEventName | null = null;
  let rareVisualPhase = "NONE";
  let rareVisualActivations = 0;
  let rareVisualResets = 0;
  const animation = new AnimationController<AnimationName>(
    image,
    direction as unknown as HTMLElement,
    motion as unknown as HTMLElement,
    interaction as unknown as HTMLElement,
    THUKUNA_ANIMATIONS
  );
  const controller = new ThukunaController(
    animation,
    { moveBy: async () => ({ x: 0, y: 0, hitBoundary: false }) },
    () => ({ x: 0, y: 0 }),
    undefined,
    { next: () => 0.5 },
    undefined,
    {
      activate: (event) => {
        if (activeRareVisual !== null) rareVisualResets += 1;
        activeRareVisual = event;
        rareVisualPhase = "ACTIVE";
        rareVisualActivations += 1;
      },
      setPhase: (phase) => { rareVisualPhase = phase; },
      reset: () => {
        if (activeRareVisual !== null) rareVisualResets += 1;
        activeRareVisual = null;
        rareVisualPhase = "NONE";
      },
      getSnapshot: () => ({
        activeEvent: activeRareVisual,
        durationMs: 0,
        phase: rareVisualPhase,
        activationCount: rareVisualActivations,
        cleanupCount: rareVisualResets
      })
    },
    undefined,
    capabilities
  );
  const step = (timestamp: number): void => {
    const pending = [...frames.entries()];
    assert.notEqual(pending.length, 0);
    for (const [id] of pending) frames.delete(id);
    for (const [, callback] of pending) callback(timestamp);
  };
  return {
    controller,
    interaction,
    step,
    get pendingFrameCount() { return frames.size; },
    get activeRareVisual() { return activeRareVisual; },
    get currentAnimation() { return animation.getCurrentAnimation(); },
    get rareVisualActivations() { return rareVisualActivations; },
    get rareVisualResets() { return rareVisualResets; }
  };
};

test("interaction override completes while manual autonomy remains paused", () => {
  const { controller, step } = setup();
  controller.start();
  step(0);
  controller.pauseAutonomy();
  controller.beginInteractionReaction("ANGRY", 100);
  step(50);
  assert.equal(controller.getSnapshot().state, "ANGRY");
  assert.equal(controller.getSnapshot().interactionOverride, true);
  step(101);
  assert.equal(controller.getSnapshot().state, "IDLE");
  assert.equal(controller.getSnapshot().interactionOverride, false);
  assert.equal(controller.getSnapshot().autonomyPaused, true);
  controller.destroy();
});

test("suspend hard-stops runtime, rejects dev force, and rebases a multi-hour gap", () => {
  const harness = setup();
  harness.controller.start();
  harness.step(100);
  assert.equal(
    harness.controller.forceState("CRAWLING", { bypassProductPolicy: true }),
    true
  );
  harness.controller.applySystemAwareness(
    awarenessSnapshot("suspended", 200, "active", "suspended")
  );
  assert.equal(harness.pendingFrameCount, 0);
  assert.equal(harness.controller.getSnapshot().state, "IDLE");
  assert.equal(harness.controller.getSnapshot().moving, false);
  assert.equal(harness.controller.getSnapshot().systemSafetyBlockReason, "SYSTEM_SUSPENDED");
  assert.equal(
    harness.controller.forceRareEvent("DOMAIN_EXPANSION", { bypassProductPolicy: true }),
    false
  );

  harness.controller.applySystemAwareness(
    awarenessSnapshot("active", 7_200_200, "suspended", "active")
  );
  assert.equal(harness.pendingFrameCount > 0, true);
  harness.step(7_200_200);
  assert.equal(harness.controller.getSnapshot().stateElapsedMs, 0);
  harness.step(7_200_216);
  assert.equal(harness.controller.getSnapshot().stateElapsedMs <= 16, true);
  assert.equal(harness.controller.getSnapshot().windowX, 0);
  harness.controller.destroy();
});

test("repeated Rage exits remove the visual class without accumulation", () => {
  const { controller, interaction, step } = setup();
  controller.start();
  step(0);
  let timestamp = 0;
  for (let index = 0; index < 25; index += 1) {
    assert.equal(controller.beginInteractionReaction("RAGE"), true);
    assert.equal(interaction.classList.contains("is-raging"), true);
    for (let frame = 0; frame < 8; frame += 1) {
      timestamp += 250;
      step(timestamp);
    }
    assert.equal(controller.getSnapshot().state, "IDLE");
    assert.equal(interaction.classList.contains("is-raging"), false);
  }
  controller.destroy();
});

test("personality passive drift continues while autonomy is manually paused", () => {
  const { controller, step } = setup();
  controller.start();
  step(0);
  controller.pauseAutonomy();
  const before = controller.getPersonalitySnapshot();
  step(250);
  const after = controller.getPersonalitySnapshot();
  assert.equal(after.boredom > before.boredom, true);
  assert.equal(after.energy < before.energy, true);
  assert.equal(controller.getSnapshot().autonomyPaused, true);
  controller.destroy();
});

test("semantic interaction effects update persistent personality", () => {
  const { controller, step } = setup();
  controller.start();
  step(0);
  controller.onClick();
  controller.onAnnoyedCombo();
  controller.onDragComplete({ durationMs: 2_500, distancePx: 50, longDrag: true });
  const personality = controller.getPersonalitySnapshot();
  assert.equal(personality.irritation, 33);
  assert.equal(personality.boredom, 13.5);
  controller.destroy();
});

test("drag immediately interrupts mouse chase and disables cursor tracking", () => {
  const { controller, step } = setup();
  controller.start();
  step(0);
  assert.equal(controller.forceCursorBehavior("CHASE_MOUSE"), true);
  assert.equal(controller.getSnapshot().cursor.mode, "CHASE");
  controller.beginDrag();
  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.state, "DRAGGED");
  assert.equal(snapshot.cursor.mode, "OFF");
  assert.equal(snapshot.moving, false);
  controller.destroy();
});

test("twenty-five drag cycles return to idle without state accumulation", () => {
  const { controller, step } = setup();
  controller.start();
  step(0);
  for (let index = 0; index < 25; index += 1) {
    controller.beginDrag();
    assert.equal(controller.getSnapshot().state, "DRAGGED");
    controller.endDrag("IDLE");
    assert.equal(controller.getSnapshot().state, "IDLE");
    assert.equal(controller.getSnapshot().moving, false);
  }
  controller.destroy();
});

test("Rage overrides mouse chase and prevents cursor behavior re-entry", () => {
  const { controller, step } = setup();
  controller.start();
  step(0);
  assert.equal(controller.forceCursorBehavior("CHASE_MOUSE"), true);
  assert.equal(controller.beginInteractionReaction("RAGE"), true);
  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.state, "RAGE");
  assert.equal(snapshot.cursor.mode, "OFF");
  assert.equal(snapshot.moving, false);
  assert.equal(controller.forceCursorBehavior("WATCHING_CURSOR"), false);
  controller.destroy();
});

test("manual pause stops cursor behavior and keeps tracking disabled", () => {
  const { controller, step } = setup();
  controller.start();
  step(0);
  assert.equal(controller.forceCursorBehavior("WATCHING_CURSOR"), true);
  controller.pauseAutonomy();
  const snapshot = controller.getSnapshot();
  assert.equal(snapshot.state, "IDLE");
  assert.equal(snapshot.autonomyPaused, true);
  assert.equal(snapshot.cursor.mode, "OFF");
  assert.equal(controller.forceCursorBehavior("CHASE_MOUSE"), false);
  controller.destroy();
});

test("drag immediately interrupts a rare event and restores its visual layer", () => {
  const harness = setup();
  harness.controller.start();
  harness.step(0);
  assert.equal(harness.controller.forceRareEvent("SPRINT"), true);
  assert.equal(harness.activeRareVisual, "SPRINT");
  harness.controller.beginDrag();
  const snapshot = harness.controller.getSnapshot();
  assert.equal(snapshot.state, "DRAGGED");
  assert.equal(snapshot.rareEvent.activeEvent, null);
  assert.equal(snapshot.moving, false);
  assert.equal(harness.activeRareVisual, null);
  harness.controller.destroy();
});

test("Rage and click reactions interrupt rare events while rare events cannot override them", () => {
  const rage = setup();
  rage.controller.start();
  rage.step(0);
  assert.equal(rage.controller.forceRareEvent("ZOOM_STARE"), true);
  assert.equal(rage.controller.beginInteractionReaction("RAGE"), true);
  assert.equal(rage.controller.getSnapshot().state, "RAGE");
  assert.equal(rage.controller.getSnapshot().rareEvent.activeEvent, null);
  assert.equal(rage.controller.forceRareEvent("SPRINT"), false);
  rage.controller.destroy();

  const click = setup();
  click.controller.start();
  click.step(0);
  assert.equal(click.controller.forceRareEvent("FALL_OVER"), true);
  assert.equal(click.controller.beginInteractionReaction("BLINK", 300), true);
  assert.equal(click.controller.getSnapshot().state, "IDLE");
  assert.equal(click.controller.getSnapshot().interactionOverride, true);
  assert.equal(click.controller.getSnapshot().rareEvent.activeEvent, null);
  click.controller.destroy();
});

test("autonomy pause cancels rare events and suspends future scheduling", () => {
  const harness = setup();
  harness.controller.start();
  harness.step(0);
  assert.equal(harness.controller.forceRareEvent("DOMAIN_EXPANSION"), true);
  harness.controller.pauseAutonomy();
  const paused = harness.controller.getSnapshot();
  assert.equal(paused.state, "IDLE");
  assert.equal(paused.autonomyPaused, true);
  assert.equal(paused.rareEvent.activeEvent, null);
  assert.equal(paused.rareEvent.nextCheckInMs, null);
  assert.equal(harness.controller.forceRareEvent("CHAOS_RUN"), false);
  harness.controller.resumeAutonomy();
  assert.equal(harness.controller.getSnapshot().rareEvent.nextCheckInMs !== null, true);
  harness.controller.destroy();
});

test("cursor debug behavior cannot interrupt an active rare event", () => {
  const { controller, step } = setup();
  controller.start();
  step(0);
  assert.equal(controller.forceRareEvent("CREEPY_FREEZE"), true);
  assert.equal(controller.forceCursorBehavior("CHASE_MOUSE"), false);
  assert.equal(controller.getSnapshot().state, "CREEPY_FREEZE");
  assert.equal(controller.getSnapshot().cursor.mode, "OFF");
  controller.destroy();
});

test("mouse-awareness setting cancels cursor behavior and prevents new queries", () => {
  const harness = setup();
  harness.controller.start();
  harness.step(0);
  assert.equal(harness.controller.forceCursorBehavior("WATCHING_CURSOR"), true);
  harness.controller.applySettings({
    ...DEFAULT_THUKUNA_SETTINGS,
    mouseAwarenessEnabled: false
  });
  const snapshot = harness.controller.getSnapshot();
  assert.equal(snapshot.state, "IDLE");
  assert.equal(snapshot.cursor.mode, "OFF");
  assert.equal(harness.controller.forceCursorBehavior("CHASE_MOUSE"), false);
  harness.controller.destroy();
});

test("rare-event setting cancels an event and suspends its scheduler", () => {
  const harness = setup();
  harness.controller.start();
  harness.step(0);
  assert.equal(harness.controller.forceRareEvent("ZOOM_STARE"), true);
  harness.controller.applySettings({
    ...DEFAULT_THUKUNA_SETTINGS,
    rareEventsEnabled: false
  });
  const snapshot = harness.controller.getSnapshot();
  assert.equal(snapshot.state, "IDLE");
  assert.equal(snapshot.rareEvent.activeEvent, null);
  assert.equal(snapshot.rareEvent.nextCheckInMs, null);
  assert.equal(harness.controller.forceRareEvent("SPRINT"), false);
  harness.controller.destroy();
});

test("settings-driven autonomy pause leaves no stranded crawl movement", () => {
  const harness = setup();
  harness.controller.start();
  harness.step(0);
  harness.controller.forceState("CRAWLING");
  assert.equal(harness.controller.getSnapshot().state, "CRAWLING");
  harness.controller.applySettings({
    ...DEFAULT_THUKUNA_SETTINGS,
    autonomyEnabled: false
  });
  let snapshot = harness.controller.getSnapshot();
  assert.equal(snapshot.state, "IDLE");
  assert.equal(snapshot.moving, false);
  harness.controller.applySettings(DEFAULT_THUKUNA_SETTINGS);
  snapshot = harness.controller.getSnapshot();
  assert.equal(snapshot.state, "IDLE");
  assert.equal(snapshot.autonomyPaused, false);
  harness.controller.destroy();
});

test("forced Crawl bypasses ordinary movement-memory cooldown", () => {
  const harness = setup();
  harness.controller.start();
  harness.step(0);
  for (let index = 0; index < 3; index += 1) {
    assert.equal(harness.controller.forceState("CRAWLING"), true);
    harness.step(index * 10 + 1);
    assert.equal(harness.controller.getSnapshot().state, "CRAWLING");
    assert.equal(harness.controller.forceState("IDLE"), true);
  }
  harness.controller.destroy();
});

test("forced Chase bypasses ordinary crawl cooldown", () => {
  const harness = setup();
  harness.controller.start();
  harness.step(0);
  for (let index = 0; index < 2; index += 1) {
    assert.equal(harness.controller.forceState("CRAWLING"), true);
    assert.equal(harness.controller.forceState("IDLE"), true);
  }
  assert.equal(harness.controller.forceCursorBehavior("CHASE_MOUSE"), true);
  harness.step(1);
  assert.equal(harness.controller.getSnapshot().state, "CHASE_MOUSE");
  harness.controller.destroy();
});

test("Low Power disables cursor and rare events while strongly favoring rest", () => {
  const harness = setup();
  harness.controller.applySettings({
    ...DEFAULT_THUKUNA_SETTINGS,
    lowPowerMode: true
  });
  harness.controller.start();
  harness.step(0);
  const snapshot = harness.controller.getSnapshot();
  assert.equal(snapshot.powerPolicy.mode, "LOW_POWER");
  assert.equal(snapshot.cursor.mode, "OFF");
  assert.equal(snapshot.rareEvent.nextCheckInMs, null);
  assert.equal(snapshot.nextBehaviorWeights.IDLE > snapshot.nextBehaviorWeights.CRAWLING, true);
  assert.equal(snapshot.nextBehaviorWeights.SLEEPING > snapshot.nextBehaviorWeights.LAUGHING, true);
  assert.equal(harness.controller.forceCursorBehavior("CHASE_MOUSE"), false);
  assert.equal(harness.controller.forceRareEvent("DOMAIN_EXPANSION"), false);
  harness.controller.destroy();
});

test("development-forced Domain progresses while paused and cleans up exactly once", () => {
  const harness = setup();
  let dialogueCount = 0;
  harness.controller.setRareEventDialogueHandler(() => { dialogueCount += 1; });
  harness.controller.applySettings({
    ...DEFAULT_THUKUNA_SETTINGS,
    autonomyEnabled: false,
    rareEventsEnabled: false,
    lowPowerMode: true
  });
  harness.controller.start();
  harness.step(0);

  assert.equal(harness.controller.forceRareEvent("DOMAIN_EXPANSION"), false);
  assert.equal(
    harness.controller.forceRareEvent("DOMAIN_EXPANSION", { bypassProductPolicy: true }),
    true
  );
  assert.equal(harness.controller.getSnapshot().state, "DOMAIN_EXPANSION");
  assert.equal(harness.controller.getSnapshot().developmentOverrideActive, true);
  assert.equal(harness.controller.getSnapshot().eventVisual.phase, "FREEZE");
  assert.equal(harness.rareVisualActivations, 1);

  let timestamp = 0;
  const advanceTo = (target: number): void => {
    while (timestamp < target) {
      timestamp = Math.min(timestamp + 250, target);
      harness.step(timestamp);
    }
  };
  advanceTo(700);
  assert.equal(harness.controller.getSnapshot().eventVisual.phase, "AURA");
  assert.equal(dialogueCount, 1);
  advanceTo(900);
  assert.equal(harness.currentAnimation, "domain_expand");
  advanceTo(1_600);
  assert.equal(harness.currentAnimation, "domain_peak");
  advanceTo(2_400);
  assert.equal(harness.currentAnimation, "domain_collapse");
  advanceTo(2_800);
  assert.equal(harness.currentAnimation, "domain_recover");
  advanceTo(3_399);
  assert.equal(harness.controller.getSnapshot().state, "DOMAIN_EXPANSION");
  advanceTo(3_400);

  const completed = harness.controller.getSnapshot();
  assert.equal(completed.state, "IDLE");
  assert.equal(completed.autonomyPaused, true);
  assert.equal(completed.developmentOverrideActive, false);
  assert.equal(completed.eventVisual.activeEvent, null);
  assert.equal(completed.eventVisual.activationCount, 1);
  assert.equal(completed.eventVisual.cleanupCount, 1);
  assert.equal(harness.currentAnimation, "idle");
  harness.controller.destroy();
});

test("Chaos boosts behavior without mutating personality chaos", () => {
  const harness = setup();
  const personalityBefore = harness.controller.getPersonalitySnapshot();
  harness.controller.applySettings({
    ...DEFAULT_THUKUNA_SETTINGS,
    chaosMode: true
  });
  harness.controller.start();
  const snapshot = harness.controller.getSnapshot();
  assert.equal(snapshot.powerPolicy.mode, "CHAOS");
  assert.equal(snapshot.rareEvent.intervalMultiplier, 0.7);
  assert.equal(snapshot.personality.chaos, personalityBefore.chaos);
  harness.controller.destroy();
});

test("hidden runtime cancels work without destroying the controller and resumes cleanly", () => {
  const harness = setup();
  harness.controller.start();
  harness.step(0);
  assert.equal(harness.controller.forceRareEvent("SPRINT"), true);
  harness.controller.setRuntimeVisible(false);
  let snapshot = harness.controller.getSnapshot();
  assert.equal(snapshot.visible, false);
  assert.equal(snapshot.state, "IDLE");
  assert.equal(snapshot.moving, false);
  assert.equal(snapshot.cursor.mode, "OFF");
  assert.equal(snapshot.rareEvent.nextCheckInMs, null);
  assert.equal(harness.pendingFrameCount, 0);
  harness.controller.setRuntimeVisible(true);
  snapshot = harness.controller.getSnapshot();
  assert.equal(snapshot.visible, true);
  assert.equal(snapshot.rareEvent.nextCheckInMs !== null, true);
  assert.equal(harness.pendingFrameCount, 2);
  harness.controller.destroy();
});

test("native Wayland rejects movement states without loops while retaining local events", () => {
  const capabilities = detectPlatformCapabilities("linux", {
    XDG_SESSION_TYPE: "wayland",
    WAYLAND_DISPLAY: "wayland-0"
  });
  const harness = setup(capabilities);
  harness.controller.start();
  harness.step(0);

  for (const state of ["JUMPING", "HOPPING", "CLIMBING", "PERCHED"] as const) {
    harness.controller.forceState(state);
    assert.equal(harness.controller.getSnapshot().state, "IDLE");
  }
  for (const action of ["JUMP", "FALL", "CLIMB_UP", "PERCH", "LAND"] as const) {
    assert.equal(harness.controller.forceLocomotion(action), false);
    assert.equal(harness.controller.getSnapshot().state, "IDLE");
  }
  assert.equal(harness.controller.forceCursorBehavior("CHASE_MOUSE"), false);
  assert.equal(harness.controller.forceRareEvent("SPRINT"), false);
  assert.equal(harness.controller.forceRareEvent("CHAOS_RUN"), false);
  assert.equal(harness.controller.forceRareEvent("DOMAIN_EXPANSION"), true);
  assert.equal(harness.controller.getSnapshot().state, "DOMAIN_EXPANSION");
  assert.equal(
    harness.controller.getSnapshot().platformCapabilities.displayServer,
    "wayland"
  );
  harness.controller.destroy();
});
