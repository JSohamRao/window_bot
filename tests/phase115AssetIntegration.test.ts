import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import {
  getDomainFramePaths,
  getAnimationFramePaths,
  THUKUNA_ANIMATIONS,
  type AnimationName
} from "../src/renderer/animations/thukunaAnimations";
import {
  normalizeSpriteFrame,
  type SpriteFrameInput
} from "../src/renderer/engine/AnimationController";
import { LocomotionController } from "../src/renderer/engine/LocomotionController";
import { MovementController } from "../src/renderer/engine/MovementController";
import { DEFAULT_POWER_POLICY_SNAPSHOT } from "../src/renderer/engine/PowerPolicyController";
import { CrawlingState } from "../src/renderer/states/CrawlingState";
import { ClimbingState } from "../src/renderer/states/ClimbingState";
import { AngryState } from "../src/renderer/states/AngryState";
import type { PetContext, PetStateName } from "../src/renderer/states/PetState";
import { PerchedState } from "../src/renderer/states/PerchedState";
import { PET_STAGE_HEIGHT, PET_STAGE_WIDTH } from "../src/shared/windowGeometry";

const sourceOf = (input: SpriteFrameInput): string =>
  typeof input === "string" ? input : input.src;

const durationOf = (name: keyof typeof THUKUNA_ANIMATIONS): number =>
  THUKUNA_ANIMATIONS[name].frames.reduce(
    (total, input) => total + normalizeSpriteFrame(input).durationMs,
    0
  );

const expectedFamilyCounts: Readonly<Record<string, number>> = {
  idle: 4,
  crawl: 8,
  sprint: 6,
  jump: 10,
  hop: 10,
  fall: 6,
  climb: 10,
  perch: 6,
  sleep: 8,
  watch: 4,
  laugh: 3,
  angry: 6,
  rage: 9,
  fall_over: 6,
  domain: 20
};
const validSpriteAnchors = new Set([
  "GROUND", "CENTER", "AIR", "CLIMB_LEFT", "CLIMB_RIGHT", "PERCH"
]);

const makeStateAuditContext = () => {
  let elapsedMs = 0;
  const played: AnimationName[] = [];
  const transitions: PetStateName[] = [];
  const movement = new MovementController({
    moveBy: async () => ({ x: 0, y: 0, hitBoundary: false })
  });
  const context: PetContext = {
    animation: {
      play: (name) => { played.push(name); },
      playSequence: (names) => { played.push(...names); },
      setDirection: () => undefined,
      getCurrentAnimation: () => played.at(-1) ?? null,
      setMotionEnabled: () => undefined,
      setRageActive: () => undefined
    },
    movement,
    cursor: {
      disable: () => undefined,
      enableIdleAwareness: () => undefined
    } as unknown as PetContext["cursor"],
    eventVisuals: {
      activate: () => undefined,
      reset: () => undefined,
    getSnapshot: () => ({ activeEvent: null, durationMs: 0, phase: "NONE", activationCount: 0, cleanupCount: 0 })
    },
    random: { next: () => 0 },
    transitionTo: (name) => { transitions.push(name); },
    restartCurrentState: () => undefined,
    getStateElapsedMs: () => elapsedMs,
    getBehaviorWeights: () => [{ value: "IDLE", weight: 1 }],
    getPersonalitySnapshot: () => ({ irritation: 0, energy: 100, boredom: 0, chaos: 0 }),
    onCursorWatch: () => undefined,
    onMouseChase: () => undefined,
    showMouseDialogue: () => undefined,
    showRareEventDialogue: () => undefined,
    onRareEventFinished: () => undefined,
    isAutonomyPaused: () => false,
    isMouseAwarenessAllowed: () => true,
    getPowerPolicy: () => DEFAULT_POWER_POLICY_SNAPSHOT,
    canUseMovement: () => true
  };
  return {
    context,
    movement,
    played,
    transitions,
    setElapsed: (value: number) => { elapsedMs = value; }
  };
};

