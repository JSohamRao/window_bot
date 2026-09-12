import { Notification, shell, type App, type BrowserWindow } from "electron";
import { spawn } from "node:child_process";
import type { PlatformCapabilities, PlatformEnvironment } from "../../shared/platform";
import { detectPlatformCapabilities } from "../../shared/platform";
import type {
  CursorPositionResult,
  WindowMoveResult,
  WindowPositionResult
} from "../../shared/ipcChannels";
import type { WindowPosition } from "../windowBounds";
import { LinuxPlatformAdapter } from "./LinuxPlatformAdapter";
import type { LaunchSpec, PlatformAdapter } from "./PlatformAdapter";
import { WindowsPlatformAdapter } from "./WindowsPlatformAdapter";
import { createPlatformPaths, type PlatformPaths } from "./platformPaths";

export class PlatformService {
  public readonly capabilities: PlatformCapabilities;

  public constructor(
    private readonly adapter: PlatformAdapter,
    public readonly paths: PlatformPaths
  ) {
    this.capabilities = adapter.capabilities;
  }

  public getInitialWindowPosition(): WindowPosition | null {
    return this.adapter.getInitialWindowPosition();
  }
  public getWindowPosition(window: BrowserWindow): WindowPositionResult {
    return this.adapter.getWindowPosition(window);
  }
  public moveWindowBy(window: BrowserWindow, dx: number, dy: number): WindowMoveResult {
    return this.adapter.moveWindowBy(window, dx, dy);
  }
  public moveWindowTo(window: BrowserWindow, x: number, y: number): WindowMoveResult {
    return this.adapter.moveWindowTo(window, x, y);
  }
  public getCursorPosition(window: BrowserWindow): CursorPositionResult {
    return this.adapter.getCursorPosition(window);
  }
  public resetWindowPosition(window: BrowserWindow): boolean {
    return this.adapter.resetWindowPosition(window);
  }
  public setAlwaysOnTop(window: BrowserWindow, enabled: boolean): void {
    this.adapter.setAlwaysOnTop(window, enabled);
  }
  public setLaunchAtStartup(enabled: boolean): Promise<void> {
    return this.adapter.setLaunchAtStartup(enabled);
  }
  public getLaunchAtStartup(): Promise<boolean> {
    return this.adapter.getLaunchAtStartup();
  }
  public openPath(targetPath: string): Promise<string> {
    return shell.openPath(targetPath);
  }
  public openExternal(url: string): Promise<void> {
    return shell.openExternal(url);
  }
  public showNotification(title: string, body: string): boolean {
    if (!this.capabilities.supportsNotifications || !Notification.isSupported()) {
      return false;
    }
    new Notification({ title, body }).show();
    return true;
  }
  public getShellLaunchSpec(cwd: string): LaunchSpec {
    return this.adapter.createShellLaunchSpec(cwd);
  }
  public launchApplication(spec: LaunchSpec): void {
    const child = spawn(spec.executable, [...spec.args], {
      cwd: spec.cwd,
      detached: true,
      shell: false,
      stdio: "ignore"
    });
    child.unref();
  }
}

export const createPlatformService = (
  application: App,
  platform: NodeJS.Platform | string = process.platform,
  environment: NodeJS.ProcessEnv = process.env
): PlatformService => {
  const platformEnvironment: PlatformEnvironment = {
    XDG_SESSION_TYPE: environment.XDG_SESSION_TYPE,
    WAYLAND_DISPLAY: environment.WAYLAND_DISPLAY,
    DISPLAY: environment.DISPLAY,
    XDG_CONFIG_HOME: environment.XDG_CONFIG_HOME,
    ELECTRON_OZONE_PLATFORM_HINT: environment.ELECTRON_OZONE_PLATFORM_HINT,
    OZONE_PLATFORM: environment.OZONE_PLATFORM
  };
  const capabilities = detectPlatformCapabilities(platform, platformEnvironment);
  const paths = createPlatformPaths(
    application,
    capabilities.platform,
    platformEnvironment
  );
  const adapter: PlatformAdapter = capabilities.platform === "windows"
    ? new WindowsPlatformAdapter(capabilities, application)
    : new LinuxPlatformAdapter(
        capabilities,
        {
          home: paths.home,
          config:
            environment.XDG_CONFIG_HOME?.trim() || paths.configuration,
          executable: paths.executable,
          arguments: application.isPackaged ? [] : [application.getAppPath()]
        },
        environment.SHELL
      );
  return new PlatformService(adapter, paths);
};
