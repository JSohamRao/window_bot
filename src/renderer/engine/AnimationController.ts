export type SpriteDirection = "left" | "right";

export type ProceduralMotion =
  | "none" | "idle" | "crawl" | "laugh" | "angry"
  | "sleep" | "air" | "land" | "climb" | "perch";

export type SpriteAnchor =
  | "GROUND" | "CENTER" | "CLIMB_LEFT" | "CLIMB_RIGHT" | "PERCH" | "AIR";

export interface SpriteFrame {
  readonly src: string;
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly scale?: number;
  readonly anchor?: SpriteAnchor;
  readonly durationMs?: number;
}

export type SpriteFrameInput = string | SpriteFrame;

export interface ResolvedSpriteFrame {
  readonly src: string;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly scale: number;
  readonly anchor: SpriteAnchor;
  readonly durationMs: number;
}

export interface AnimationDefinition<AnimationName extends string> {
  readonly frames: readonly SpriteFrameInput[];
  readonly loop: boolean;
  readonly motion: ProceduralMotion;
  readonly fps?: number;
  readonly defaultFrameDurationMs?: number;
  readonly next?: AnimationName;
}

export interface PlayOptions { restart?: boolean; }

export interface AnimationSnapshot<AnimationName extends string> {
  animation: AnimationName | null;
  frameIndex: number;
  frameCount: number;
  fps: number;
  frameDurationMs: number;
  playing: boolean;
  direction: SpriteDirection;
  anchor: SpriteAnchor;
  offsetX: number;
  offsetY: number;
  frameScale: number;
  sequenceRemaining: readonly AnimationName[];
}

type AnimationLibrary<AnimationName extends string> = Readonly<
  Record<AnimationName, AnimationDefinition<AnimationName>>
>;
type SnapshotListener<AnimationName extends string> = (
  snapshot: AnimationSnapshot<AnimationName>
) => void;

const VALID_ANCHORS = new Set<SpriteAnchor>([
  "GROUND", "CENTER", "CLIMB_LEFT", "CLIMB_RIGHT", "PERCH", "AIR"
]);
const finiteOr = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) ? value : fallback;
const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(Math.max(value, minimum), maximum);

export const normalizeSpriteFrame = (
  input: SpriteFrameInput,
  defaultDurationMs = 1_000
): ResolvedSpriteFrame => {
  const frame = typeof input === "string" ? { src: input } : input;
  return {
    src: typeof frame.src === "string" ? frame.src : "",
    offsetX: clamp(finiteOr(frame.offsetX, 0), -90, 90),
    offsetY: clamp(finiteOr(frame.offsetY, 0), -90, 90),
    scale: clamp(finiteOr(frame.scale, 1), 0.5, 1.5),
    anchor: frame.anchor !== undefined && VALID_ANCHORS.has(frame.anchor)
      ? frame.anchor : "GROUND",
    durationMs: clamp(finiteOr(frame.durationMs, defaultDurationMs), 16, 5_000)
  };
};

export class AnimationController<AnimationName extends string> {
  private currentAnimation: AnimationName | null = null;
  private currentFrameIndex = 0;
  private playing = false;
  private direction: SpriteDirection;
  private frameRequestId: number | null = null;
  private lastTimestamp: number | null = null;
  private elapsedMilliseconds = 0;
  private sequenceQueue: AnimationName[] = [];

  public constructor(
    private readonly imageElement: HTMLImageElement,
    private readonly directionElement: HTMLElement,
    private readonly motionElement: HTMLElement,
    private readonly interactionElement: HTMLElement,
    private readonly animations: AnimationLibrary<AnimationName>,
    initialDirection: SpriteDirection = "right",
    private readonly onSnapshot?: SnapshotListener<AnimationName>,
    private readonly frameElement?: HTMLElement
  ) {
    this.direction = initialDirection;
    this.directionElement.dataset.direction = initialDirection;
    this.validateDefinitions();
  }

  public play(name: AnimationName, options: PlayOptions = {}): void {
    this.sequenceQueue = [];
    this.beginAnimation(name, options);
  }

