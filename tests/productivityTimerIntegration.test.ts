import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  createIdleProductivityTimerSnapshot,
  formatProductivityTimerRemaining,
  isProductivityTimerSnapshot,
  isProductivityTimerStartRequest
} from "../src/shared/productivityTimer";
import { formatProductivityTimerDiagnostics } from "../src/renderer/dev/ProductivityTimerDiagnostics";

const source = (file: string): string =>
  readFileSync(path.join(process.cwd(), file), "utf8");

test("timer request validation accepts production bounds and only explicit dev durations", () => {
  assert.equal(isProductivityTimerStartRequest({
    kind: "focus", durationMs: 60_000, label: "Focus"
  }), true);
  assert.equal(isProductivityTimerStartRequest({
    kind: "focus", durationMs: 5_000, label: "Test"
  }), false);
  assert.equal(isProductivityTimerStartRequest({
    kind: "focus", durationMs: 5_000, label: "Test"
  }, true), true);
  assert.equal(isProductivityTimerStartRequest({
    kind: "unknown", durationMs: 60_000, label: null
  }), false);
  assert.equal(isProductivityTimerStartRequest({
    kind: "focus", durationMs: 181 * 60_000, label: null
  }), false);
});

test("timer snapshot validator rejects impossible and unbounded payloads", () => {
  const idle = createIdleProductivityTimerSnapshot(1);
  assert.equal(isProductivityTimerSnapshot(idle), true);
  assert.equal(isProductivityTimerSnapshot({ ...idle, remainingMs: -1 }), false);
  assert.equal(isProductivityTimerSnapshot({ ...idle, state: "running" }), false);
  assert.equal(isProductivityTimerSnapshot({
    ...idle, timerId: "x".repeat(129)
  }), false);
});

test("remaining formatter rounds up without ever displaying negative time", () => {
  assert.equal(formatProductivityTimerRemaining(123_400), "2:04");
  assert.equal(formatProductivityTimerRemaining(-5_000), "0:00");
  assert.equal(formatProductivityTimerRemaining(3_661_000), "1:01:01");
});

test("diagnostics exposes compact running timer truth", () => {
  const text = formatProductivityTimerDiagnostics({
    state: "running", durationMs: 1_500_000, remainingMs: 1_122_000,
    startedAt: 1, deadlineAt: 1_500_001, pausedAt: null, completedAt: null,
    kind: "focus", label: "Focus", timerId: "timer", completionId: null,
    completionPending: false, schedulerActive: true, updatedAt: 2
  });
  assert.match(text, /PRODUCTIVITY TIMER/);
  assert.match(text, /STATE RUNNING · 18:42 REMAINING/);
  assert.match(text, /KIND FOCUS/);
  assert.match(text, /SCHEDULER ACTIVE · COMPLETION CLEAR/);
});

test("preload exposes validated timer methods and never exposes raw ipcRenderer", () => {
  const preload = source("src/main/preload.ts");
  assert.match(preload, /getProductivityTimer:/);
  assert.match(preload, /startProductivityTimer:/);
  assert.match(preload, /onProductivityTimerChanged:/);
  assert.match(preload, /isProductivityTimerCommandResult/);
  assert.doesNotMatch(preload, /ipcRenderer\s*:/);
});

test("main IPC validates timer requests and owns every handler cleanup", () => {
  const ipc = source("src/main/ipc.ts");
  assert.match(ipc, /isProductivityTimerStartRequest/);
  assert.match(ipc, /allowDevelopmentDurations/);
  for (const channel of [
    "productivityTimerGet", "productivityTimerStart", "productivityTimerPause",
    "productivityTimerResume", "productivityTimerCancel",
    "productivityTimerAcknowledge"
  ]) assert.match(ipc, new RegExp(`removeHandler\\(IPC_CHANNELS\\.${channel}\\)`));
});

test("Phase 16 keeps the production Electron security posture", () => {
  const petWindow = source("src/main/petWindow.ts");
  assert.match(petWindow, /sandbox:\s*true/);
  assert.match(petWindow, /contextIsolation:\s*true/);
  assert.match(petWindow, /nodeIntegration:\s*false/);
  assert.doesNotMatch(source("src/main/main.ts"), /Notification|clipboard|desktopCapturer/);
});

test("development short timers are panel-only and use canonical preset requests", () => {
  const panel = source("src/renderer/dev/DevCommandPanel.ts");
  const renderer = source("src/renderer/pet.ts");
  assert.match(panel, /Timer 5s/);
  assert.match(panel, /Timer 10s/);
  assert.match(renderer, /DEVELOPMENT_CONTROLS_ENABLED/);
  assert.match(renderer, /startPreset\("development-5-seconds"\)/);
});
