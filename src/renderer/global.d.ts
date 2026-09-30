interface ScreenPoint {
  screenX: number;
  screenY: number;
}

interface WindowMoveResult {
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

interface WindowPositionResult {
  x: number;
  y: number;
  floorY: number;
  workAreaLeft: number;
  workAreaRight: number;
  workAreaTop: number;
  workAreaBottom: number;
}

interface CursorPositionResult {
  x: number;
  y: number;
  sameDisplay: boolean;
  supported?: boolean;
}

type ThukunaPlatform = "windows" | "linux";
type DisplayServer = "win32" | "x11" | "xwayland" | "wayland" | "unknown";

interface PlatformCapabilities {
  platform: ThukunaPlatform;
  displayServer: DisplayServer;
  supportsAbsoluteWindowPosition: boolean;
  supportsProgrammaticWindowMove: boolean;
  supportsAlwaysOnTop: boolean;
  supportsCursorScreenPosition: boolean;
  supportsEdgeClimbing: boolean;
  supportsPerching: boolean;
  supportsAutostart: boolean;
  supportsTray: boolean;
  supportsNotifications: boolean;
}

type ThukunaSettingKey =
  | "dialogueEnabled"
  | "mouseAwarenessEnabled"
  | "rareEventsEnabled"
  | "chaosMode"
  | "lowPowerMode"
  | "alwaysOnTop"
  | "autonomyEnabled"
  | "launchOnStartup";

interface ThukunaSettings {
  dialogueEnabled: boolean;
  mouseAwarenessEnabled: boolean;
  rareEventsEnabled: boolean;
  chaosMode: boolean;
  lowPowerMode: boolean;
  alwaysOnTop: boolean;
  autonomyEnabled: boolean;
  launchOnStartup: boolean;
}

type SystemSessionState = "active" | "locked" | "suspended";
type SystemActivityState = "active" | "idle" | "unknown";
type SystemPowerSource = "ac" | "battery" | "unknown";

interface SystemAwarenessTransition {
  readonly kind: "session" | "activity" | "power" | "display" | "refresh";
  readonly from: string;
  readonly to: string;
  readonly at: number;
}

interface SystemAwarenessSnapshot {
  readonly sessionState: SystemSessionState;
  readonly activityState: SystemActivityState;
  readonly powerSource: SystemPowerSource;
  readonly idleSeconds: number;
  readonly updatedAt: number;
  readonly capabilities: {
    readonly idleAwareness: boolean;
    readonly sessionEvents: boolean;
    readonly suspendResume: boolean;
    readonly powerSource: boolean;
    readonly displayEvents: boolean;
  };
  readonly lastTransition: SystemAwarenessTransition | null;
  readonly idleSamplerActive: boolean;
  readonly listenerCount: number;
}

type ProductivityTimerState = "idle" | "running" | "paused" | "completed";
type ProductivityTimerKind = "countdown" | "focus" | "short-break" | "long-break";

interface ProductivityTimerStartRequest {
  readonly kind: ProductivityTimerKind;
  readonly durationMs: number;
  readonly label: string | null;
}

interface ProductivityTimerSnapshot {
  readonly state: ProductivityTimerState;
  readonly durationMs: number;
  readonly remainingMs: number;
  readonly startedAt: number | null;
  readonly deadlineAt: number | null;
  readonly pausedAt: number | null;
  readonly completedAt: number | null;
  readonly kind: ProductivityTimerKind | null;
  readonly label: string | null;
  readonly timerId: string | null;
  readonly completionId: string | null;
  readonly completionPending: boolean;
  readonly schedulerActive: boolean;
  readonly updatedAt: number;
}

interface ProductivityTimerCommandResult {
  readonly accepted: boolean;
  readonly reason:
    | "STARTED"
    | "PAUSED"
    | "RESUMED"
    | "CANCELLED"
    | "COMPLETION_ACKNOWLEDGED"
    | "ACTIVE_TIMER_EXISTS"
    | "INVALID_REQUEST"
    | "INVALID_STATE"
    | "COMPLETION_ID_MISMATCH";
  readonly snapshot: ProductivityTimerSnapshot;
}

interface ThukunaWindowApi {
  startDrag(point: ScreenPoint): void;
  moveDrag(point: ScreenPoint): void;
  endDrag(): void;
  moveBy(deltaX: number, deltaY?: number): Promise<WindowMoveResult>;
  getPosition(): Promise<WindowPositionResult>;
  getCursorPosition(): Promise<CursorPositionResult>;
  getPlatformCapabilities(): Promise<PlatformCapabilities>;
  getSettings(): Promise<ThukunaSettings>;
  updateSetting(key: ThukunaSettingKey, value: boolean): Promise<ThukunaSettings>;
  resetPosition(): Promise<boolean>;
  getSystemAwareness(): Promise<SystemAwarenessSnapshot>;
  onSystemAwarenessChanged(
    listener: (snapshot: SystemAwarenessSnapshot) => void
  ): () => void;
  getProductivityTimer(): Promise<ProductivityTimerSnapshot>;
  startProductivityTimer(
    request: ProductivityTimerStartRequest
  ): Promise<ProductivityTimerCommandResult>;
  pauseProductivityTimer(): Promise<ProductivityTimerCommandResult>;
  resumeProductivityTimer(): Promise<ProductivityTimerCommandResult>;
  cancelProductivityTimer(): Promise<ProductivityTimerCommandResult>;
  acknowledgeProductivityTimerCompletion(
    completionId: string
  ): Promise<ProductivityTimerCommandResult>;
  onProductivityTimerChanged(
    listener: (snapshot: ProductivityTimerSnapshot) => void
  ): () => void;
  onSettingsChanged(listener: (settings: ThukunaSettings) => void): () => void;
  onVisibilityChanged(listener: (visible: boolean) => void): () => void;
  onResetPositionRequested(listener: () => void): () => void;
}

interface Window {
  thukunaWindow: ThukunaWindowApi;
}
