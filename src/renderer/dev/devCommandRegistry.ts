export type DevCommandId =
  | "DIAGNOSTICS"
  | "IDLE"
  | "CRAWL"
  | "SPRINT"
  | "JUMP"
  | "JUMP_LEFT"
  | "JUMP_RIGHT"
  | "HOP"
  | "FALL"
  | "CLIMB_UP"
  | "CLIMB_DOWN"
  | "PERCH"
  | "DROP"
  | "WATCH"
  | "CHASE"
  | "SLEEP"
  | "WAKE"
  | "LAUGH"
  | "ANGRY"
  | "RAGE"
  | "FALL_OVER"
  | "CREEPY_FREEZE"
  | "ZOOM_STARE"
  | "CHAOS_RUN"
  | "DOMAIN"
  | "RESET_POSITION"
  | "LAND"
  | "TOGGLE_AUTONOMY"
  | "PREVIEW_IDLE"
  | "PREVIEW_BLINK"
  | "PREVIEW_CRAWL"
  | "PREVIEW_LAUGH"
  | "PREVIEW_ANGRY"
  | "PREVIEW_SLEEP"
  | "FACE_LEFT"
  | "FACE_RIGHT"
  | "TOGGLE_ANIMATION"
  | "SHOW_DIALOGUE"
  | "HIDE_DIALOGUE"
  | "IRRITATION_UP"
  | "ENERGY_DOWN"
  | "BOREDOM_UP"
  | "CHAOS_UP"
  | "RESET_PERSONALITY";

export interface DevShortcut {
  readonly code: string;
  readonly ctrl?: boolean;
  readonly alt?: boolean;
  readonly shift?: boolean;
  readonly meta?: boolean;
}

export interface DevCommandDefinition {
  readonly id: DevCommandId;
  readonly label: string;
  readonly shortcut: DevShortcut;
  readonly description: string;
  readonly preconditions: readonly string[];
  readonly expectedResult: string;
  readonly requestedState?: string;
  readonly requestedAnimation?: string;
  readonly developmentOnly: true;
  readonly oneShot: true;
}

const command = (
  value: Omit<DevCommandDefinition, "developmentOnly" | "oneShot">
): DevCommandDefinition => ({ ...value, developmentOnly: true, oneShot: true });

export const DEV_PANEL_COMMAND_IDS = [
  "IDLE", "CRAWL", "SPRINT", "JUMP", "JUMP_LEFT", "JUMP_RIGHT", "HOP",
  "FALL", "CLIMB_UP", "CLIMB_DOWN", "PERCH", "DROP", "WATCH", "CHASE",
  "SLEEP", "WAKE", "LAUGH", "ANGRY", "RAGE", "FALL_OVER",
  "CREEPY_FREEZE", "ZOOM_STARE", "CHAOS_RUN", "DOMAIN", "RESET_POSITION",
  "LAND"
] as const satisfies readonly DevCommandId[];

