import type { SpriteDirection } from "./AnimationController";

export type MovementMode = "GROUND" | "AIRBORNE" | "FALLING" | "CLIMBING" | "PERCHED";
export interface Velocity2D { readonly x: number; readonly y: number; }

export interface MovementPosition {
  x: number;
  y: number;
  floorY?: number;
  workAreaLeft?: number;
  workAreaRight?: number;
  workAreaTop?: number;
  workAreaBottom?: number;
}

export interface MovementResult extends MovementPosition {
  hitBoundary: boolean;
  hitBoundaryX?: boolean;
  hitBoundaryY?: boolean;
}

export interface MovementApi {
  moveBy(deltaX: number, deltaY?: number): Promise<MovementResult>;
  getPosition?(): Promise<MovementPosition>;
}

export interface MovementBoundaryHits { readonly x: boolean; readonly y: boolean; }

export interface MovementSnapshot {
  moving: boolean;
  direction: SpriteDirection;
  speedPxPerSecond: number;
  velocityX: number;
  velocityY: number;
  mode: MovementMode;
  grounded: boolean;
  x: number | null;
  y: number | null;
  floorY: number | null;
  workAreaLeft: number | null;
  workAreaRight: number | null;
  workAreaTop: number | null;
  workAreaBottom: number | null;
}

const finiteVelocity = (value: number): number =>
  Number.isFinite(value) ? Math.min(Math.max(value, -1_000), 1_000) : 0;

export class MovementController {
  private direction: SpriteDirection = "right";
  private velocityX = 0;
  private velocityY = 0;
  private commanded = false;
  private paused = false;
  private elapsedSinceSendMs = 0;
  private accumulatedX = 0;
  private accumulatedY = 0;
  private requestInFlight = false;
  private boundaryHits = { x: false, y: false };
  private generation = 0;
  private x: number | null = null;
  private y: number | null = null;
  private floorY: number | null = null;
  private workAreaLeft: number | null = null;
  private workAreaRight: number | null = null;
  private workAreaTop: number | null = null;
  private workAreaBottom: number | null = null;
  private mode: MovementMode = "GROUND";
  private grounded = true;
  private readonly minimumSendIntervalMs: number;

  public constructor(private readonly api: MovementApi, updatesPerSecond = 30) {
    if (!Number.isFinite(updatesPerSecond) || updatesPerSecond <= 0) {
      throw new RangeError("updatesPerSecond must be positive.");
    }
    this.minimumSendIntervalMs = 1000 / updatesPerSecond;
  }

  public start(direction: SpriteDirection, speedPxPerSecond: number): void {
    if (!Number.isFinite(speedPxPerSecond) || speedPxPerSecond <= 0) {
      throw new RangeError("Movement speed must be positive.");
    }
    this.setVelocity(direction === "left" ? -speedPxPerSecond : speedPxPerSecond, 0);
    this.mode = "GROUND";
    this.grounded = true;
  }

  public setHorizontalVelocity(value: number): void {
    this.setVelocity(value, this.velocityY);
  }

  public setVelocity(velocityX: number, velocityY: number): void {
    const x = finiteVelocity(velocityX);
    const y = finiteVelocity(velocityY);
    this.generation += 1;
    this.velocityX = x;
    this.velocityY = y;
    if (x !== 0) this.direction = x < 0 ? "left" : "right";
    this.commanded = x !== 0 || y !== 0;
    this.paused = false;
    this.elapsedSinceSendMs = 0;
    this.accumulatedX = 0;
    this.accumulatedY = 0;
    this.boundaryHits = { x: false, y: false };
  }

  public accelerate(accelerationX: number, accelerationY: number, deltaTimeMs: number): void {
    if (!Number.isFinite(deltaTimeMs) || deltaTimeMs <= 0) return;
    const seconds = Math.min(deltaTimeMs, 250) / 1000;
    this.velocityX = finiteVelocity(this.velocityX + finiteVelocity(accelerationX) * seconds);
    this.velocityY = finiteVelocity(this.velocityY + finiteVelocity(accelerationY) * seconds);
    if (this.velocityX !== 0) this.direction = this.velocityX < 0 ? "left" : "right";
    this.commanded = this.velocityX !== 0 || this.velocityY !== 0;
  }

  public update(deltaTimeMs: number): void {
    if (!this.isMoving() || !Number.isFinite(deltaTimeMs) || deltaTimeMs <= 0) return;
    const safeDeltaTimeMs = Math.min(deltaTimeMs, 250);
    const seconds = safeDeltaTimeMs / 1000;
    this.accumulatedX += this.velocityX * seconds;
    this.accumulatedY += this.velocityY * seconds;
    this.elapsedSinceSendMs += safeDeltaTimeMs;
    if (this.elapsedSinceSendMs >= this.minimumSendIntervalMs && !this.requestInFlight) {
      this.sendAccumulatedMovement();
    }
  }

