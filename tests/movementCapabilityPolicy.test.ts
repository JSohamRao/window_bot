import assert from "node:assert/strict";
import test from "node:test";
import {
  detectPlatformCapabilities,
  resolveMovementCapabilityPolicy
} from "../src/shared/platform";
import { DEFAULT_THUKUNA_SETTINGS } from "../src/shared/settings";

const settings = { ...DEFAULT_THUKUNA_SETTINGS };

test("Windows and Linux X11/XWayland Normal mode allow full locomotion", () => {
  const matrices = [
    detectPlatformCapabilities("win32"),
    detectPlatformCapabilities("linux", { DISPLAY: ":0" }),
    detectPlatformCapabilities("linux", {
      WAYLAND_DISPLAY: "wayland-0",
      DISPLAY: ":1"
    })
  ];
  for (const capabilities of matrices) {
    const policy = resolveMovementCapabilityPolicy(capabilities, settings);
    assert.equal(policy.jumpAllowed, true);
    assert.equal(policy.edgeClimbAllowed, true);
    assert.equal(policy.cursorChaseAllowed, true);
    assert.equal(policy.resetPositionAllowed, true);
  }
});

test("native Wayland preserves local events while blocking absolute movement", () => {
  const policy = resolveMovementCapabilityPolicy(
    detectPlatformCapabilities("linux", {
      XDG_SESSION_TYPE: "wayland",
      WAYLAND_DISPLAY: "wayland-0"
    }),
    settings
  );
  assert.equal(policy.groundMovementAllowed, false);
  assert.equal(policy.gravityMovementAllowed, false);
  assert.equal(policy.jumpAllowed, false);
  assert.equal(policy.cursorChaseAllowed, false);
  assert.equal(policy.movingRareEventsAllowed, false);
  assert.equal(policy.localRareEventsAllowed, true);
  assert.equal(policy.resetPositionAllowed, false);
});

test("Low Power blocks vertical motion on every full-capability platform", () => {
  for (const capabilities of [
    detectPlatformCapabilities("win32"),
    detectPlatformCapabilities("linux", { DISPLAY: ":0" })
  ]) {
    const policy = resolveMovementCapabilityPolicy(capabilities, {
      ...settings,
      lowPowerMode: true
    });
    assert.equal(policy.jumpAllowed, false);
    assert.equal(policy.hopAllowed, false);
    assert.equal(policy.edgeClimbAllowed, false);
    assert.equal(policy.cursorChaseAllowed, false);
  }
});

test("Chaos cannot bypass native Wayland restrictions", () => {
  const policy = resolveMovementCapabilityPolicy(
    detectPlatformCapabilities("linux", {
      XDG_SESSION_TYPE: "wayland",
      WAYLAND_DISPLAY: "wayland-0"
    }),
    { ...settings, chaosMode: true }
  );
  assert.equal(policy.jumpAllowed, false);
  assert.equal(policy.movingRareEventsAllowed, false);
  assert.equal(policy.localRareEventsAllowed, true);
});

test("unsupported settings remain values but produce no repeated capability attempts", () => {
  const requested = { ...settings, alwaysOnTop: true, mouseAwarenessEnabled: true };
  const policy = resolveMovementCapabilityPolicy(
    detectPlatformCapabilities("linux", {}),
    requested
  );
  assert.equal(requested.alwaysOnTop, true);
  assert.equal(requested.mouseAwarenessEnabled, true);
  assert.equal(policy.cursorScreenPositionAllowed, false);
});
