export interface ScreenPoint {
  screenX: number;
  screenY: number;
}

export interface AutonomousMoveRequest {
  deltaX: number;
  deltaY: number;
}

export interface WindowMoveResult {
  x: number;
  y: number;
  hitBoundary: boolean;
  hitBoundaryX: boolean;
  hitBoundaryY: boolean;
  floorY: number;
  workAreaLeft: number;
  workAreaRight: number;
  workAreaTop: number;
  workAreaBottom: number;
}

export interface WindowPositionResult extends Omit<WindowMoveResult, "hitBoundary" | "hitBoundaryX" | "hitBoundaryY"> {}

export interface CursorPositionResult {
  x: number;
  y: number;
  sameDisplay: boolean;
  supported?: boolean;
}

export const IPC_CHANNELS = {
  dragStart: "thukuna:drag-start",
  dragMove: "thukuna:drag-move",
  dragEnd: "thukuna:drag-end",
  autonomousMove: "thukuna:autonomous-move",
  windowPosition: "thukuna:window-position",
  cursorPosition: "thukuna:cursor-position",
  platformCapabilities: "thukuna:platform-capabilities",
  settingsGet: "thukuna:settings-get",
  settingsUpdate: "thukuna:settings-update",
  settingsChanged: "thukuna:settings-changed",
  visibilityChanged: "thukuna:visibility-changed",
  resetPosition: "thukuna:reset-position",
  resetPositionRequest: "thukuna:reset-position-request",
  systemAwarenessGet: "thukuna:system-awareness-get",
  systemAwarenessChanged: "thukuna:system-awareness-changed",
  productivityTimerGet: "thukuna:productivity-timer-get",
  productivityTimerStart: "thukuna:productivity-timer-start",
  productivityTimerPause: "thukuna:productivity-timer-pause",
  productivityTimerResume: "thukuna:productivity-timer-resume",
  productivityTimerCancel: "thukuna:productivity-timer-cancel",
  productivityTimerAcknowledge: "thukuna:productivity-timer-acknowledge",
  productivityTimerChanged: "thukuna:productivity-timer-changed"
} as const;