export const DEV_COMMAND_REGISTRY: readonly DevCommandDefinition[] = [
  command({ id: "DIAGNOSTICS", label: "Diagnostics", shortcut: { code: "KeyD" }, description: "Toggle the local diagnostic overlay.", preconditions: ["Pet window focused"], expectedResult: "Overlay toggles" }),
  command({ id: "IDLE", label: "Idle", shortcut: { code: "Digit1", shift: true }, description: "Safely replace the current behavior with Idle.", preconditions: ["Not dragging"], expectedResult: "IDLE", requestedState: "IDLE", requestedAnimation: "idle" }),
  command({ id: "CRAWL", label: "Crawl", shortcut: { code: "Digit2", shift: true }, description: "Run Crawl start, loop, and stop through the development override.", preconditions: ["Ground movement capability", "Not dragging"], expectedResult: "CRAWLING", requestedState: "CRAWLING", requestedAnimation: "crawl_start" }),
  command({ id: "SPRINT", label: "Sprint", shortcut: { code: "Digit1", ctrl: true, shift: true }, description: "Force canonical Sprint without product-policy or scheduler gates.", preconditions: ["Window movement capability", "Not dragging"], expectedResult: "SPRINT", requestedState: "SPRINT", requestedAnimation: "sprint" }),
  command({ id: "JUMP", label: "Jump", shortcut: { code: "KeyJ", ctrl: true, shift: true }, description: "Run the existing full Jump physics through the development override.", preconditions: ["Jump capability", "Grounded", "Not dragging"], expectedResult: "JUMPING", requestedState: "JUMPING", requestedAnimation: "jump_prepare" }),
  command({ id: "JUMP_LEFT", label: "Jump Left", shortcut: { code: "ArrowLeft", ctrl: true, shift: true }, description: "Run full Jump toward the left through the development override.", preconditions: ["Jump capability", "Grounded", "Not dragging"], expectedResult: "JUMPING left", requestedState: "JUMPING", requestedAnimation: "jump_prepare" }),
  command({ id: "JUMP_RIGHT", label: "Jump Right", shortcut: { code: "ArrowRight", ctrl: true, shift: true }, description: "Run full Jump toward the right through the development override.", preconditions: ["Jump capability", "Grounded", "Not dragging"], expectedResult: "JUMPING right", requestedState: "JUMPING", requestedAnimation: "jump_prepare" }),
  command({ id: "HOP", label: "Hop", shortcut: { code: "KeyH", ctrl: true, shift: true }, description: "Run the existing shorter Hop physics through the development override.", preconditions: ["Hop capability", "Grounded", "Not dragging"], expectedResult: "HOPPING", requestedState: "HOPPING", requestedAnimation: "hop_prepare" }),
  command({ id: "FALL", label: "Fall", shortcut: { code: "KeyF", ctrl: true, shift: true }, description: "Begin physical gravity-driven Fall.", preconditions: ["Gravity movement allowed", "Not dragging"], expectedResult: "FALLING", requestedState: "FALLING", requestedAnimation: "fall" }),
  command({ id: "CLIMB_UP", label: "Climb Up", shortcut: { code: "ArrowUp", ctrl: true, shift: true }, description: "Climb upward on the nearest attached edge through the development override.", preconditions: ["Climb capability", "Near edge", "Not dragging"], expectedResult: "CLIMBING up", requestedState: "CLIMBING", requestedAnimation: "climb_enter" }),
  command({ id: "CLIMB_DOWN", label: "Climb Down", shortcut: { code: "ArrowDown", ctrl: true, shift: true }, description: "Climb downward on the nearest attached edge through the development override.", preconditions: ["Climb capability", "Near edge", "Not dragging"], expectedResult: "CLIMBING down", requestedState: "CLIMBING", requestedAnimation: "climb_enter" }),
  command({ id: "PERCH", label: "Perch", shortcut: { code: "KeyP", ctrl: true, shift: true }, description: "Perch at a valid screen edge through the development override.", preconditions: ["Perch capability", "Near edge", "Not dragging"], expectedResult: "PERCHED", requestedState: "PERCHED", requestedAnimation: "perch_enter" }),
  command({ id: "DROP", label: "Drop", shortcut: { code: "KeyD", ctrl: true, shift: true }, description: "Drop from an active Perch into physical Fall.", preconditions: ["Currently perched", "Gravity movement allowed", "Not dragging"], expectedResult: "FALLING", requestedState: "FALLING", requestedAnimation: "fall" }),
  command({ id: "WATCH", label: "Watch Cursor", shortcut: { code: "KeyM", shift: true }, description: "Force cursor watching with the existing sampler through the development override.", preconditions: ["Cursor capability", "Not dragging"], expectedResult: "WATCHING_CURSOR", requestedState: "WATCHING_CURSOR", requestedAnimation: "watch_cursor" }),
  command({ id: "CHASE", label: "Chase Cursor", shortcut: { code: "KeyC", shift: true }, description: "Force cursor chase with the existing planner through the development override.", preconditions: ["Cursor chase capability", "Not dragging"], expectedResult: "CHASE_MOUSE", requestedState: "CHASE_MOUSE", requestedAnimation: "watch_cursor" }),
  command({ id: "SLEEP", label: "Sleep", shortcut: { code: "Digit6", shift: true }, description: "Run Sleep enter and loop through the development override.", preconditions: ["Not dragging"], expectedResult: "SLEEPING", requestedState: "SLEEPING", requestedAnimation: "sleep_enter" }),
  command({ id: "WAKE", label: "Wake", shortcut: { code: "Digit7", shift: true }, description: "Run the dedicated Wake/recovery sequence.", preconditions: ["Currently sleeping", "Not dragging"], expectedResult: "wake then IDLE", requestedState: "IDLE", requestedAnimation: "wake" }),
  command({ id: "LAUGH", label: "Laugh", shortcut: { code: "Digit4", shift: true }, description: "Force the dedicated Laugh reaction.", preconditions: ["Not dragging"], expectedResult: "LAUGHING", requestedState: "LAUGHING", requestedAnimation: "laugh" }),
  command({ id: "ANGRY", label: "Angry", shortcut: { code: "Digit5", shift: true }, description: "Run Angry enter, loop, and exit.", preconditions: ["Not dragging"], expectedResult: "ANGRY", requestedState: "ANGRY", requestedAnimation: "angry_enter" }),
  command({ id: "RAGE", label: "Rage", shortcut: { code: "KeyR", shift: true }, description: "Force canonical Rage without click escalation.", preconditions: ["Not dragging"], expectedResult: "RAGE", requestedState: "RAGE", requestedAnimation: "rage" }),
  command({ id: "FALL_OVER", label: "Fall Over", shortcut: { code: "Digit2", ctrl: true, shift: true }, description: "Force canonical comedic Fall Over without product-policy gates.", preconditions: ["Renderer active", "Not dragging"], expectedResult: "FALL_OVER", requestedState: "FALL_OVER", requestedAnimation: "fall_over" }),
  command({ id: "CREEPY_FREEZE", label: "Creepy Freeze", shortcut: { code: "Digit3", ctrl: true, shift: true }, description: "Force canonical Creepy Freeze without product-policy gates.", preconditions: ["Renderer active", "Not dragging"], expectedResult: "CREEPY_FREEZE", requestedState: "CREEPY_FREEZE", requestedAnimation: "idle" }),
  command({ id: "ZOOM_STARE", label: "Zoom Stare", shortcut: { code: "Digit4", ctrl: true, shift: true }, description: "Force canonical Zoom Stare without product-policy gates.", preconditions: ["Renderer active", "Not dragging"], expectedResult: "ZOOM_STARE", requestedState: "ZOOM_STARE", requestedAnimation: "idle" }),
  command({ id: "CHAOS_RUN", label: "Chaos Run", shortcut: { code: "Digit5", ctrl: true, shift: true }, description: "Force canonical Chaos Run without product-policy gates.", preconditions: ["Window movement capability", "Not dragging"], expectedResult: "CHAOS_RUN", requestedState: "CHAOS_RUN", requestedAnimation: "crawl" }),
  command({ id: "DOMAIN", label: "Domain Expansion", shortcut: { code: "Digit6", ctrl: true, shift: true }, description: "Force the canonical 3400 ms Domain sequence without product-policy gates.", preconditions: ["Renderer active", "Domain assets ready", "Not dragging"], expectedResult: "DOMAIN_EXPANSION", requestedState: "DOMAIN_EXPANSION", requestedAnimation: "domain_charge" }),
  command({ id: "RESET_POSITION", label: "Reset Position", shortcut: { code: "Digit0", ctrl: true, shift: true }, description: "Reset through the validated main-process geometry path.", preconditions: ["Reset capability", "Not dragging"], expectedResult: "Safe floor position", requestedState: "IDLE", requestedAnimation: "idle" }),
  command({ id: "LAND", label: "Force Landing", shortcut: { code: "KeyL", ctrl: true, shift: true }, description: "Force canonical landing recovery.", preconditions: ["Gravity movement allowed", "Not dragging"], expectedResult: "LANDING", requestedState: "LANDING", requestedAnimation: "land" }),
  command({ id: "TOGGLE_AUTONOMY", label: "Toggle Autonomy", shortcut: { code: "KeyA" }, description: "Toggle the persisted autonomy setting.", preconditions: ["Pet window focused"], expectedResult: "Autonomy toggles" }),
  command({ id: "PREVIEW_IDLE", label: "Preview Idle", shortcut: { code: "Digit1" }, description: "Preview only the Idle sprites.", preconditions: ["Not dragging"], expectedResult: "idle", requestedAnimation: "idle" }),
  command({ id: "PREVIEW_BLINK", label: "Preview Blink", shortcut: { code: "Digit2" }, description: "Preview only the Blink sprites.", preconditions: ["Not dragging"], expectedResult: "blink", requestedAnimation: "blink" }),
  command({ id: "PREVIEW_CRAWL", label: "Preview Crawl Sprites", shortcut: { code: "Digit3" }, description: "Preview Crawl sprites without moving the window.", preconditions: ["Not dragging"], expectedResult: "crawl sprite preview", requestedAnimation: "crawl" }),
  command({ id: "PREVIEW_LAUGH", label: "Preview Laugh", shortcut: { code: "Digit4" }, description: "Preview only the Laugh sprites.", preconditions: ["Not dragging"], expectedResult: "laugh", requestedAnimation: "laugh" }),
  command({ id: "PREVIEW_ANGRY", label: "Preview Angry", shortcut: { code: "Digit5" }, description: "Preview only the Angry sprites.", preconditions: ["Not dragging"], expectedResult: "angry", requestedAnimation: "angry" }),
  command({ id: "PREVIEW_SLEEP", label: "Preview Sleep", shortcut: { code: "Digit6" }, description: "Preview only the Sleep sprites.", preconditions: ["Not dragging"], expectedResult: "sleep", requestedAnimation: "sleep" }),
  command({ id: "FACE_LEFT", label: "Face Left", shortcut: { code: "ArrowLeft" }, description: "Mirror the sprite left.", preconditions: ["Pet window focused"], expectedResult: "Direction left" }),
  command({ id: "FACE_RIGHT", label: "Face Right", shortcut: { code: "ArrowRight" }, description: "Mirror the sprite right.", preconditions: ["Pet window focused"], expectedResult: "Direction right" }),
  command({ id: "TOGGLE_ANIMATION", label: "Toggle Animation", shortcut: { code: "Space" }, description: "Pause or resume sprite animation.", preconditions: ["Pet window focused"], expectedResult: "Animation toggles" }),
  command({ id: "SHOW_DIALOGUE", label: "Show Dialogue", shortcut: { code: "KeyB", shift: true }, description: "Show a development dialogue sample.", preconditions: ["Dialogue enabled"], expectedResult: "Dialogue visible" }),
  command({ id: "HIDE_DIALOGUE", label: "Hide Dialogue", shortcut: { code: "KeyX", shift: true }, description: "Hide the current dialogue.", preconditions: ["Pet window focused"], expectedResult: "Dialogue hidden" }),
  command({ id: "IRRITATION_UP", label: "Increase Irritation", shortcut: { code: "KeyI", ctrl: true, alt: true }, description: "Increase development irritation by 10.", preconditions: ["Pet window focused"], expectedResult: "Irritation +10" }),
  command({ id: "ENERGY_DOWN", label: "Decrease Energy", shortcut: { code: "KeyE", ctrl: true, alt: true }, description: "Decrease development energy by 15.", preconditions: ["Pet window focused"], expectedResult: "Energy -15" }),
  command({ id: "BOREDOM_UP", label: "Increase Boredom", shortcut: { code: "KeyB", ctrl: true, alt: true }, description: "Increase development boredom by 15.", preconditions: ["Pet window focused"], expectedResult: "Boredom +15" }),
  command({ id: "CHAOS_UP", label: "Increase Chaos", shortcut: { code: "KeyC", ctrl: true, alt: true }, description: "Increase development chaos by 15.", preconditions: ["Pet window focused"], expectedResult: "Chaos +15" }),
  command({ id: "RESET_PERSONALITY", label: "Reset Personality", shortcut: { code: "Digit0", ctrl: true, alt: true }, description: "Reset development personality values.", preconditions: ["Pet window focused"], expectedResult: "Personality defaults" })
];

