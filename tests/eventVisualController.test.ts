import assert from "node:assert/strict";
import test from "node:test";
import {
  RARE_EVENT_CONFIG,
  RARE_EVENT_NAMES
} from "../src/renderer/config/rareEventConfig";
import { EventVisualController } from "../src/renderer/engine/EventVisualController";

class FakeStyle {
  private readonly values = new Map<string, string>();
  public setProperty(name: string, value: string): void { this.values.set(name, value); }
  public removeProperty(name: string): string {
    const value = this.values.get(name) ?? "";
    this.values.delete(name);
    return value;
  }
  public getPropertyValue(name: string): string { return this.values.get(name) ?? ""; }
}

const createLayer = () => ({
  dataset: {} as Record<string, string>,
  style: new FakeStyle(),
  offsetWidth: 180
});

test("event visuals use canonical state and reset to identity ownership", () => {
  const layer = createLayer();
  const visuals = new EventVisualController(layer as unknown as HTMLElement);
  visuals.activate("ZOOM_STARE", 3_000);
  assert.equal(layer.dataset.rareEvent, "ZOOM_STARE");
  assert.equal(layer.style.getPropertyValue("--rare-event-duration"), "3000ms");
  assert.equal(layer.style.getPropertyValue("--rare-event-max-scale"), "1.25");
  assert.equal(layer.style.getPropertyValue("--rare-event-fall-rotation"), "90deg");
  visuals.reset();
  assert.equal(layer.dataset.rareEvent, "NONE");
  assert.equal(layer.style.getPropertyValue("--rare-event-duration"), "");
  assert.deepEqual(visuals.getSnapshot(), {
    activeEvent: null,
    durationMs: 0,
    phase: "NONE",
    activationCount: 1,
    cleanupCount: 1
  });
});

test("25 repeated fall, zoom, and Domain activations never accumulate transform state", () => {
  const layer = createLayer();
  const visuals = new EventVisualController(layer as unknown as HTMLElement);
  for (const event of ["FALL_OVER", "ZOOM_STARE", "DOMAIN_EXPANSION"] as const) {
    for (let iteration = 0; iteration < 25; iteration += 1) {
      visuals.activate(event, 3_000);
      visuals.reset();
      assert.equal(layer.dataset.rareEvent, "NONE");
      assert.equal(visuals.getSnapshot().activeEvent, null);
    }
  }
});

test("every typed event is supported and the configured scale stays capped", () => {
  const layer = createLayer();
  const visuals = new EventVisualController(layer as unknown as HTMLElement);
  for (const event of RARE_EVENT_NAMES) {
    visuals.activate(event, 1_000);
    assert.equal(visuals.getSnapshot().activeEvent, event);
  }
  assert.equal(RARE_EVENT_CONFIG.maximumEventScale <= 1.25, true);
});
