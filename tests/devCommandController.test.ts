import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import {
  DevCommandController,
  type DevCommandRuntime
} from "../src/renderer/dev/DevCommandController";
import {
  DEV_COMMAND_REGISTRY,
  DEV_PANEL_COMMAND_IDS,
  devShortcutSignature,
  formatDevShortcut,
  getDevPanelCommands,
  type DevKeyboardInput,
  type DevShortcut
} from "../src/renderer/dev/devCommandRegistry";

const inputFor = (
  shortcut: DevShortcut,
  overrides: Partial<DevKeyboardInput> = {}
): DevKeyboardInput => ({
  code: shortcut.code,
  ctrlKey: shortcut.ctrl === true,
  altKey: shortcut.alt === true,
  shiftKey: shortcut.shift === true,
  metaKey: shortcut.meta === true,
  repeat: false,
  preventDefault: () => undefined,
  ...overrides
});

const runtime = (executed: string[] = []): DevCommandRuntime => ({
  execute: async (command) => {
    executed.push(command.id);
    return { accepted: true, reason: "NONE" };
  },
  getActualState: () => ({ state: "IDLE", animation: "idle" })
});

const acceptingRuntime = (executed: string[] = []): DevCommandRuntime => {
  let state: string | null = "IDLE";
  let animation: string | null = "idle";
  return {
    execute: async (command) => {
      executed.push(command.id);
      state = command.requestedState ?? state;
      animation = command.requestedAnimation ?? animation;
      return { accepted: true, reason: "NONE" };
    },
    getActualState: () => ({ state, animation })
  };
};

test("every registered command recognizes its exact event.code and modifiers", async () => {
  const executed: string[] = [];
  const controller = new DevCommandController(acceptingRuntime(executed));
  for (const command of DEV_COMMAND_REGISTRY) {
    const result = await controller.handleKey(inputFor(command.shortcut));
    assert.equal(result?.commandId, command.id);
    assert.equal(result?.shortcut, formatDevShortcut(command.shortcut));
    assert.equal(result?.accepted, true);
  }
  assert.deepEqual(executed, DEV_COMMAND_REGISTRY.map(({ id }) => id));
});

test("wrong modifiers never execute the intended command", async () => {
  for (const command of DEV_COMMAND_REGISTRY) {
    const executed: string[] = [];
    const controller = new DevCommandController(runtime(executed));
    const result = await controller.handleKey(inputFor(command.shortcut, {
      metaKey: !command.shortcut.meta
    }));
    assert.equal(result, null, command.id);
    assert.deepEqual(executed, [], command.id);
  }
});

test("unknown keys are ignored but still appear as Last Key telemetry", async () => {
  const executed: string[] = [];
  const controller = new DevCommandController(runtime(executed));
  const result = await controller.handleKey(inputFor({ code: "KeyQ", ctrl: true, shift: true }));
  assert.equal(result, null);
  assert.equal(controller.getTelemetry().lastKey, "Ctrl+Shift+Q");
  assert.deepEqual(executed, []);
});

test("key repeat reports rejection and never re-executes one-shot commands", async () => {
  const executed: string[] = [];
  const controller = new DevCommandController(runtime(executed));
  const domain = DEV_COMMAND_REGISTRY.find(({ id }) => id === "DOMAIN");
  assert.ok(domain);
  const result = await controller.handleKey(inputFor(domain.shortcut, { repeat: true }));
  assert.equal(result?.accepted, false);
  assert.equal(result?.reason, "KEY_REPEAT");
  assert.deepEqual(executed, []);
});

test("active development shortcuts have zero exact collisions", () => {
  const signatures = DEV_COMMAND_REGISTRY.map(({ shortcut }) =>
    devShortcutSignature(shortcut)
  );
  assert.equal(new Set(signatures).size, signatures.length);
});

test("the centralized enable switch disables the complete command surface", async () => {
  const executed: string[] = [];
  const controller = new DevCommandController(runtime(executed), undefined, false);
  const result = await controller.handleKey(inputFor(DEV_COMMAND_REGISTRY[0].shortcut));
  assert.equal(result, null);
  assert.equal(controller.getTelemetry().enabled, false);
  assert.deepEqual(executed, []);
});

test("the clickable panel exposes every required command exactly once", () => {
  const commands = getDevPanelCommands();
  assert.deepEqual(commands.map(({ id }) => id), [...DEV_PANEL_COMMAND_IDS]);
  assert.equal(new Set(commands.map(({ id }) => id)).size, commands.length);
});

test("keyboard and panel dispatch the same canonical command ID", async () => {
  for (const command of getDevPanelCommands()) {
    const keyboardExecuted: string[] = [];
    const panelExecuted: string[] = [];
    const keyboard = new DevCommandController(acceptingRuntime(keyboardExecuted));
    const panel = new DevCommandController(acceptingRuntime(panelExecuted));
    const keyboardResult = await keyboard.handleKey(inputFor(command.shortcut));
    const panelResult = await panel.handlePanelCommand(command.id);
    assert.equal(keyboardResult?.commandId, command.id);
    assert.equal(panelResult?.commandId, command.id);
    assert.equal(panelResult?.source, "PANEL");
    assert.deepEqual(panelExecuted, keyboardExecuted);
  }
});

test("an accepted command that never enters its requested state is reported as stalled", async () => {
  const controller = new DevCommandController(runtime());
  const result = await controller.handlePanelCommand("DOMAIN");
  assert.equal(result?.accepted, false);
  assert.equal(result?.reason, "COMMAND_STALLED");
  assert.match(result?.detail ?? "", /Expected DOMAIN_EXPANSION; observed IDLE/);
  assert.equal(
    result?.trace.some(({ stage, detail }) =>
      stage === "IMMEDIATE_VERIFICATION" && detail === "COMMAND_STALLED:IDLE"
    ),
    true
  );
});

test("README contains every authoritative command label and shortcut", async () => {
  const readme = await readFile(join(process.cwd(), "README.md"), "utf8");
  for (const command of DEV_COMMAND_REGISTRY) {
    assert.ok(readme.includes(command.label), command.label);
    assert.ok(readme.includes(`\`${formatDevShortcut(command.shortcut)}\``), command.id);
  }
});
