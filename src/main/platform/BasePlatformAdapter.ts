import { screen, type BrowserWindow, type Rectangle } from "electron";
import type {
  CursorPositionResult,
  WindowMoveResult,
  WindowPositionResult
} from "../../shared/ipcChannels";
import type { PlatformCapabilities } from "../../shared/platform";
import {
  PET_WINDOW_HEIGHT,
  PET_WINDOW_WIDTH
} from "../../shared/windowGeometry";
import {
  clampWindowPosition,
  positionWindowOnFloor,
  type WindowPosition
} from "../windowBounds";
import type { PlatformAdapter } from "./PlatformAdapter";

const FLOOR_HORIZONTAL_MARGIN = 24;

export abstract class BasePlatformAdapter implements PlatformAdapter {
  public constructor(public readonly capabilities: PlatformCapabilities) {}

  public getInitialWindowPosition(): WindowPosition | null {
    if (!this.capabilities.supportsAbsoluteWindowPosition) return null;
    return positionWindowOnFloor(
      screen.getPrimaryDisplay().workArea,
      PET_WINDOW_WIDTH,
      PET_WINDOW_HEIGHT,
      FLOOR_HORIZONTAL_MARGIN
    );
  }

  public getWindowPosition(window: BrowserWindow): WindowPositionResult {
    const workArea = this.getRelevantWorkArea(window);
    const bounds = this.capabilities.supportsAbsoluteWindowPosition
      ? window.getBounds()
      : positionWindowOnFloor(
          workArea,
          PET_WINDOW_WIDTH,
          PET_WINDOW_HEIGHT,
          FLOOR_HORIZONTAL_MARGIN
        );
    return this.describePosition(bounds.x, bounds.y, workArea);
  }

  public moveWindowBy(
    window: BrowserWindow,
    deltaX: number,
    deltaY: number
  ): WindowMoveResult {
    if (!this.capabilities.supportsProgrammaticWindowMove) {
      return this.stationaryResult(window);
    }
    const bounds = window.getBounds();
    return this.moveWindowTo(window, bounds.x + deltaX, bounds.y + deltaY);
  }

  public moveWindowTo(
    window: BrowserWindow,
    x: number,
    y: number
  ): WindowMoveResult {
    if (!this.capabilities.supportsProgrammaticWindowMove) {
      return this.stationaryResult(window);
    }
    const bounds = window.getBounds();
    const display = screen.getDisplayNearestPoint({
      x: Math.round(x + PET_WINDOW_WIDTH / 2),
      y: Math.round(y + PET_WINDOW_HEIGHT / 2)
    });
    const position = clampWindowPosition(
      x,
      y,
      PET_WINDOW_WIDTH,
      PET_WINDOW_HEIGHT,
      display.workArea
    );
    window.setContentBounds(
      {
        x: position.x,
        y: position.y,
        width: PET_WINDOW_WIDTH,
        height: PET_WINDOW_HEIGHT
      },
      false
    );
    return {
      ...this.describePosition(position.x, position.y, display.workArea),
      hitBoundary:
        position.x !== Math.round(x) || position.y !== Math.round(y),
      hitBoundaryX: position.x !== Math.round(x),
      hitBoundaryY: position.y !== Math.round(y)
    };
  }

  public getCursorPosition(window: BrowserWindow): CursorPositionResult {
    if (!this.capabilities.supportsCursorScreenPosition) {
      return { x: 0, y: 0, sameDisplay: false, supported: false };
    }
    const point = screen.getCursorScreenPoint();
    const cursorDisplay = screen.getDisplayNearestPoint(point);
    const petDisplay = screen.getDisplayMatching(window.getBounds());
    return {
      x: Math.round(point.x),
      y: Math.round(point.y),
      sameDisplay: cursorDisplay.id === petDisplay.id,
      supported: true
    };
  }

  public resetWindowPosition(window: BrowserWindow): boolean {
    if (!this.capabilities.supportsProgrammaticWindowMove) return false;
    const workArea = screen.getPrimaryDisplay().workArea;
    const position = positionWindowOnFloor(
      workArea,
      PET_WINDOW_WIDTH,
      PET_WINDOW_HEIGHT,
      FLOOR_HORIZONTAL_MARGIN
    );
    this.moveWindowTo(window, position.x, position.y);
    return true;
  }

  public setAlwaysOnTop(window: BrowserWindow, enabled: boolean): void {
    if (!this.capabilities.supportsAlwaysOnTop) return;
    window.setAlwaysOnTop(enabled, "floating");
  }

  public abstract setLaunchAtStartup(enabled: boolean): Promise<void>;
  public abstract getLaunchAtStartup(): Promise<boolean>;
  public abstract createShellLaunchSpec(cwd: string): {
    executable: string;
    args: readonly string[];
    cwd?: string;
  };

  private getRelevantWorkArea(window: BrowserWindow): Rectangle {
    if (!this.capabilities.supportsAbsoluteWindowPosition) {
      return screen.getPrimaryDisplay().workArea;
    }
    return screen.getDisplayMatching(window.getBounds()).workArea;
  }

  private stationaryResult(window: BrowserWindow): WindowMoveResult {
    const position = this.getWindowPosition(window);
    return {
      ...position,
      hitBoundary: true,
      hitBoundaryX: true,
      hitBoundaryY: true
    };
  }

  private describePosition(
    x: number,
    y: number,
    workArea: Rectangle
  ): WindowPositionResult {
    return {
      x: Math.round(x),
      y: Math.round(y),
      floorY: workArea.y + workArea.height - PET_WINDOW_HEIGHT,
      workAreaLeft: workArea.x,
      workAreaRight: workArea.x + workArea.width - PET_WINDOW_WIDTH,
      workAreaTop: workArea.y,
      workAreaBottom: workArea.y + workArea.height
    };
  }
}
