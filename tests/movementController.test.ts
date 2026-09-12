import assert from "node:assert/strict";
import test from "node:test";
import { MovementController, type MovementApi } from "../src/renderer/engine/MovementController";

const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("MovementController calculates delta-time movement and preserves direction", async () => {
  const deltas: number[] = [];
  const api: MovementApi = {
    moveBy: async (deltaX) => {
      deltas.push(deltaX);
      return { x: 100, y: 200, hitBoundary: false };
    }
  };
  const movement = new MovementController(api, 30);
  movement.start("left", 80);

  for (let index = 0; index < 10; index += 1) {
    movement.update(50);
    await settle();
  }

  assert.equal(movement.getDirection(), "left");
  assert.equal(deltas.reduce((total, delta) => total + delta, 0), -40);
  assert.equal(movement.getSnapshot().moving, true);
});

test("MovementController stop prevents further movement", async () => {
  let calls = 0;
  const movement = new MovementController({
    moveBy: async () => {
      calls += 1;
      return { x: 0, y: 0, hitBoundary: false };
    }
  });
  movement.start("right", 60);
  movement.stop();
  movement.update(1_000);
  await settle();
  assert.equal(calls, 0);
  assert.equal(movement.isMoving(), false);
  assert.equal(movement.getSpeed(), 0);
});

test("MovementController reports a work-area boundary and stops", async () => {
  const movement = new MovementController({
    moveBy: async () => ({ x: 0, y: 0, hitBoundary: true })
  });
  movement.start("left", 90);
  movement.update(40);
  await settle();
  assert.equal(movement.consumeBoundaryReached(), true);
  assert.equal(movement.isMoving(), false);
});

test("MovementController throttles IPC updates to at most 30 per second", async () => {
  let calls = 0;
  let requestedDistance = 0;
  const movement = new MovementController({
    moveBy: async (deltaX) => {
      calls += 1;
      requestedDistance += deltaX;
      return { x: requestedDistance, y: 0, hitBoundary: false };
    }
  }, 30);
  movement.start("right", 80);

  for (let frame = 0; frame < 120; frame += 1) {
    movement.update(1_000 / 120);
    await settle();
  }

  assert.equal(calls <= 30, true);
  assert.equal(requestedDistance >= 79 && requestedDistance <= 80, true);
});
