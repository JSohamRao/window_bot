import { LOCOMOTION_CONFIG } from "../config/locomotionConfig";
import type { SpriteDirection } from "./AnimationController";
import type { MovementAction } from "./MovementMemory";
import { MovementController, type MovementMode } from "./MovementController";

export type JumpKind = "JUMP" | "HOP";
export interface LocomotionSnapshot {
  readonly action: MovementAction;
  readonly mode: MovementMode;
  readonly phase: "IDLE" | "PREPARE" | "ACTIVE" | "LANDING" | "PERCHED";
  readonly elapsedMs: number;
  readonly airborneElapsedMs: number;
  readonly direction: SpriteDirection;
}

export class LocomotionController {
  private action: MovementAction = "NONE";
  private phase: LocomotionSnapshot["phase"] = "IDLE";
  private elapsedMs = 0;
  private airborneElapsedMs = 0;
  private direction: SpriteDirection = "right";
  private climbDirectionY: -1 | 1 = -1;
  private requestedClimbDirectionY: -1 | 1 | null = null;
  private requestedHorizontalDirection: SpriteDirection | null = null;

  public constructor(
    private readonly movement: MovementController,
    private readonly visualLayer?: HTMLElement
  ) { this.resetVisual(); }

  public beginJump(kind: JumpKind, direction: SpriteDirection): boolean {
    if (!this.movement.getSnapshot().grounded) return false;
    this.cancel();
    this.action = kind;
    this.phase = "PREPARE";
    this.direction = direction;
    this.movement.setMode("AIRBORNE", false);
    this.setVisual(kind);
    return true;
  }

  public beginFall(): void {
    this.cancel();
    this.action = "FALL";
    this.phase = "ACTIVE";
    this.movement.setMode("FALLING", false);
    this.movement.setVelocity(0, LOCOMOTION_CONFIG.fallingStartVelocityY);
    this.setVisual("FALL");
  }

  public beginClimb(directionY: -1 | 1): boolean {
    const snapshot = this.movement.getSnapshot();
    if (!this.isNearEdge(snapshot)) return false;
    this.cancel();
    this.action = "CLIMB";
    this.phase = "PREPARE";
    this.climbDirectionY = directionY;
    this.direction = this.nearestEdgeDirection(snapshot);
    this.movement.setMode("CLIMBING", false);
    this.setVisual("CLIMB");
    return true;
  }

  public requestClimbDirection(directionY: -1 | 1): void {
    this.requestedClimbDirectionY = directionY;
  }

  public consumeRequestedClimbDirection(fallback: -1 | 1): -1 | 1 {
    const direction = this.requestedClimbDirectionY ?? fallback;
    this.requestedClimbDirectionY = null;
    return direction;
  }

  public requestHorizontalDirection(direction: SpriteDirection): void {
    this.requestedHorizontalDirection = direction;
  }

  public consumeRequestedHorizontalDirection(
    fallback: SpriteDirection
  ): SpriteDirection {
    const direction = this.requestedHorizontalDirection ?? fallback;
    this.requestedHorizontalDirection = null;
    return direction;
  }

  public perch(): void {
    this.movement.stop();
    this.movement.setMode("PERCHED", false);
    this.action = "PERCH";
    this.phase = "PERCHED";
    this.elapsedMs = 0;
    this.setVisual("PERCH");
  }