  public stopX(): void {
    this.velocityX = 0;
    this.accumulatedX = 0;
    this.commanded = this.velocityY !== 0;
  }

  public stopY(): void {
    this.velocityY = 0;
    this.accumulatedY = 0;
    this.commanded = this.velocityX !== 0;
  }

  public stop(): void {
    this.generation += 1;
    this.velocityX = 0;
    this.velocityY = 0;
    this.commanded = false;
    this.paused = false;
    this.elapsedSinceSendMs = 0;
    this.accumulatedX = 0;
    this.accumulatedY = 0;
  }

  public pause(): void {
    if (!this.commanded || this.paused) return;
    this.generation += 1;
    this.paused = true;
    this.elapsedSinceSendMs = 0;
    this.accumulatedX = 0;
    this.accumulatedY = 0;
  }

  public resume(): void {
    if (!this.commanded || !this.paused) return;
    this.generation += 1;
    this.paused = false;
  }

  public setMode(mode: MovementMode, grounded = mode === "GROUND"): void {
    this.mode = mode;
    this.grounded = grounded;
  }

  public getVelocity(): Velocity2D { return { x: this.velocityX, y: this.velocityY }; }
  public getDirection(): SpriteDirection { return this.direction; }
  public getSpeed(): number { return Math.hypot(this.velocityX, this.velocityY); }
  public isMoving(): boolean { return this.commanded && !this.paused; }

  public consumeBoundaryReached(): boolean {
    const reached = this.boundaryHits.x || this.boundaryHits.y;
    this.boundaryHits = { x: false, y: false };
    return reached;
  }

  public consumeBoundaryHits(): MovementBoundaryHits {
    const hits = { ...this.boundaryHits };
    this.boundaryHits = { x: false, y: false };
    return hits;
  }

  public getSnapshot(): MovementSnapshot {
    return {
      moving: this.isMoving(), direction: this.direction,
      speedPxPerSecond: this.getSpeed(), velocityX: this.velocityX, velocityY: this.velocityY,
      mode: this.mode, grounded: this.grounded,
      x: this.x, y: this.y, floorY: this.floorY,
      workAreaLeft: this.workAreaLeft, workAreaRight: this.workAreaRight,
      workAreaTop: this.workAreaTop, workAreaBottom: this.workAreaBottom
    };
  }

  public async syncPosition(): Promise<void> {
    if (this.api.getPosition === undefined) return;
    try { this.applyPosition(await this.api.getPosition()); }
    catch (error: unknown) { console.warn("[THUKUNA] Window position request failed.", error); }
  }

  private sendAccumulatedMovement(): void {
    const deltaX = Math.min(Math.max(Math.trunc(this.accumulatedX), -100), 100);
    const deltaY = Math.min(Math.max(Math.trunc(this.accumulatedY), -100), 100);
    if (deltaX === 0 && deltaY === 0) return;
    const requestGeneration = this.generation;
    this.accumulatedX -= deltaX;
    this.accumulatedY -= deltaY;
    this.elapsedSinceSendMs = 0;
    this.requestInFlight = true;
    void this.api.moveBy(deltaX, deltaY).then((result) => {
      this.applyPosition(result);
      if (requestGeneration !== this.generation) return;
      const hitX = result.hitBoundaryX ?? (result.hitBoundary && deltaX !== 0);
      const hitY = result.hitBoundaryY ?? (result.hitBoundary && deltaY !== 0);
      this.boundaryHits = { x: this.boundaryHits.x || hitX, y: this.boundaryHits.y || hitY };
      if (hitX) this.stopX();
      if (hitY) this.stopY();
    }).catch((error: unknown) => {
      console.warn("[THUKUNA] Autonomous movement request failed.", error);
      if (requestGeneration === this.generation) this.stop();
    }).finally(() => { this.requestInFlight = false; });
  }

  private applyPosition(position: MovementPosition): void {
    this.x = position.x;
    this.y = position.y;
    if (Number.isFinite(position.floorY)) this.floorY = position.floorY!;
    if (Number.isFinite(position.workAreaLeft)) this.workAreaLeft = position.workAreaLeft!;
    if (Number.isFinite(position.workAreaRight)) this.workAreaRight = position.workAreaRight!;
    if (Number.isFinite(position.workAreaTop)) this.workAreaTop = position.workAreaTop!;
    if (Number.isFinite(position.workAreaBottom)) this.workAreaBottom = position.workAreaBottom!;
    if (this.floorY !== null && this.y >= this.floorY) {
      this.grounded = true;
      if (this.mode === "AIRBORNE" || this.mode === "FALLING") this.mode = "GROUND";
    } else if (this.floorY !== null && this.y < this.floorY) {
      this.grounded = false;
    }
  }
}
