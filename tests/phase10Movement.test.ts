import assert from "node:assert/strict";
import test from "node:test";
import { LOCOMOTION_CONFIG } from "../src/renderer/config/locomotionConfig";
import { LocomotionController } from "../src/renderer/engine/LocomotionController";
import { MovementController, type MovementApi } from "../src/renderer/engine/MovementController";
import { planCursorMovement } from "../src/renderer/engine/MovementPlanner";

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

const createMotion = (initialX = 100, initialY = 750) => {
  let x = initialX;
  let y = initialY;
  const calls: Array<{ dx: number; dy: number }> = [];
  const api: MovementApi = {
    getPosition: async () => ({
      x, y, floorY: 750, workAreaLeft: 0, workAreaRight: 820,
      workAreaTop: 0, workAreaBottom: 1_000
    }),
    moveBy: async (dx, dy = 0) => {
      const requestedX = x + dx;
      const requestedY = y + dy;
      x = Math.min(Math.max(requestedX, 0), 820);
      y = Math.min(Math.max(requestedY, 0), 750);
      calls.push({ dx, dy });
      return {
        x, y, hitBoundary: x !== requestedX || y !== requestedY,
        hitBoundaryX: x !== requestedX, hitBoundaryY: y !== requestedY,
        floorY: 750, workAreaLeft: 0, workAreaRight: 820,
        workAreaTop: 0, workAreaBottom: 1_000
      };
    }
  };
  return { movement: new MovementController(api, 30), calls, get position() { return { x, y }; } };
};

test("MovementController supports x, y, diagonal, fractional, and axis stops", async () => {
  const harness = createMotion();
  await harness.movement.syncPosition();
  harness.movement.setVelocity(80, -40);
  harness.movement.update(100);
  await flush();
  assert.deepEqual(harness.calls.at(-1), { dx: 8, dy: -4 });
  harness.movement.stopX();
  harness.movement.update(100);
  await flush();
  assert.deepEqual(harness.calls.at(-1), { dx: 0, dy: -4 });
  harness.movement.stopY();
  assert.equal(harness.movement.isMoving(), false);
  harness.movement.setVelocity(7, 0);
  harness.movement.update(50);
  await flush();
  harness.movement.update(100);
  await flush();
  assert.equal(harness.calls.some(({ dx }) => dx === 1), true);
  harness.movement.stop();
  assert.deepEqual(harness.movement.getVelocity(), { x: 0, y: 0 });
});

const runJump = async (deltaMs: number) => {
  const harness = createMotion();
  await harness.movement.syncPosition();
  const layer = { dataset: {} as Record<string, string> };
  const locomotion = new LocomotionController(
    harness.movement, layer as unknown as HTMLElement
  );
  assert.equal(locomotion.beginJump("JUMP", "right"), true);
  locomotion.update(LOCOMOTION_CONFIG.jump.prepareMs);
  let velocity = harness.movement.getVelocity();
  assert.equal(velocity.y < 0, true);
  let apex = harness.position.y;
  let sawFalling = false;
  for (let iteration = 0; iteration < 200 && !locomotion.isComplete(); iteration += 1) {
    locomotion.update(deltaMs);
    await flush();
    apex = Math.min(apex, harness.position.y);
    velocity = harness.movement.getVelocity();
    if (velocity.y >= 0) sawFalling = true;
  }
  assert.equal(sawFalling, true);
  assert.equal(
    locomotion.isComplete(),
    true,
    JSON.stringify({ locomotion: locomotion.getSnapshot(), position: harness.position })
  );
  assert.equal(harness.position.y, 750);
  assert.equal(harness.movement.getSnapshot().grounded, true);
  assert.equal(harness.movement.getVelocity().y, 0);
  assert.equal(layer.dataset.action, "NONE");
  return apex;
};

test("jump rises, reaches an apex, falls, lands once, and restores identity", async () => {
  const apex = await runJump(1000 / 60);
  assert.equal(apex < 650, true);
});

