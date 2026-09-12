import assert from "node:assert/strict";
import test from "node:test";
import { PET_WINDOW_HEIGHT, PET_WINDOW_WIDTH } from "../src/shared/windowGeometry";
import { clampWindowPosition } from "../src/main/windowBounds";

test("2D clamping keeps all four corners fully recoverable", () => {
  const workArea = { x: -100, y: 20, width: 1_000, height: 800 };
  assert.deepEqual(clampWindowPosition(-999, -999, 180, 250, workArea), { x: -100, y: 20 });
  assert.deepEqual(clampWindowPosition(9_999, -999, 180, 250, workArea), { x: 720, y: 20 });
  assert.deepEqual(clampWindowPosition(-999, 9_999, 180, 250, workArea), { x: -100, y: 570 });
  assert.deepEqual(clampWindowPosition(9_999, 9_999, 180, 250, workArea), { x: 720, y: 570 });
});

test("Phase 10 preserves the canonical BrowserWindow geometry", () => {
  assert.equal(PET_WINDOW_WIDTH, 180);
  assert.equal(PET_WINDOW_HEIGHT, 250);
});
