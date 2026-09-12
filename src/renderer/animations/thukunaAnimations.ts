import type { AnimationDefinition, SpriteFrame, SpriteFrameInput } from "../engine/AnimationController";

export type AnimationName =
  | "idle" | "blink"
  | "crawl" | "crawl_start" | "crawl_loop" | "crawl_stop" | "sprint"
  | "jump_prepare" | "jump_air" | "fall" | "fall_land" | "land"
  | "hop_prepare" | "hop_air" | "hop_land"
  | "climb_enter" | "climb_loop" | "climb_exit"
  | "perch_enter" | "perch_idle" | "perch_exit"
  | "sleep" | "sleep_enter" | "sleep_loop" | "wake"
  | "watch_cursor" | "laugh"
  | "angry" | "angry_enter" | "angry_loop" | "angry_exit"
  | "rage_enter" | "rage" | "rage_exit"
  | "fall_over" | "recover_from_fall"
  | "domain_charge" | "domain_expand" | "domain_peak"
  | "domain_collapse" | "domain_recover";

export type ThukunaAnimationLibrary = Readonly<Record<AnimationName, AnimationDefinition<AnimationName>>>;

const asset = (filename: string): string => `../assets/thukuna/${filename}`;
const approved = (family: string, filename: string): string =>
  asset(`animations/${family}/${filename}`);
const numbered = (family: string, index: number): string =>
  approved(family, `${family}_${String(index).padStart(2, "0")}.png`);
const frame = (src: string, metadata: Omit<SpriteFrame, "src"> = {}): SpriteFrame => ({ src, ...metadata });
const pose = (src: string, durationMs: number, metadata: Omit<SpriteFrame, "src" | "durationMs"> = {}): SpriteFrame =>
  frame(src, { durationMs, ...metadata });

export const IDLE_FRAME = approved("idle", "idle_01.png");
export const SLEEP_FRAME = numbered("sleep", 4);
export const CRAWL_A_FRAME = numbered("crawl", 1);
export const CRAWL_B_FRAME = numbered("crawl", 5);
export const WINK_FRAME = approved("idle", "blink_01.png");
export const LAUGH_FRAME = numbered("laugh", 3);
export const ANGRY_FRAME = numbered("angry", 5);
export const LEGACY_FALLBACK_FRAME = asset("thukuna.png");

const idle1 = IDLE_FRAME;
const idle2 = approved("idle", "idle_02.png");
const blink1 = approved("idle", "blink_01.png");
const blink2 = approved("idle", "blink_02.png");