  public update(deltaTimeMs: number): void {
    const delta = Number.isFinite(deltaTimeMs) ? Math.min(Math.max(deltaTimeMs, 0), 250) : 0;
    if (delta === 0 || this.action === "NONE" || this.phase === "PERCHED") return;
    this.elapsedMs += delta;
    if ((this.action === "JUMP" || this.action === "HOP") && this.phase === "PREPARE") {
      const config = this.action === "JUMP" ? LOCOMOTION_CONFIG.jump : LOCOMOTION_CONFIG.hop;
      if (this.elapsedMs < config.prepareMs) return;
      const horizontal = this.direction === "left" ? -config.horizontalSpeedPxPerSecond : config.horizontalSpeedPxPerSecond;
      this.phase = "ACTIVE";
      this.elapsedMs = 0;
      this.airborneElapsedMs = 0;
      this.movement.setMode("AIRBORNE", false);
      this.movement.setVelocity(horizontal, config.velocityY);
      return;
    } else if (this.action === "CLIMB" && this.phase === "PREPARE") {
      if (this.elapsedMs < 220) return;
      this.phase = "ACTIVE";
      this.elapsedMs = 0;
      this.movement.setVelocity(0, this.climbDirectionY * LOCOMOTION_CONFIG.climbSpeedPxPerSecond);
    }

    if (this.action === "JUMP" || this.action === "HOP" || this.action === "FALL") {
      this.airborneElapsedMs += delta;
      this.movement.accelerate(0, LOCOMOTION_CONFIG.gravityPxPerSecondSquared, delta);
      let velocity = this.movement.getVelocity();
      const maxAirTimeMs =
        this.action === "HOP"
          ? LOCOMOTION_CONFIG.hop.maxAirTimeMs
          : LOCOMOTION_CONFIG.jump.maxAirTimeMs;
      if (
        this.action !== "FALL" &&
        this.airborneElapsedMs >= maxAirTimeMs &&
        velocity.y < LOCOMOTION_CONFIG.fallingStartVelocityY
      ) {
        this.movement.setVelocity(
          velocity.x,
          LOCOMOTION_CONFIG.fallingStartVelocityY
        );
        velocity = this.movement.getVelocity();
      }
      if (velocity.y >= 0) this.movement.setMode("FALLING", false);
      this.movement.update(delta);
      const hits = this.movement.consumeBoundaryHits();
      const movement = this.movement.getSnapshot();
      const atFloor = movement.floorY !== null && movement.y !== null && movement.y >= movement.floorY - LOCOMOTION_CONFIG.landingTolerancePx;
      if (
        (hits.y && velocity.y >= 0) ||
        (atFloor && velocity.y >= 0)
      ) this.land();
      return;
    }

    if (this.action === "CLIMB" && this.phase === "ACTIVE") {
      this.movement.update(delta);
      const hits = this.movement.consumeBoundaryHits();
      if (hits.y || this.elapsedMs >= LOCOMOTION_CONFIG.climbMaxDurationMs) {
        if (this.climbDirectionY < 0) this.perch();
        else if (hits.y) this.land();
        else this.beginFall();
      }
    } else if (this.action === "LAND" && this.phase === "LANDING" && this.elapsedMs >= LOCOMOTION_CONFIG.jump.landMs) {
      this.finishGrounded();
    }
  }

  public land(): void {
    this.movement.stop();
    this.movement.setMode("GROUND", true);
    this.action = "LAND";
    this.phase = "LANDING";
    this.elapsedMs = 0;
    this.setVisual("LAND");
  }

  public leavePerchAsDrop(): void { this.beginFall(); }

  public cancel(): void {
    this.movement.stop();
    this.action = "NONE";
    this.phase = "IDLE";
    this.elapsedMs = 0;
    this.airborneElapsedMs = 0;
    this.requestedClimbDirectionY = null;
    this.requestedHorizontalDirection = null;
    this.resetVisual();
  }

  public isComplete(): boolean { return this.action === "NONE"; }
  public getSnapshot(): LocomotionSnapshot {
    return {
      action: this.action,
      mode: this.movement.getSnapshot().mode,
      phase: this.phase,
      elapsedMs: this.elapsedMs,
      airborneElapsedMs: this.airborneElapsedMs,
      direction: this.direction
    };
  }

  public canClimb(): boolean { return this.isNearEdge(this.movement.getSnapshot()); }

  private finishGrounded(): void {
    this.action = "NONE";
    this.phase = "IDLE";
    this.elapsedMs = 0;
    this.airborneElapsedMs = 0;
    this.movement.setMode("GROUND", true);
    this.resetVisual();
  }

  private isNearEdge(snapshot: ReturnType<MovementController["getSnapshot"]>): boolean {
    if (snapshot.x === null) return false;
    const nearLeft = snapshot.workAreaLeft !== null && snapshot.x - snapshot.workAreaLeft <= LOCOMOTION_CONFIG.edgeAttachTolerancePx;
    const nearRight = snapshot.workAreaRight !== null && snapshot.workAreaRight - snapshot.x <= LOCOMOTION_CONFIG.edgeAttachTolerancePx;
    return nearLeft || nearRight;
  }

  private nearestEdgeDirection(snapshot: ReturnType<MovementController["getSnapshot"]>): SpriteDirection {
    if (snapshot.x === null || snapshot.workAreaLeft === null || snapshot.workAreaRight === null) return "left";
    return snapshot.x - snapshot.workAreaLeft <= snapshot.workAreaRight - snapshot.x ? "left" : "right";
  }

  private setVisual(action: MovementAction): void {
    if (this.visualLayer !== undefined) this.visualLayer.dataset.action = action;
  }
  private resetVisual(): void {
    if (this.visualLayer !== undefined) this.visualLayer.dataset.action = "NONE";
  }
}
