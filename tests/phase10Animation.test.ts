import assert from "node:assert/strict";
import test from "node:test";
import {
  AnimationController,
  normalizeSpriteFrame,
  type AnimationDefinition
} from "../src/renderer/engine/AnimationController";

class FakeStyle {
  private readonly values = new Map<string, string>();
  public setProperty(name: string, value: string): void { this.values.set(name, value); }
  public getPropertyValue(name: string): string { return this.values.get(name) ?? ""; }
}

class FakeClassList {
  private readonly values = new Set<string>();
  public add(value: string): void { this.values.add(value); }
  public remove(value: string): void { this.values.delete(value); }
  public contains(value: string): boolean { return this.values.has(value); }
  public toggle(value: string, force?: boolean): boolean {
    const enabled = force ?? !this.values.has(value);
    if (enabled) this.values.add(value); else this.values.delete(value);
    return enabled;
  }
}

const fakeElement = () => ({
  dataset: {} as Record<string, string>,
  style: new FakeStyle(),
  classList: new FakeClassList(),
  offsetWidth: 180
});

test("sprite metadata defaults and sanitizes invalid values", () => {
  assert.deepEqual(normalizeSpriteFrame("idle.png", 120), {
    src: "idle.png", offsetX: 0, offsetY: 0, scale: 1,
    anchor: "GROUND", durationMs: 120
  });
  assert.deepEqual(
    normalizeSpriteFrame({
      src: "jump.png", offsetX: 12, offsetY: -7, scale: 1.2,
      anchor: "AIR", durationMs: 175
    }),
    {
      src: "jump.png", offsetX: 12, offsetY: -7, scale: 1.2,
      anchor: "AIR", durationMs: 175
    }
  );
  const invalid = normalizeSpriteFrame({
    src: "safe.png", offsetX: Number.NaN, offsetY: Infinity,
    scale: 99, anchor: "BAD" as "GROUND", durationMs: -1
  });
  assert.equal(invalid.offsetX, 0);
  assert.equal(invalid.offsetY, 0);
  assert.equal(invalid.scale, 1.5);
  assert.equal(invalid.anchor, "GROUND");
  assert.equal(invalid.durationMs, 16);
});

test("frame metadata is applied only to the dedicated frame layer", () => {
  const image = {
    ...fakeElement(), src: "",
    getAttribute(name: string) { return name === "src" ? this.src : null; }
  };
  const direction = fakeElement();
  const motion = fakeElement();
  const interaction = fakeElement();
  const frame = fakeElement();
  const library: Record<"air", AnimationDefinition<"air">> = {
    air: {
      frames: [{ src: "air.png", offsetX: 4, offsetY: -9, scale: 1.1, anchor: "AIR", durationMs: 90 }],
      loop: true, motion: "air"
    }
  };
  const controller = new AnimationController(
    image as unknown as HTMLImageElement,
    direction as unknown as HTMLElement,
    motion as unknown as HTMLElement,
    interaction as unknown as HTMLElement,
    library, "right", undefined, frame as unknown as HTMLElement
  );
  controller.play("air");
  assert.equal(frame.dataset.anchor, "AIR");
  assert.equal(frame.style.getPropertyValue("--frame-offset-x"), "4px");
  assert.equal(frame.style.getPropertyValue("--frame-offset-y"), "-9px");
  assert.equal(frame.style.getPropertyValue("--frame-scale"), "1.1");
  assert.equal(direction.dataset.direction, "right");
});

test("animation sequences advance without timers and respect frame durations", () => {
  let nextId = 1;
  const callbacks = new Map<number, FrameRequestCallback>();
  globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    const id = nextId++; callbacks.set(id, callback); return id;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => { callbacks.delete(id); }) as typeof cancelAnimationFrame;
  const step = (time: number) => {
    const [id, callback] = [...callbacks.entries()][0];
    callbacks.delete(id); callback(time);
  };
  const image = {
    ...fakeElement(), src: "",
    getAttribute(name: string) { return name === "src" ? this.src : null; }
  };
  const library: Record<"prepare" | "air", AnimationDefinition<"prepare" | "air">> = {
    prepare: {
      frames: [
        { src: "p1.png", durationMs: 50 },
        { src: "p2.png", durationMs: 100 }
      ], loop: false, motion: "air"
    },
    air: { frames: ["air.png"], loop: true, motion: "air", fps: 1 }
  };
  const controller = new AnimationController(
    image as unknown as HTMLImageElement,
    fakeElement() as unknown as HTMLElement,
    fakeElement() as unknown as HTMLElement,
    fakeElement() as unknown as HTMLElement,
    library
  );
  controller.playSequence(["prepare", "air"]);
  step(0);
  step(50);
  assert.equal(controller.getSnapshot().frameIndex, 1);
  assert.equal(controller.getSnapshot().frameDurationMs, 100);
  step(150);
  assert.equal(controller.getCurrentAnimation(), "air");
  assert.equal(controller.getSnapshot().sequenceRemaining.length, 0);
  controller.destroy();
});
