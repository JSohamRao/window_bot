import type { BrowserWindow } from "electron";
import type {
  CursorPositionResult,
  WindowMoveResult,
  WindowPositionResult
} from "../../shared/ipcChannels";
import type { PlatformCapabilities } from "../../shared/platform";
import type { WindowPosition } from "../windowBounds";

export interface LaunchSpec {
  readonly executable: string;
  readonly args: readonly string[];
  readonly cwd?: string;
}

export interface PlatformAdapter {
  readonly capabilities: PlatformCapabilities;
  getInitialWindowPosition(): WindowPosition | null;
  getWindowPosition(window: BrowserWindow): WindowPositionResult;
  moveWindowBy(window: BrowserWindow, deltaX: number, deltaY: number): WindowMoveResult;
  moveWindowTo(window: BrowserWindow, x: number, y: number): WindowMoveResult;
  getCursorPosition(window: BrowserWindow): CursorPositionResult;
  resetWindowPosition(window: BrowserWindow): boolean;
  setAlwaysOnTop(window: BrowserWindow, enabled: boolean): void;
  setLaunchAtStartup(enabled: boolean): Promise<void>;
  getLaunchAtStartup(): Promise<boolean>;
  createShellLaunchSpec(cwd: string): LaunchSpec;
}