  public playSequence(names: readonly AnimationName[]): void {
    if (names.length === 0) return;
    this.sequenceQueue = names.slice(1);
    this.beginAnimation(names[0], { restart: true });
  }

  public stop(): void {
    this.cancelFrameRequest();
    this.sequenceQueue = [];
    this.playing = false;
    this.elapsedMilliseconds = 0;
    this.lastTimestamp = null;
    if (this.currentAnimation !== null) {
      this.currentFrameIndex = 0;
      this.renderCurrentFrame();
    }
    this.emitSnapshot();
  }

  public pause(): void {
    if (!this.playing) return;
    this.cancelFrameRequest();
    this.playing = false;
    this.lastTimestamp = null;
    this.emitSnapshot();
  }

  public resume(): void {
    if (this.currentAnimation === null || this.playing) return;
    this.playing = true;
    this.lastTimestamp = null;
    this.scheduleFrameRequestIfNeeded();
    this.emitSnapshot();
  }

  public setFrame(frameIndex: number): void {
    const definition = this.getCurrentDefinition();
    if (definition === null || !Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= definition.frames.length) {
      throw new RangeError(`Invalid animation frame index: ${frameIndex}`);
    }
    this.currentFrameIndex = frameIndex;
    this.elapsedMilliseconds = 0;
    this.lastTimestamp = null;
    this.renderCurrentFrame();
    this.emitSnapshot();
  }

  public setDirection(direction: SpriteDirection): void {
    if (this.direction === direction) return;
    this.direction = direction;
    this.directionElement.dataset.direction = direction;
    this.emitSnapshot();
  }

  public getDirection(): SpriteDirection { return this.direction; }
  public getCurrentAnimation(): AnimationName | null { return this.currentAnimation; }
  public isPlaying(): boolean { return this.playing; }
  public setMotionEnabled(enabled: boolean): void {
    this.motionElement.classList.toggle("motion-disabled", !enabled);
  }

  public setRageActive(active: boolean): void {
    if (!active) {
      this.interactionElement.classList.remove("is-raging");
      return;
    }
    if (this.interactionElement.classList.contains("is-raging")) {
      this.interactionElement.classList.remove("is-raging");
      void this.interactionElement.offsetWidth;
    }
    this.interactionElement.classList.add("is-raging");
  }

  public getSnapshot(): AnimationSnapshot<AnimationName> {
    const definition = this.getCurrentDefinition();
    const frame = this.getCurrentFrame();
    return {
      animation: this.currentAnimation,
      frameIndex: this.currentFrameIndex,
      frameCount: definition?.frames.length ?? 0,
      fps: frame.durationMs > 0 ? 1000 / frame.durationMs : 0,
      frameDurationMs: frame.durationMs,
      playing: this.playing,
      direction: this.direction,
      anchor: frame.anchor,
      offsetX: frame.offsetX,
      offsetY: frame.offsetY,
      frameScale: frame.scale,
      sequenceRemaining: [...this.sequenceQueue]
    };
  }

  public destroy(): void {
    this.cancelFrameRequest();
    this.sequenceQueue = [];
    this.playing = false;
  }

  private beginAnimation(name: AnimationName, options: PlayOptions): void {
    if (this.currentAnimation === name && !options.restart) {
      if (!this.playing) this.resume();
      return;
    }
    this.cancelFrameRequest();
    this.currentAnimation = name;
    this.currentFrameIndex = 0;
    this.elapsedMilliseconds = 0;
    this.lastTimestamp = null;
    this.playing = true;
    this.motionElement.dataset.motion = this.animations[name].motion;
    this.renderCurrentFrame();
    this.scheduleFrameRequestIfNeeded();
    this.emitSnapshot();
  }

