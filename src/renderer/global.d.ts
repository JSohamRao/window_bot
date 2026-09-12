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
  onSettingsChanged(listener: (settings: ThukunaSettings) => void): () => void;
  onVisibilityChanged(listener: (visible: boolean) => void): () => void;
  onResetPositionRequested(listener: () => void): () => void;
}

interface Window {
  thukunaWindow: ThukunaWindowApi;
}