export interface DevKeyboardInput {
  readonly code: string;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly shiftKey: boolean;
  readonly metaKey: boolean;
  readonly repeat: boolean;
  preventDefault(): void;
}

const expectedModifier = (value: boolean | undefined): boolean => value === true;

export const matchesDevShortcut = (
  input: DevKeyboardInput,
  shortcut: DevShortcut
): boolean =>
  input.code === shortcut.code &&
  input.ctrlKey === expectedModifier(shortcut.ctrl) &&
  input.altKey === expectedModifier(shortcut.alt) &&
  input.shiftKey === expectedModifier(shortcut.shift) &&
  input.metaKey === expectedModifier(shortcut.meta);

export const findDevCommand = (
  input: DevKeyboardInput
): DevCommandDefinition | null =>
  DEV_COMMAND_REGISTRY.find((definition) =>
    matchesDevShortcut(input, definition.shortcut)
  ) ?? null;

export const findDevCommandById = (id: DevCommandId): DevCommandDefinition | null =>
  DEV_COMMAND_REGISTRY.find((definition) => definition.id === id) ?? null;

export const getDevPanelCommands = (): readonly DevCommandDefinition[] =>
  DEV_PANEL_COMMAND_IDS.map((id) => {
    const definition = findDevCommandById(id);
    if (definition === null) throw new Error(`Missing dev-panel command: ${id}`);
    return definition;
  });

export const devShortcutSignature = (shortcut: DevShortcut): string =>
  `${expectedModifier(shortcut.ctrl) ? "1" : "0"}${expectedModifier(shortcut.alt) ? "1" : "0"}${expectedModifier(shortcut.shift) ? "1" : "0"}${expectedModifier(shortcut.meta) ? "1" : "0"}:${shortcut.code}`;

const displayCode = (code: string): string => {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code.replace("Arrow", "");
};

export const formatDevShortcut = (shortcut: DevShortcut): string => [
  expectedModifier(shortcut.ctrl) ? "Ctrl" : null,
  expectedModifier(shortcut.alt) ? "Alt" : null,
  expectedModifier(shortcut.shift) ? "Shift" : null,
  expectedModifier(shortcut.meta) ? "Meta" : null,
  displayCode(shortcut.code)
].filter((part): part is string => part !== null).join("+");

export const formatObservedKey = (input: DevKeyboardInput): string =>
  formatDevShortcut({
    code: input.code,
    ctrl: input.ctrlKey,
    alt: input.altKey,
    shift: input.shiftKey,
    meta: input.metaKey
  });
export { DEVELOPMENT_CONTROLS_ENABLED } from "./developmentControlsPolicy";