  private readonly tick = (timestamp: number): void => {
    this.frameRequestId = null;
    if (!this.playing || this.currentAnimation === null) return;
    const animationAtStart = this.currentAnimation;
    if (this.lastTimestamp === null) this.lastTimestamp = timestamp;
    else {
      this.elapsedMilliseconds += Math.min(Math.max(timestamp - this.lastTimestamp, 0), 250);
      this.lastTimestamp = timestamp;
    }
    while (
      this.playing && this.currentAnimation === animationAtStart &&
      this.elapsedMilliseconds >= this.getCurrentFrame().durationMs
    ) {
      this.elapsedMilliseconds -= this.getCurrentFrame().durationMs;
      this.advanceFrame(this.animations[animationAtStart]);
    }
    if (this.playing && this.currentAnimation === animationAtStart) this.scheduleFrameRequestIfNeeded();
  };

  private advanceFrame(definition: AnimationDefinition<AnimationName>): void {
    const nextFrameIndex = this.currentFrameIndex + 1;
    if (nextFrameIndex < definition.frames.length) {
      this.currentFrameIndex = nextFrameIndex;
      this.renderCurrentFrame();
      this.emitSnapshot();
      return;
    }
    if (definition.loop) {
      this.currentFrameIndex = 0;
      this.renderCurrentFrame();
      this.emitSnapshot();
      return;
    }
    const sequenceNext = this.sequenceQueue.shift();
    if (sequenceNext !== undefined) {
      this.beginAnimation(sequenceNext, { restart: true });
      return;
    }
    if (definition.next !== undefined) {
      this.beginAnimation(definition.next, { restart: true });
      return;
    }
    this.playing = false;
    this.lastTimestamp = null;
    this.emitSnapshot();
  }

  private scheduleFrameRequestIfNeeded(): void {
    const definition = this.getCurrentDefinition();
    if (!this.playing || definition === null || this.frameRequestId !== null || (definition.loop && definition.frames.length === 1)) return;
    this.frameRequestId = requestAnimationFrame(this.tick);
  }

  private cancelFrameRequest(): void {
    if (this.frameRequestId !== null) {
      cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = null;
    }
  }

  private getCurrentDefinition(): AnimationDefinition<AnimationName> | null {
    return this.currentAnimation === null ? null : this.animations[this.currentAnimation];
  }

  private getDefaultFrameDuration(definition: AnimationDefinition<AnimationName>): number {
    if (definition.defaultFrameDurationMs !== undefined) return clamp(finiteOr(definition.defaultFrameDurationMs, 1_000), 16, 5_000);
    return definition.fps !== undefined && definition.fps > 0 ? 1000 / definition.fps : 1_000;
  }

  private getCurrentFrame(): ResolvedSpriteFrame {
    const definition = this.getCurrentDefinition();
    if (definition === null) return normalizeSpriteFrame("");
    return normalizeSpriteFrame(definition.frames[this.currentFrameIndex], this.getDefaultFrameDuration(definition));
  }

  private renderCurrentFrame(): void {
    const frame = this.getCurrentFrame();
    if (this.imageElement.getAttribute("src") !== frame.src) this.imageElement.src = frame.src;
    this.imageElement.dataset.frame = String(this.currentFrameIndex);
    if (this.frameElement !== undefined) {
      this.frameElement.dataset.anchor = frame.anchor;
      this.frameElement.style.setProperty("--frame-offset-x", `${frame.offsetX}px`);
      this.frameElement.style.setProperty("--frame-offset-y", `${frame.offsetY}px`);
      this.frameElement.style.setProperty("--frame-scale", String(frame.scale));
    }
  }

  private emitSnapshot(): void { this.onSnapshot?.(this.getSnapshot()); }
  private validateDefinitions(): void {
    for (const name of Object.keys(this.animations) as AnimationName[]) {
      const definition = this.animations[name];
      if (definition.frames.length === 0) throw new Error(`Animation "${name}" must contain at least one frame.`);
      if (definition.fps !== undefined && (!Number.isFinite(definition.fps) || definition.fps <= 0)) {
        throw new Error(`Animation "${name}" must have a positive FPS value.`);
      }
      for (const input of definition.frames) {
        if (normalizeSpriteFrame(input, this.getDefaultFrameDuration(definition)).src.length === 0) {
          throw new Error(`Animation "${name}" contains an empty frame source.`);
        }
      }
    }
  }
}
