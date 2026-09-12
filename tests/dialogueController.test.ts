import assert from "node:assert/strict";
import test from "node:test";
import { DialogueController } from "../src/renderer/engine/DialogueController";

class FakeClassList {
  private readonly values = new Set<string>();
  public add(value: string): void { this.values.add(value); }
  public remove(value: string): void { this.values.delete(value); }
  public contains(value: string): boolean { return this.values.has(value); }
}

const createBubble = (): HTMLElement => {
  const attributes = new Map<string, string>();
  return {
    textContent: "",
    dataset: {},
    classList: new FakeClassList(),
    setAttribute: (name: string, value: string) => attributes.set(name, value)
  } as unknown as HTMLElement;
};

test("DialogueController returns a valid category line and expires it", () => {
  const bubble = createBubble();
  const dialogue = new DialogueController(bubble, { next: () => 0 });
  assert.equal(dialogue.show("clicked", 100, { durationMs: 500 }), true);
  assert.equal(["what.", "hm?", "why.", "stop.", "you again.", "interesting."].includes(bubble.textContent ?? ""), true);
  assert.equal(dialogue.getSnapshot(200).active, true);
  dialogue.update(600);
  assert.equal(dialogue.getSnapshot(600).active, false);
});

test("DialogueController avoids immediate repetition within a category", () => {
  const bubble = createBubble();
  const dialogue = new DialogueController(bubble, { next: () => 0 });
  dialogue.show("rage", 0, { bypassCooldown: true });
  const first = bubble.textContent;
  dialogue.hide();
  dialogue.show("rage", 1, { bypassCooldown: true });
  assert.notEqual(bubble.textContent, first);
});

test("mouse dialogue uses the Phase 7 category and existing cooldown path", () => {
  const bubble = createBubble();
  const dialogue = new DialogueController(bubble, { next: () => 0 });
  assert.equal(dialogue.show("mouse", 0), true);
  assert.equal(bubble.textContent, "come here.");
  assert.equal(dialogue.getSnapshot(100).category, "mouse");
  dialogue.hide();
  assert.equal(dialogue.show("mouse", 100), false);
});

test("Domain dialogue can replace an active line while bypassing cooldown", () => {
  const bubble = createBubble();
  const dialogue = new DialogueController(bubble, { next: () => 0 });
  dialogue.show("clicked", 0);
  assert.equal(
    dialogue.show("domain", 100, { bypassCooldown: true, replace: true }),
    true
  );
  assert.equal(dialogue.getSnapshot(100).category, "domain");
  assert.equal(bubble.textContent, "DOMAIN EXPANSION.");
});

test("Domain can request its exact staged opening line", () => {
  const bubble = createBubble();
  const controller = new DialogueController(bubble, { next: () => 0.99 });
  assert.equal(
    controller.show("domain", 0, { preferredLine: "DOMAIN EXPANSION." }),
    true
  );
  assert.equal(controller.getSnapshot(0).line, "DOMAIN EXPANSION.");
});

test("disabled dialogue hides the current bubble and suppresses future output", () => {
  const bubble = createBubble();
  const dialogue = new DialogueController(bubble, { next: () => 0 });
  dialogue.show("clicked", 0);
  dialogue.setEnabled(false);
  assert.equal(dialogue.getSnapshot(1).active, false);
  assert.equal(dialogue.show("rage", 1, { bypassCooldown: true }), false);
  assert.equal(dialogue.isEnabled(), false);
});

test("re-enabling dialogue preserves normal cooldown semantics", () => {
  const dialogue = new DialogueController(createBubble(), { next: () => 0 });
  dialogue.show("clicked", 0);
  dialogue.setEnabled(false);
  dialogue.setEnabled(true);
  assert.equal(dialogue.show("clicked", 1), false);
  assert.equal(dialogue.show("clicked", 1, { bypassCooldown: true }), true);
});
