import assert from "node:assert/strict";
import test from "node:test";
import { StateMachine, type State } from "../src/renderer/engine/StateMachine";

type Name = "A" | "B";
type Context = { events: string[] };

const makeState = (name: Name): State<Name, Context> => ({
  name,
  durationMs: 1_000,
  enter: (context) => context.events.push(`enter:${name}`),
  update: (context, deltaTimeMs) => context.events.push(`update:${name}:${deltaTimeMs}`),
  exit: (context) => context.events.push(`exit:${name}`)
});

test("StateMachine enters its initial state and tracks elapsed time", () => {
  const context: Context = { events: [] };
  const machine = new StateMachine([makeState("A"), makeState("B")]);
  machine.start("A", context);
  machine.update(context, 125);
  assert.equal(machine.getCurrentState(), "A");
  assert.equal(machine.getElapsedMs(), 125);
  assert.deepEqual(context.events, ["enter:A", "update:A:125"]);
});

test("StateMachine exits before entering and ignores duplicate transitions", () => {
  const context: Context = { events: [] };
  const machine = new StateMachine([makeState("A"), makeState("B")]);
  machine.start("A", context);
  assert.equal(machine.transition("B", context), true);
  assert.equal(machine.transition("B", context), false);
  assert.deepEqual(context.events, ["enter:A", "exit:A", "enter:B"]);
});
