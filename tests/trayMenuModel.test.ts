import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_THUKUNA_SETTINGS } from "../src/shared/settings";
import { detectPlatformCapabilities } from "../src/shared/platform";
import {
  createProductivityTimerTrayModel,
  createTrayMenuModel
} from "../src/main/trayMenuModel";
import {
  createIdleProductivityTimerSnapshot,
  type ProductivityTimerSnapshot
} from "../src/shared/productivityTimer";

const byId = (visible: boolean, settings = DEFAULT_THUKUNA_SETTINGS) =>
  Object.fromEntries(createTrayMenuModel(settings, visible).map((item) => [item.id, item]));

test("tray visibility label reflects the existing window", () => {
  assert.equal(byId(true).VISIBILITY.label, "Hide Thukuna");
  assert.equal(byId(false).VISIBILITY.label, "Show Thukuna");
});

test("tray autonomy label reflects the single persisted setting", () => {
  assert.equal(byId(true).AUTONOMY.label, "Pause Autonomy");
  assert.equal(byId(true, { ...DEFAULT_THUKUNA_SETTINGS, autonomyEnabled: false }).AUTONOMY.label, "Resume Autonomy");
});

test("tray checkmarks reflect every feature setting", () => {
  const items = byId(true, {
    ...DEFAULT_THUKUNA_SETTINGS,
    dialogueEnabled: false,
    rareEventsEnabled: false,
    lowPowerMode: true
  });
  assert.equal(items.DIALOGUE.checked, false);
  assert.equal(items.MOUSE_AWARENESS.checked, true);
  assert.equal(items.RARE_EVENTS.checked, false);
  assert.equal(items.LOW_POWER_MODE.checked, true);
});

test("tray model includes reset, startup, and explicit Quit actions", () => {
  const ids = createTrayMenuModel(DEFAULT_THUKUNA_SETTINGS, true).map((item) => item.id);
  assert.equal(ids.includes("RESET_POSITION"), true);
  assert.equal(ids.includes("LAUNCH_ON_STARTUP"), true);
  assert.equal(ids.at(-1), "QUIT");
});

test("native Wayland disables unsupported tray actions without dropping settings", () => {
  const capabilities = detectPlatformCapabilities("linux", {
    XDG_SESSION_TYPE: "wayland",
    WAYLAND_DISPLAY: "wayland-0"
  });
  const items = Object.fromEntries(
    createTrayMenuModel(DEFAULT_THUKUNA_SETTINGS, true, capabilities).map(
      (item) => [item.id, item]
    )
  );
  assert.equal(items.RESET_POSITION.enabled, false);
  assert.equal(items.RESET_POSITION.label, "Reset Position (Unavailable)");
  assert.equal(items.ALWAYS_ON_TOP.enabled, false);
  assert.equal(items.LAUNCH_ON_STARTUP.enabled, true);
  assert.equal(items.ALWAYS_ON_TOP.checked, true);
});

const timerItems = (snapshot: ProductivityTimerSnapshot) => Object.fromEntries(
  createProductivityTimerTrayModel(snapshot).map((item) => [item.id, item])
);

test("idle timer tray enables presets and disables lifecycle controls", () => {
  const items = timerItems(createIdleProductivityTimerSnapshot());
  assert.equal(items["focus-25"].enabled, true);
  assert.equal(items.TIMER_PAUSE.enabled, false);
  assert.equal(items.TIMER_RESUME.enabled, false);
  assert.equal(items.TIMER_CANCEL.enabled, false);
});

test("running timer tray reports remaining time and enables Pause and Cancel", () => {
  const items = timerItems({
    state: "running", durationMs: 300_000, remainingMs: 123_400,
    startedAt: 1, deadlineAt: 300_001, pausedAt: null, completedAt: null,
    kind: "focus", label: "Focus", timerId: "timer", completionId: null,
    completionPending: false, schedulerActive: true, updatedAt: 2
  });
  assert.match(items.TIMER_STATUS.label, /2:04/);
  assert.equal(items["focus-25"].enabled, false);
  assert.equal(items.TIMER_PAUSE.enabled, true);
  assert.equal(items.TIMER_RESUME.enabled, false);
  assert.equal(items.TIMER_CANCEL.enabled, true);
});

test("paused timer tray enables Resume without changing timer data", () => {
  const snapshot: ProductivityTimerSnapshot = {
    state: "paused", durationMs: 300_000, remainingMs: 123_400,
    startedAt: 1, deadlineAt: null, pausedAt: 2, completedAt: null,
    kind: "focus", label: "Focus", timerId: "timer", completionId: null,
    completionPending: false, schedulerActive: false, updatedAt: 2
  };
  const before = JSON.stringify(snapshot);
  const items = timerItems(snapshot);
  assert.equal(items.TIMER_PAUSE.enabled, false);
  assert.equal(items.TIMER_RESUME.enabled, true);
  assert.equal(items.TIMER_CANCEL.enabled, true);
  assert.equal(JSON.stringify(snapshot), before);
});
