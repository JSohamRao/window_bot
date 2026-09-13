import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { SystemAwarenessSnapshot } from "../src/shared/systemAwareness";
import {
  resolveSystemRuntimeContext,
  type SystemAwarenessControllerSnapshot
} from "../src/renderer/engine/SystemAwarenessController";
import {
  SYSTEM_TRANSITION_DISPLAY_LIMIT,
  formatSystemAwarenessDiagnostics
} from "../src/renderer/dev/SystemAwarenessDiagnostics";

const controllerSnapshot = (
  patch: Partial<SystemAwarenessSnapshot> = {},
  historyLength = 0
): SystemAwarenessControllerSnapshot => {
  const awareness: SystemAwarenessSnapshot = {
    sessionState: "active",
    activityState: "active",
    powerSource: "ac",
    idleSeconds: 14,
    updatedAt: 1,
    capabilities: {
      idleAwareness: true,
      sessionEvents: true,
      suspendResume: true,
      powerSource: true,
      displayEvents: true
    },
    lastTransition: null,
    idleSamplerActive: true,
    listenerCount: 9,
    ...patch
  };
  return {
    awareness,
    runtime: resolveSystemRuntimeContext(awareness),
    transitionHistory: Array.from({ length: historyLength }, (_, index) => ({
      kind: "activity" as const,
      from: "active",
      to: "idle",
      at: index + 1
    }))
  };
};

test("diagnostics displays current session, user activity, idle seconds, and power", () => {
  const text = formatSystemAwarenessDiagnostics("IDLE", controllerSnapshot());
  assert.match(text, /Session: ACTIVE/);
  assert.match(text, /User Activity: ACTIVE/);
  assert.match(text, /Idle: 14s/);
  assert.match(text, /Power: AC/);
  assert.match(text, /Awareness: RUNNING/);
  assert.match(text, /Idle Sampler: ACTIVE/);
  assert.match(text, /Listeners: 9/);
});

test("behavior state and Windows user activity have distinct explicit labels", () => {
  const text = formatSystemAwarenessDiagnostics(
    "IDLE",
    controllerSnapshot({ activityState: "active" })
  );
  assert.match(text, /Behavior State: IDLE \(THUKUNA FSM\)/);
  assert.match(text, /User Activity: ACTIVE/);
});

test("diagnostics output changes after an awareness transition", () => {
  const before = formatSystemAwarenessDiagnostics("IDLE", controllerSnapshot());
  const after = formatSystemAwarenessDiagnostics("IDLE", controllerSnapshot({
    sessionState: "locked",
    activityState: "idle",
    powerSource: "battery",
    idleSeconds: 125,
    lastTransition: {
      kind: "session",
      from: "active",
      to: "locked",
      at: 2
    }
  }, 1));
  assert.notEqual(after, before);
  assert.match(after, /Session: LOCKED/);
  assert.match(after, /User Activity: IDLE/);
  assert.match(after, /Power: BATTERY/);
  assert.match(after, /Awareness: PAUSED \(SYSTEM_LOCKED\)/);
  assert.match(after, /Last Transition: SESSION: ACTIVE -> LOCKED/);
  assert.match(after, /History: 1\/20/);
});

test("last transition display stays bounded", () => {
  const text = formatSystemAwarenessDiagnostics("IDLE", controllerSnapshot({
    lastTransition: {
      kind: "refresh",
      from: "a".repeat(100),
      to: "b".repeat(100),
      at: 2
    }
  }));
  const line = text.split("\n").find((value) => value.startsWith("Last Transition: "));
  assert.ok(line);
  assert.ok(line.slice("Last Transition: ".length).length <= SYSTEM_TRANSITION_DISPLAY_LIMIT);
});

test("awareness section shares the existing scrollable panel with developer commands", async () => {
  const projectRoot = process.cwd();
  const [panelSource, css] = await Promise.all([
    readFile(path.join(projectRoot, "src", "renderer", "dev", "DevCommandPanel.ts"), "utf8"),
    readFile(path.join(projectRoot, "src", "renderer", "pet.css"), "utf8")
  ]);
  assert.match(panelSource, /panel\.append\(awareness\)/);
  assert.match(panelSource, /panel\.append\(grid\)/);
  assert.ok(panelSource.indexOf("panel.append(awareness)") < panelSource.indexOf("panel.append(grid)"));
  assert.match(css, /\.dev-command-panel\s*\{[^}]*overflow-y:\s*auto/s);
  assert.match(panelSource, /button\.addEventListener\("click", listener\)/);
});
