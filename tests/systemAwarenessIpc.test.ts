import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  isSystemAwarenessSnapshot,
  type SystemAwarenessSnapshot
} from "../src/shared/systemAwareness";

const projectRoot = path.resolve(__dirname, "..", "..");
const readSource = (relativePath: string): Promise<string> =>
  readFile(path.join(projectRoot, relativePath), "utf8");

const validSnapshot: SystemAwarenessSnapshot = {
  sessionState: "active",
  activityState: "active",
  powerSource: "ac",
  idleSeconds: 0,
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
  listenerCount: 9
};

test("shared validator accepts the narrow snapshot and rejects malformed payloads", () => {
  assert.equal(isSystemAwarenessSnapshot(validSnapshot), true);
  assert.equal(isSystemAwarenessSnapshot({ ...validSnapshot, idleSeconds: -1 }), false);
  assert.equal(isSystemAwarenessSnapshot({ ...validSnapshot, sessionState: "forged" }), false);
  assert.equal(isSystemAwarenessSnapshot({ ...validSnapshot, listenerCount: 1.5 }), false);
});

test("preload validates awareness payloads and exposes no raw ipcRenderer", async () => {
  const preload = await readSource("src/main/preload.ts");
  assert.match(preload, /getSystemAwareness:/);
  assert.match(preload, /onSystemAwarenessChanged:/);
  assert.match(preload, /isSystemAwarenessSnapshot/);
  assert.doesNotMatch(preload, /exposeInMainWorld\([^]*ipcRenderer\s*[,}]/);
});

test("production window security remains sandboxed and isolated", async () => {
  const windowSource = await readSource("src/main/petWindow.ts");
  assert.match(windowSource, /sandbox:\s*true/);
  assert.match(windowSource, /contextIsolation:\s*true/);
  assert.match(windowSource, /nodeIntegration:\s*false/);
});

test("production source has no system-state forgery channel", async () => {
  const channels = await readSource("src/shared/ipcChannels.ts");
  assert.match(channels, /systemAwarenessGet/);
  assert.match(channels, /systemAwarenessChanged/);
  assert.doesNotMatch(channels, /systemAwareness(?:Set|Forge|Mock)/i);
});
