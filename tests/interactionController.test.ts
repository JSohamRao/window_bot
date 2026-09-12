import assert from "node:assert/strict";
import test from "node:test";
import { DialogueController } from "../src/renderer/engine/DialogueController";
import {
  InteractionController,
  isLongDrag,
  type InteractionBehaviorPort,
  type InteractionReaction,
  type PostDragReaction
} from "../src/renderer/engine/InteractionController";
import {
  PersonalityController,
  type PersonalitySnapshot
} from "../src/renderer/engine/PersonalityController";

class FakeClassList {
  public add(_value: string): void {}
  public remove(_value: string): void {}
}

const createBubble = (): HTMLElement => ({
  textContent: "",
  dataset: {},
  classList: new FakeClassList(),
  setAttribute: () => undefined
}) as unknown as HTMLElement;

class FakeBehavior implements InteractionBehaviorPort {
  public reactions: InteractionReaction[] = [];
  public drops: PostDragReaction[] = [];
  public dragStarts = 0;
  public rageActive = false;
  public overrideActive = false;
  public manuallyPaused = false;
  public personality: PersonalitySnapshot = {
    irritation: 15,
    energy: 75,
    boredom: 20,
    chaos: 30
  };
  public clickEffects = 0;
  public annoyedEffects = 0;
  public angryEffects = 0;
  public rageEffects = 0;
  public dragEffects: boolean[] = [];

  public beginDrag(): void {
    this.dragStarts += 1;
    this.overrideActive = false;
  }
  public endDrag(reaction: PostDragReaction): void { this.drops.push(reaction); }
  public beginInteractionReaction(reaction: InteractionReaction): boolean {
    this.reactions.push(reaction);
    this.rageActive = reaction === "RAGE";
    this.overrideActive = true;
    return true;
  }
  public isRageActive(): boolean { return this.rageActive; }
  public isInteractionOverrideActive(): boolean { return this.overrideActive; }
  public getPersonalitySnapshot(): PersonalitySnapshot { return { ...this.personality }; }
  public onClick(): void { this.clickEffects += 1; }
  public onAnnoyedCombo(): void { this.annoyedEffects += 1; }
  public onAngryCombo(): void { this.angryEffects += 1; }
  public onRage(): void { this.rageEffects += 1; }
  public onDragComplete(metrics: { longDrag: boolean }): void {
    this.dragEffects.push(metrics.longDrag);
  }
}

const createController = (behavior = new FakeBehavior()) => ({
  behavior,
  controller: new InteractionController(
    behavior,
    new DialogueController(createBubble(), { next: () => 0 }),
    { next: () => 0 }
  )
});

const click = (controller: InteractionController, nowMs: number, button = 0): void => {
  controller.pointerDown(button, { x: 10, y: 10 }, nowMs);
  controller.pointerUp({ x: 10, y: 10 }, nowMs + 10);
};

test("single left click counts and right click is ignored", () => {
  const { controller } = createController();
  click(controller, 0);
  click(controller, 100, 2);
  assert.equal(controller.getSnapshot(200).clickCount, 1);
});

test("combo resets after its timeout", () => {
  const { controller } = createController();
  click(controller, 0);
  controller.update(3_011);
  assert.equal(controller.getSnapshot(3_011).clickCount, 0);
});

test("3, 5, and 10 click thresholds each fire once", () => {
  const { behavior, controller } = createController();
  for (let index = 0; index < 12; index += 1) {
    click(controller, index * 100);
    if (behavior.rageActive) {
      behavior.rageActive = false;
    }
  }
  assert.equal(behavior.reactions.filter((value) => value === "RAGE").length, 1);
  assert.equal(behavior.reactions.filter((value) => value === "ANGRY").length, 2);
  assert.equal(behavior.annoyedEffects, 1);
  assert.equal(behavior.angryEffects, 1);
  assert.equal(behavior.rageEffects, 1);
});

test("drag release never counts as a click and records metrics", () => {
  const { behavior, controller } = createController();
  controller.pointerDown(0, { x: 0, y: 0 }, 100);
  const move = controller.pointerMove({ x: 30, y: 40 }, 500);
  const result = controller.pointerUp({ x: 60, y: 80 }, 1_100);
  assert.equal(move.dragStarted, true);
  assert.equal(result.kind, "drag");
  assert.equal(controller.getSnapshot(1_100).clickCount, 0);
  assert.equal(result.dragMetrics?.durationMs, 1_000);
  assert.equal(result.dragMetrics?.distancePx, 100);
  assert.equal(behavior.dragStarts, 1);
  assert.deepEqual(behavior.dragEffects, [false]);
});

test("release beyond threshold without a move event is still not a click", () => {
  const { controller } = createController();
  controller.pointerDown(0, { x: 0, y: 0 }, 0);
  const result = controller.pointerUp({ x: 10, y: 0 }, 100);
  assert.equal(result.kind, "drag");
  assert.equal(controller.getSnapshot(100).clickCount, 0);
});

test("long drag classification uses duration or distance", () => {
  assert.equal(isLongDrag({ durationMs: 2_001, distancePx: 1 }), true);
  assert.equal(isLongDrag({ durationMs: 1, distancePx: 501 }), true);
  assert.equal(isLongDrag({ durationMs: 2_000, distancePx: 500 }), false);
});

test("rage cooldown blocks retrigger in a new combo", () => {
  const { behavior, controller } = createController();
  for (let index = 0; index < 10; index += 1) click(controller, index * 100);
  behavior.rageActive = false;
  controller.update(4_000);
  for (let index = 0; index < 10; index += 1) click(controller, 4_100 + index * 100);
  assert.equal(behavior.reactions.filter((value) => value === "RAGE").length, 1);
  assert.equal(behavior.rageEffects, 1);
});

test("high irritation can bias ordinary click dialogue toward angry", () => {
  const behavior = new FakeBehavior();
  behavior.personality = { ...behavior.personality, irritation: 80 };
  const values = [0.5, 0, 0, 0, 0];
  const dialogue = new DialogueController(createBubble(), {
    next: () => values.shift() ?? 0
  });
  const controller = new InteractionController(behavior, dialogue, {
    next: () => values.shift() ?? 0
  });
  click(controller, 0);
  assert.equal(controller.getSnapshot(10).dialogue.category, "angry");
});

test("interaction does not change a manual autonomy pause flag", () => {
  const behavior = new FakeBehavior();
  behavior.manuallyPaused = true;
  const { controller } = createController(behavior);
  click(controller, 0);
  assert.equal(behavior.manuallyPaused, true);
});

test("personality effects outlive the temporary click combo", () => {
  const behavior = new FakeBehavior();
  const personality = new PersonalityController();
  behavior.getPersonalitySnapshot = () => personality.getSnapshot();
  behavior.onClick = () => personality.onClick();
  behavior.onAnnoyedCombo = () => personality.onAnnoyedCombo();
  const controller = new InteractionController(
    behavior,
    new DialogueController(createBubble(), { next: () => 0 }),
    { next: () => 0 }
  );
  click(controller, 0);
  click(controller, 100);
  click(controller, 200);
  controller.update(3_211);
  assert.equal(controller.getSnapshot(3_211).clickCount, 0);
  assert.equal(personality.getSnapshot().irritation, 26);
});
