import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_THUKUNA_SETTINGS,
  applySettingsPatch,
  sanitizeThukunaSettings
} from "../src/shared/settings";
import { SettingsStore, type SettingsFileIo } from "../src/main/settingsStore";

const fakeIo = (initial?: string) => {
  let persisted = initial;
  let pending = "";
  let writes = 0;
  const io: SettingsFileIo = {
    read: async () => {
      if (persisted === undefined) throw Object.assign(new Error("missing"), { code: "ENOENT" });
      return persisted;
    },
    ensureDirectory: async () => undefined,
    write: async (_path, contents) => { pending = contents; writes += 1; },
    replace: async () => { persisted = pending; }
  };
  return { io, get persisted() { return persisted; }, get writes() { return writes; } };
};

test("settings defaults are centralized and safe", () => {
  assert.deepEqual(sanitizeThukunaSettings(undefined), DEFAULT_THUKUNA_SETTINGS);
});

test("settings validation loads valid booleans and fills missing fields", () => {
  const loaded = sanitizeThukunaSettings({ dialogueEnabled: false, chaosMode: true });
  assert.equal(loaded.dialogueEnabled, false);
  assert.equal(loaded.chaosMode, true);
  assert.equal(loaded.mouseAwarenessEnabled, true);
});

test("unknown fields and invalid booleans are ignored", () => {
  const loaded = sanitizeThukunaSettings({ dialogueEnabled: "no", mystery: true });
  assert.equal(loaded.dialogueEnabled, true);
  assert.equal("mystery" in loaded, false);
});

test("Low Power and Chaos are mutually exclusive with the newly enabled mode winning", () => {
  const chaos = applySettingsPatch(DEFAULT_THUKUNA_SETTINGS, { chaosMode: true });
  const low = applySettingsPatch(chaos, { lowPowerMode: true });
  assert.equal(low.lowPowerMode, true);
  assert.equal(low.chaosMode, false);
  const chaosAgain = applySettingsPatch(low, { chaosMode: true });
  assert.equal(chaosAgain.chaosMode, true);
  assert.equal(chaosAgain.lowPowerMode, false);
});

test("SettingsStore loads valid JSON without writing", async () => {
  const harness = fakeIo(JSON.stringify({ dialogueEnabled: false }));
  const store = new SettingsStore("C:/data/settings.json", harness.io);
  assert.equal((await store.load()).dialogueEnabled, false);
  assert.equal(store.getWriteCount(), 0);
  assert.equal(harness.writes, 0);
});

test("SettingsStore falls back after malformed JSON without crashing or writing", async () => {
  const harness = fakeIo("{oops");
  const warnings: string[] = [];
  const store = new SettingsStore("C:/data/settings.json", harness.io, (message) => warnings.push(message));
  assert.deepEqual(await store.load(), DEFAULT_THUKUNA_SETTINGS);
  assert.equal(warnings.length, 1);
  assert.equal(harness.writes, 0);
});

test("SettingsStore writes exactly once for a changed setting", async () => {
  const harness = fakeIo();
  const store = new SettingsStore("C:/data/settings.json", harness.io);
  await store.load();
  assert.equal(await store.update({ dialogueEnabled: false }), true);
  assert.equal(store.getWriteCount(), 1);
  assert.equal(harness.writes, 1);
  assert.equal(JSON.parse(harness.persisted ?? "{}").dialogueEnabled, false);
});

test("SettingsStore performs no write for an unchanged value", async () => {
  const harness = fakeIo();
  const store = new SettingsStore("C:/data/settings.json", harness.io);
  await store.load();
  assert.equal(await store.update({ dialogueEnabled: true }), false);
  assert.equal(store.getWriteCount(), 0);
  assert.equal(harness.writes, 0);
});