// Phase 11.5 uses the common 1254×1254 canvas at a fixed scale. The small
// offsets below align generated contact points without resizing the artwork.
export const THUKUNA_ANIMATIONS: ThukunaAnimationLibrary = {
  idle: {
    frames: [pose(idle1, 480), pose(idle2, 420, { offsetX: -1 })],
    loop: true, motion: "none"
  },
  blink: {
    frames: [pose(idle1, 70), pose(blink1, 95), pose(blink2, 115), pose(idle1, 80)],
    loop: false, motion: "none", next: "idle"
  },

  crawl: {
    frames: [
      pose(numbered("crawl", 1), 105, { offsetX: -10, offsetY: 3 }),
      pose(numbered("crawl", 2), 95, { offsetX: -7, offsetY: 4 }),
      pose(numbered("crawl", 3), 95, { offsetX: -8, offsetY: 4 }),
      pose(numbered("crawl", 4), 105, { offsetX: -4 }),
      pose(numbered("crawl", 5), 105, { offsetX: -3, offsetY: -3 }),
      pose(numbered("crawl", 6), 95, { offsetX: -2, offsetY: 4 }),
      pose(numbered("crawl", 7), 95, { offsetX: -7, offsetY: 4 }),
      pose(numbered("crawl", 8), 105, { offsetY: 1 })
    ],
    loop: true, motion: "none"
  },
  crawl_start: {
    frames: [
      pose(numbered("crawl", 1), 105, { offsetX: -10, offsetY: 3 }),
      pose(numbered("crawl", 2), 95, { offsetX: -7, offsetY: 4 })
    ],
    loop: false, motion: "none"
  },
  crawl_loop: {
    frames: [
      pose(numbered("crawl", 1), 105, { offsetX: -10, offsetY: 3 }),
      pose(numbered("crawl", 2), 95, { offsetX: -7, offsetY: 4 }),
      pose(numbered("crawl", 3), 95, { offsetX: -8, offsetY: 4 }),
      pose(numbered("crawl", 4), 105, { offsetX: -4 }),
      pose(numbered("crawl", 5), 105, { offsetX: -3, offsetY: -3 }),
      pose(numbered("crawl", 6), 95, { offsetX: -2, offsetY: 4 }),
      pose(numbered("crawl", 7), 95, { offsetX: -7, offsetY: 4 }),
      pose(numbered("crawl", 8), 105, { offsetY: 1 })
    ],
    loop: true, motion: "none"
  },
  crawl_stop: {
    frames: [
      pose(numbered("crawl", 7), 85, { offsetX: -7, offsetY: 4 }),
      pose(numbered("crawl", 8), 95, { offsetY: 1 }),
      pose(idle1, 110)
    ],
    loop: false, motion: "none"
  },
  sprint: {
    frames: [
      pose(numbered("sprint", 1), 80, { offsetX: -1, offsetY: 1 }),
      pose(numbered("sprint", 2), 70, { offsetX: -8, offsetY: 1 }),
      pose(numbered("sprint", 3), 70, { offsetX: -3, offsetY: 5 }),
      pose(numbered("sprint", 4), 75, { offsetX: -4, offsetY: 9 }),
      pose(numbered("sprint", 5), 80, { offsetX: -2, offsetY: 3 }),
      pose(numbered("sprint", 6), 75, { offsetX: 1, offsetY: 7 })
    ],
    loop: true, motion: "none"
  },

  jump_prepare: {
    frames: [
      pose(numbered("jump", 1), 70, { offsetX: -2, offsetY: 6 }),
      pose(numbered("jump", 2), 70, { offsetX: -2, offsetY: 14 }),
      pose(numbered("jump", 3), 70, { anchor: "AIR", offsetX: -3 })
    ],
    loop: false, motion: "none"
  },
  jump_air: {
    frames: [4, 5, 6, 7, 8].map((index) => pose(numbered("jump", index), 135, { anchor: "AIR" })),
    loop: false, motion: "none"
  },
  land: {
    frames: [
      pose(numbered("jump", 9), 90, { offsetX: -1, offsetY: 3 }),
      pose(numbered("jump", 10), 110)
    ],
    loop: false, motion: "none"
  },
  hop_prepare: {
    frames: [
      pose(numbered("hop", 1), 80, { offsetX: -3, offsetY: 7 }),
      pose(numbered("hop", 2), 80, { offsetX: -7, offsetY: 11 })
    ],
    loop: false, motion: "none"
  },
  hop_air: {
    frames: [3, 4, 5, 6, 7, 8].map((index) => pose(numbered("hop", index), 85, { anchor: "AIR" })),
    loop: false, motion: "none"
  },
  hop_land: {
    frames: [
      pose(numbered("hop", 9), 70, { offsetX: -2, offsetY: 11 }),
      pose(numbered("hop", 10), 90)
    ],
    loop: false, motion: "none"
  },
  fall: {
    frames: [1, 2, 3, 4].map((index) => pose(numbered("fall", index), 125, { anchor: "AIR" })),
    loop: true, motion: "none"
  },
  fall_land: {
    frames: [
      pose(numbered("fall", 5), 90, { offsetX: -2, offsetY: 5 }),
      pose(numbered("fall", 6), 110)
    ],
    loop: false, motion: "none"
  },

  climb_enter: {
    frames: [
      pose(numbered("climb", 1), 120, { anchor: "CLIMB_LEFT", offsetX: -19 }),
      pose(numbered("climb", 2), 110, { anchor: "CLIMB_LEFT", offsetX: -29 })
    ],
    loop: false, motion: "none"
  },
  climb_loop: {
    frames: [
      pose(numbered("climb", 3), 105, { anchor: "CLIMB_LEFT", offsetX: -30 }),
      pose(numbered("climb", 4), 105, { anchor: "CLIMB_LEFT", offsetX: -29 }),
      pose(numbered("climb", 5), 115, { anchor: "CLIMB_LEFT", offsetX: -27 }),
      pose(numbered("climb", 6), 105, { anchor: "CLIMB_LEFT", offsetX: -29 }),
      pose(numbered("climb", 7), 115, { anchor: "CLIMB_LEFT", offsetX: -29 }),
      pose(numbered("climb", 8), 105, { anchor: "CLIMB_LEFT", offsetX: -25 })
    ],
    loop: true, motion: "none"
  },
  climb_exit: {
    frames: [
      pose(numbered("climb", 9), 120, { anchor: "CLIMB_LEFT", offsetX: -28 }),
      pose(numbered("climb", 10), 130, { anchor: "CLIMB_LEFT", offsetX: -35 })
    ],
    loop: false, motion: "none"
  },
  perch_enter: {
    frames: [1, 2, 3].map((index) => pose(numbered("perch", index), 130, { anchor: "PERCH" })),
    loop: false, motion: "none"
  },
  perch_idle: {
    frames: [
      pose(numbered("perch", 4), 520, { anchor: "PERCH" }),
      pose(numbered("perch", 5), 520, { anchor: "PERCH" })
    ],
    loop: true, motion: "none"
  },
  perch_exit: {
    frames: [pose(numbered("perch", 6), 150, { anchor: "PERCH" })],
    loop: false, motion: "none"
  },

  sleep: {
    frames: [
      pose(numbered("sleep", 4), 620, { offsetY: 20 }),
      pose(numbered("sleep", 5), 620, { offsetX: -1, offsetY: 20 })
    ],
    loop: true, motion: "none"
  },
  sleep_enter: {
    frames: [
      pose(numbered("sleep", 1), 180, { offsetX: 1, offsetY: 6 }),
      pose(numbered("sleep", 2), 190, { offsetX: 1, offsetY: 2 }),
      pose(numbered("sleep", 3), 220, { offsetX: -1, offsetY: 23 }),
      pose(numbered("sleep", 4), 260, { offsetY: 20 })
    ],
    loop: false, motion: "none"
  },
  sleep_loop: {
    frames: [
      pose(numbered("sleep", 4), 620, { offsetY: 20 }),
      pose(numbered("sleep", 5), 620, { offsetX: -1, offsetY: 20 })
    ],
    loop: true, motion: "none"
  },
  wake: {
    frames: [
      pose(numbered("sleep", 6), 190, { offsetX: -1, offsetY: 15 }),
      pose(numbered("sleep", 7), 170, { offsetX: 3, offsetY: 2 }),
      pose(numbered("sleep", 8), 150)
    ],
    loop: false, motion: "none", next: "idle"
  },
  watch_cursor: {
    frames: [
      pose(numbered("watch", 1), 160),
      pose(numbered("watch", 2), 180, { offsetX: 1, offsetY: 12 }),
      pose(numbered("watch", 3), 180, { offsetY: 12 }),
      pose(numbered("watch", 4), 220, { offsetX: -4, offsetY: 12 })
    ],
    loop: true, motion: "none"
  },
  laugh: {
    frames: [
      pose(numbered("laugh", 1), 140, { offsetX: -2, offsetY: 1 }),
      pose(numbered("laugh", 2), 120, { offsetX: -2, offsetY: 2 }),
      pose(numbered("laugh", 3), 150, { offsetX: -5, offsetY: 8 })
    ],
    loop: true, motion: "none"
  },
  angry: {
    frames: [
      pose(numbered("angry", 1), 150, { offsetX: -3, offsetY: 8 }),
      pose(numbered("angry", 2), 140, { offsetX: -3, offsetY: 8 }),
      pose(numbered("angry", 3), 130, { offsetX: -2, offsetY: 9 }),
      pose(numbered("angry", 4), 130, { offsetX: -3, offsetY: 5 }),
      pose(numbered("angry", 5), 180, { offsetX: -2, offsetY: 5 }),
      pose(numbered("angry", 6), 180, { offsetX: -2, offsetY: 4 })
    ],
    loop: false, motion: "none"
  },
  angry_enter: {
    frames: [1, 2, 3].map((index) => pose(numbered("angry", index), 135, { offsetY: 8 })),
    loop: false, motion: "none"
  },
  angry_loop: {
    frames: [
      pose(numbered("angry", 4), 180, { offsetX: -3, offsetY: 5 }),
      pose(numbered("angry", 5), 220, { offsetX: -2, offsetY: 5 })
    ],
    loop: true, motion: "none"
  },
  angry_exit: {
    frames: [pose(numbered("angry", 6), 150, { offsetX: -2, offsetY: 4 })],
    loop: false, motion: "none"
  },
  rage_enter: {
    frames: [1, 2, 3].map((index) => pose(numbered("rage", index), 130, { offsetX: -1, offsetY: 5 })),
    loop: false, motion: "none"
  },
  rage: {
    frames: [
      pose(numbered("rage", 1), 170, { offsetX: -1, offsetY: 5 }),
      pose(numbered("rage", 2), 160, { offsetX: -2, offsetY: 5 }),
      pose(numbered("rage", 3), 160, { offsetX: -1, offsetY: 4 }),
      pose(numbered("rage", 4), 190, { offsetX: -1, offsetY: 1 }),
      pose(numbered("rage", 5), 260, { offsetX: -1 }),
      pose(numbered("rage", 6), 190, { offsetX: -1 }),
      pose(numbered("rage", 7), 190, { offsetY: 1 }),
      pose(numbered("rage", 8), 300, { offsetX: -3, offsetY: 3 }),
      pose(numbered("rage", 9), 380, { offsetX: -4, offsetY: 6 })
    ],
    loop: false, motion: "none"
  },
  rage_exit: {
    frames: [
      pose(numbered("rage", 8), 180, { offsetX: -3, offsetY: 3 }),
      pose(numbered("rage", 9), 220, { offsetX: -4, offsetY: 6 })
    ],
    loop: false, motion: "none", next: "idle"
  },

  fall_over: {
    frames: [
      pose(numbered("fall_over", 1), 180, { anchor: "CENTER", offsetX: -4, offsetY: 7 }),
      pose(numbered("fall_over", 2), 170, { anchor: "CENTER", offsetX: -5, offsetY: 6 }),
      pose(numbered("fall_over", 3), 190, { anchor: "CENTER", offsetX: -5, offsetY: 10 }),
      pose(numbered("fall_over", 4), 230, { anchor: "CENTER", offsetX: -1, offsetY: 27 }),
      pose(numbered("fall_over", 5), 1_050, { anchor: "CENTER", offsetX: -2, offsetY: 25 }),
      pose(numbered("fall_over", 6), 420, { anchor: "CENTER", offsetX: -7, offsetY: 13 })
    ],
    loop: false, motion: "none"
  },
  recover_from_fall: {
    frames: [
      pose(numbered("fall_over", 5), 180, { anchor: "CENTER", offsetX: -2, offsetY: 25 }),
      pose(numbered("fall_over", 6), 260, { anchor: "CENTER", offsetX: -7, offsetY: 13 }),
      pose(idle1, 120)
    ],
    loop: false, motion: "none"
  },
  domain_charge: {
    frames: [
      pose(numbered("domain", 1), 140, { anchor: "CENTER", offsetX: -3, offsetY: 6 }),
      pose(numbered("domain", 2), 110, { anchor: "CENTER", offsetX: -3, offsetY: 5 }),
      pose(numbered("domain", 3), 100, { anchor: "CENTER", offsetX: -3, offsetY: 3 }),
      pose(numbered("domain", 4), 80, { anchor: "CENTER", offsetX: -3, offsetY: 4 }),
      pose(numbered("domain", 5), 270, { anchor: "CENTER", offsetX: -3, offsetY: 4 }),
      pose(numbered("domain", 6), 70, { anchor: "CENTER", offsetX: -3, offsetY: 4 }),
      pose(numbered("domain", 7), 70, { anchor: "CENTER", offsetX: -3, offsetY: 3 }),
      pose(numbered("domain", 8), 60, { anchor: "CENTER", offsetX: -3, offsetY: -1 })
    ],
    loop: false, motion: "none"
  },
  domain_expand: {
    frames: [
      pose(numbered("domain", 9), 170, { anchor: "CENTER", offsetX: -2 }),
      pose(numbered("domain", 10), 170, { anchor: "CENTER", offsetX: -2 }),
      pose(numbered("domain", 11), 180, { anchor: "CENTER", offsetX: -2 }),
      pose(numbered("domain", 12), 180, { anchor: "CENTER", offsetX: -2, offsetY: -1 })
    ],
    loop: false, motion: "none"
  },
  domain_peak: {
    frames: [
      pose(numbered("domain", 13), 180, { anchor: "CENTER", offsetX: -2, offsetY: -2 }),
      pose(numbered("domain", 14), 260, { anchor: "CENTER", offsetX: -1, offsetY: -3 }),
      pose(numbered("domain", 15), 360, { anchor: "CENTER", offsetX: -1, offsetY: -3 })
    ],
    loop: false, motion: "none"
  },
  domain_collapse: {
    frames: [
      pose(numbered("domain", 16), 140, { anchor: "CENTER", offsetX: -2, offsetY: 3 }),
      pose(numbered("domain", 17), 130, { anchor: "CENTER", offsetX: -3, offsetY: 13 }),
      pose(numbered("domain", 18), 130, { anchor: "CENTER", offsetY: 10 })
    ],
    loop: false, motion: "none"
  },
  domain_recover: {
    frames: [
      pose(numbered("domain", 19), 320, { anchor: "CENTER", offsetX: -2, offsetY: 7 }),
      pose(numbered("domain", 20), 280, { anchor: "CENTER" })
    ],
    loop: false, motion: "none"
  }
};

const sourceOf = (input: SpriteFrameInput): string => typeof input === "string" ? input : input.src;

export const getAnimationFramePaths = (): readonly string[] => [
  ...new Set(Object.values(THUKUNA_ANIMATIONS).flatMap((definition) => definition.frames.map(sourceOf)))
];

export const DOMAIN_ANIMATION_NAMES = [
  "domain_charge", "domain_expand", "domain_peak", "domain_collapse", "domain_recover"
] as const satisfies readonly AnimationName[];

export const getDomainFramePaths = (): readonly string[] =>
  DOMAIN_ANIMATION_NAMES.flatMap((name) =>
    THUKUNA_ANIMATIONS[name].frames.map(sourceOf)
  );

export const resolveAnimationFrames = (resolve: (path: string) => string): ThukunaAnimationLibrary =>
  Object.fromEntries(Object.entries(THUKUNA_ANIMATIONS).map(([name, definition]) => [
    name,
    {
      ...definition,
      frames: definition.frames.map((input) =>
        typeof input === "string" ? resolve(input) : { ...input, src: resolve(input.src) })
    }
  ])) as unknown as ThukunaAnimationLibrary;