test("Phase 11.5 references all 116 approved production sprites", async () => {
  const paths = getAnimationFramePaths();
  assert.equal(paths.length, 116);
  assert.equal(new Set(paths).size, 116);
  await Promise.all(paths.map(async (path) => {
    assert.match(path, /^\.\.\/assets\/thukuna\/animations\//);
    const productionPath = join(process.cwd(), path.replace("../assets/", "assets/"));
    await access(productionPath);
  }));
});

test("Domain manifest contains exactly 20 unique resolvable production frames", async () => {
  const paths = getDomainFramePaths();
  assert.equal(paths.length, 20);
  assert.equal(new Set(paths).size, 20);
  await Promise.all(paths.map(async (path) => {
    assert.match(path, /^\.\.\/assets\/thukuna\/animations\/domain\//);
    await access(join(process.cwd(), path.replace("../assets/", "assets/")));
  }));
});

test("every integrated frame keeps the approved fixed scale", () => {
  for (const definition of Object.values(THUKUNA_ANIMATIONS)) {
    for (const input of definition.frames) {
      assert.equal(normalizeSpriteFrame(input).scale, 1);
    }
  }
});

test("production asset folders have the exact approved family counts", () => {
  const actualCounts: Record<string, number> = {};
  for (const path of getAnimationFramePaths()) {
    const match = path.match(/\/animations\/([^/]+)\//);
    assert.ok(match);
    actualCounts[match[1]] = (actualCounts[match[1]] ?? 0) + 1;
  }
  assert.deepEqual(actualCounts, expectedFamilyCounts);
});

test("all frame metadata is finite, positive, anchored, and production-safe", () => {
  const validFamilies = new Set(Object.keys(expectedFamilyCounts));
  for (const definition of Object.values(THUKUNA_ANIMATIONS)) {
    assert.ok(definition.frames.length > 0);
    for (const input of definition.frames) {
      const source = sourceOf(input);
      const frame = normalizeSpriteFrame(input);
      const family = source.match(/^\.\.\/assets\/thukuna\/animations\/([^/]+)\/[^/]+\.png$/)?.[1];
      assert.ok(family !== undefined && validFamilies.has(family), source);
      assert.ok(Number.isFinite(frame.offsetX), source);
      assert.ok(Number.isFinite(frame.offsetY), source);
      assert.ok(Number.isFinite(frame.scale) && frame.scale > 0, source);
      assert.ok(Number.isFinite(frame.durationMs) && frame.durationMs > 0, source);
      assert.ok(validSpriteAnchors.has(frame.anchor), source);
    }
  }
});

test("normal startup and animation definitions use production sprites", async () => {
  const html = await readFile(join(process.cwd(), "src", "renderer", "index.html"), "utf8");
  assert.match(html, /src="\.\.\/assets\/thukuna\/animations\/idle\/idle_01\.png"/);
  for (const definition of Object.values(THUKUNA_ANIMATIONS)) {
    for (const input of definition.frames) {
      assert.match(sourceOf(input), /^\.\.\/assets\/thukuna\/animations\//);
    }
  }
});

test("crawl completes its dedicated stop sequence before returning to idle", () => {
  const audit = makeStateAuditContext();
  const state = new CrawlingState();
  state.enter(audit.context);
  assert.ok(state.durationMs !== null && state.durationMs > 0);
  audit.setElapsed(state.durationMs);
  state.update(audit.context, 16);
  assert.equal(audit.movement.isMoving(), false);
  assert.equal(audit.played.at(-1), "crawl_stop");
  assert.deepEqual(audit.transitions, []);
  audit.setElapsed(state.durationMs);
  state.update(audit.context, 16);
  assert.deepEqual(audit.transitions, ["IDLE"]);
});

test("perch plays its dedicated exit pose before dropping", () => {
  const audit = makeStateAuditContext();
  audit.movement.setMode("PERCHED", false);
  audit.context.locomotion = new LocomotionController(audit.movement);
  const state = new PerchedState();
  state.enter(audit.context);
  assert.ok(state.durationMs !== null);
  audit.setElapsed(state.durationMs - 150);
  state.update(audit.context, 16);
  assert.equal(audit.played.at(-1), "perch_exit");
  assert.deepEqual(audit.transitions, []);
  audit.setElapsed(state.durationMs);
  state.update(audit.context, 16);
  assert.deepEqual(audit.transitions, ["FALLING"]);
});

test("climb completes its dedicated exit frames before changing state", () => {
  const audit = makeStateAuditContext();
  let perched = false;
  audit.context.locomotion = {
    consumeRequestedClimbDirection: () => -1,
    beginClimb: () => true,
    update: () => { perched = true; },
    getSnapshot: () => ({
      action: perched ? "PERCH" : "CLIMB",
      mode: perched ? "PERCHED" : "CLIMBING",
      phase: perched ? "PERCHED" : "ACTIVE",
      elapsedMs: 0,
      airborneElapsedMs: 0,
      direction: "left"
    }),
    isComplete: () => false,
    cancel: () => undefined
  } as unknown as PetContext["locomotion"];
  const state = new ClimbingState();
  state.enter(audit.context);
  audit.setElapsed(1_000);
  state.update(audit.context, 16);
  assert.equal(audit.played.at(-1), "climb_exit");
  assert.deepEqual(audit.transitions, []);
  audit.setElapsed(1_250);
  state.update(audit.context, 16);
  assert.deepEqual(audit.transitions, ["PERCHED"]);
});

test("angry uses dedicated enter, loop, and exit staging", () => {
  const audit = makeStateAuditContext();
  const state = new AngryState();
  state.enter(audit.context);
  assert.deepEqual(audit.played.slice(-2), ["angry_enter", "angry_loop"]);
  assert.ok(state.durationMs !== null);
  audit.setElapsed(state.durationMs - 150);
  state.update(audit.context, 16);
  assert.equal(audit.played.at(-1), "angry_exit");
  assert.deepEqual(audit.transitions, []);
  audit.setElapsed(state.durationMs);
  state.update(audit.context, 16);
  assert.deepEqual(audit.transitions, ["IDLE"]);
});

test("Domain stages match the 3400 ms rare-event timeline", () => {
  assert.equal(durationOf("domain_charge"), 900);
  assert.equal(durationOf("domain_expand"), 700);
  assert.equal(durationOf("domain_peak"), 800);
  assert.equal(durationOf("domain_collapse"), 400);
  assert.equal(durationOf("domain_recover"), 600);
});

test("specialized production sequences use their intended anchors", () => {
  for (const input of THUKUNA_ANIMATIONS.jump_air.frames) {
    assert.equal(normalizeSpriteFrame(input).anchor, "AIR");
  }
  for (const input of THUKUNA_ANIMATIONS.climb_loop.frames) {
    assert.equal(normalizeSpriteFrame(input).anchor, "CLIMB_LEFT");
  }
  for (const input of THUKUNA_ANIMATIONS.perch_idle.frames) {
    assert.equal(normalizeSpriteFrame(input).anchor, "PERCH");
  }
  for (const input of THUKUNA_ANIMATIONS.domain_peak.frames) {
    assert.equal(normalizeSpriteFrame(input).anchor, "CENTER");
  }
});

test("ground and center frames stay on the approved visual floor line", async () => {
  const report = JSON.parse(
    await readFile(join(process.cwd(), "art-production", "reports", "alpha-bounds.json"), "utf8")
  ) as {
    frames: Array<{
      animation: string;
      filename: string;
      canvasHeight: number;
      bottomVisiblePoint: number;
    }>;
  };
  const bounds = new Map(
    report.frames.map((frame) => [`${frame.animation}/${frame.filename}`, frame] as const)
  );
  const canonicalBottom = 1229 * PET_STAGE_HEIGHT / 1254;
  for (const definition of Object.values(THUKUNA_ANIMATIONS)) {
    for (const input of definition.frames) {
      const frame = normalizeSpriteFrame(input);
      if (frame.anchor !== "GROUND" && frame.anchor !== "CENTER") continue;
      const match = frame.src.match(/\/animations\/([^/]+)\/([^/]+)$/);
      assert.ok(match);
      const measurement = bounds.get(`${match[1]}/${match[2]}`);
      assert.ok(measurement, frame.src);
      const displayedBottom =
        measurement.bottomVisiblePoint * PET_STAGE_HEIGHT / measurement.canvasHeight + frame.offsetY;
      assert.ok(Math.abs(displayedBottom - canonicalBottom) <= 1.5, `${frame.src}: ${displayedBottom}`);
    }
  }
});

test("canonical stage geometry and transform nesting remain intact", async () => {
  assert.equal(PET_STAGE_WIDTH, 180);
  assert.equal(PET_STAGE_HEIGHT, 180);
  const html = await readFile(join(process.cwd(), "src", "renderer", "index.html"), "utf8");
  const ids = [
    "pet-canvas", "direction-layer", "motion-layer", "interaction-layer",
    "event-layer", "locomotion-visual-layer", "frame-layer", "thukuna"
  ];
  let previous = -1;
  for (const id of ids) {
    const index = html.indexOf(`id="${id}"`);
    assert.ok(index > previous, id);
    previous = index;
  }
  const css = await readFile(join(process.cwd(), "src", "renderer", "pet.css"), "utf8");
  assert.match(css, /\.pet-stage\s*\{[^}]*width:\s*180px;[^}]*height:\s*180px;/s);
  assert.match(css, /\.frame-layer\s*\{[^}]*transform:\s*translate\(var\(--frame-offset-x\), var\(--frame-offset-y\)\)\s*scale\(var\(--frame-scale\)\);/s);
});

test("falling uses dedicated fall landing art", () => {
  assert.deepEqual(
    THUKUNA_ANIMATIONS.fall_land.frames.map(sourceOf),
    [
      "../assets/thukuna/animations/fall/fall_05.png",
      "../assets/thukuna/animations/fall/fall_06.png"
    ]
  );
});

test("sprite-backed events no longer add CSS growth transforms", async () => {
  const css = await readFile(join(process.cwd(), "src", "renderer", "pet.css"), "utf8");
  assert.doesNotMatch(css, /@keyframes thukuna-rage/);
  assert.doesNotMatch(css, /@keyframes rare-domain-peak/);
  assert.doesNotMatch(css, /@keyframes rare-fall/);
});