test("jump trajectory is approximately frame-rate independent", async () => {
  const apex60 = await runJump(1000 / 60);
  const apex30 = await runJump(1000 / 30);
  assert.equal(Math.abs(apex60 - apex30) <= 12, true);
});

test("climb attaches only at an edge and moves vertically", async () => {
  const middle = createMotion(100, 750);
  await middle.movement.syncPosition();
  assert.equal(new LocomotionController(middle.movement).beginClimb(-1), false);
  const edge = createMotion(0, 750);
  await edge.movement.syncPosition();
  const locomotion = new LocomotionController(edge.movement);
  assert.equal(locomotion.beginClimb(-1), true);
  locomotion.update(220);
  await flush();
  locomotion.update(100);
  await flush();
  assert.equal(edge.position.x, 0);
  assert.equal(edge.position.y < 750, true);
  assert.equal(edge.position.y >= 0, true);
});

test("perch stops movement and drop leaves the perch", async () => {
  const edge = createMotion(0, 500);
  await edge.movement.syncPosition();
  const locomotion = new LocomotionController(edge.movement);
  locomotion.perch();
  assert.equal(locomotion.getSnapshot().mode, "PERCHED");
  assert.equal(edge.movement.isMoving(), false);
  locomotion.leavePerchAsDrop();
  assert.equal(locomotion.getSnapshot().mode, "FALLING");
  assert.equal(edge.movement.getVelocity().y > 0, true);
});

test("2D chase planner selects grounded, vertical, edge, drop, far, and Low Power actions", () => {
  const base = createMotion().movement.getSnapshot();
  const input = { cursorDistancePx: 200, sameDisplay: true, movement: { ...base, grounded: true, x: 100, workAreaLeft: 0, workAreaRight: 820 }, powerMode: "NORMAL" as const };
  assert.equal(planCursorMovement({ ...input, cursorHorizontalDeltaPx: 120, cursorVerticalDeltaPx: 0 }), "CRAWL_RIGHT");
  assert.equal(planCursorMovement({ ...input, cursorHorizontalDeltaPx: -120, cursorVerticalDeltaPx: -80 }), "HOP_LEFT");
  assert.equal(planCursorMovement({ ...input, cursorHorizontalDeltaPx: 120, cursorVerticalDeltaPx: -180 }), "JUMP_RIGHT");
  assert.equal(planCursorMovement({ ...input, movement: { ...input.movement, x: 0 }, cursorHorizontalDeltaPx: -120, cursorVerticalDeltaPx: -180 }), "CLIMB_UP");
  assert.equal(planCursorMovement({ ...input, movement: { ...input.movement, grounded: false }, cursorHorizontalDeltaPx: 20, cursorVerticalDeltaPx: 120 }), "DROP");
  assert.equal(planCursorMovement({ ...input, cursorDistancePx: 900, cursorHorizontalDeltaPx: 20, cursorVerticalDeltaPx: 0 }), "GIVE_UP");
  assert.equal(planCursorMovement({ ...input, powerMode: "LOW_POWER", cursorHorizontalDeltaPx: 120, cursorVerticalDeltaPx: -180 }), "GIVE_UP");
});

test("25 cycles of every temporary locomotion action reset visual ownership", async () => {
  const harness = createMotion(0, 750);
  await harness.movement.syncPosition();
  const layer = { dataset: {} as Record<string, string> };
  const locomotion = new LocomotionController(harness.movement, layer as unknown as HTMLElement);
  const actions = [
    () => locomotion.beginJump("JUMP", "right"),
    () => locomotion.beginJump("HOP", "right"),
    () => locomotion.beginFall(),
    () => locomotion.beginClimb(-1),
    () => locomotion.land()
  ];
  for (const beginAction of actions) {
    for (let index = 0; index < 25; index += 1) {
      beginAction();
      locomotion.cancel();
      assert.equal(layer.dataset.action, "NONE");
    }
  }
});
