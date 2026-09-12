import type { App } from "electron";
import type { PlatformCapabilities } from "../../shared/platform";
import { BasePlatformAdapter } from "./BasePlatformAdapter";
import type { LaunchSpec } from "./PlatformAdapter";
import { createWindowsLoginItemSettings } from "./windowsLoginItem";

export class WindowsPlatformAdapter extends BasePlatformAdapter {
  public constructor(
    capabilities: PlatformCapabilities,
    private readonly application: Pick<
      App,
      "setLoginItemSettings" | "getLoginItemSettings" | "getPath" |
      "getAppPath" | "isPackaged"
    >
  ) {
    super(capabilities);
  }

  public async setLaunchAtStartup(enabled: boolean): Promise<void> {
    this.application.setLoginItemSettings(
      createWindowsLoginItemSettings(this.application, enabled)
    );
  }

  public async getLaunchAtStartup(): Promise<boolean> {
    return this.application.getLoginItemSettings().openAtLogin;
  }

  public createShellLaunchSpec(cwd: string): LaunchSpec {
    return {
      executable: "powershell.exe",
      args: ["-NoExit", "-Command", "Set-Location", "-LiteralPath", cwd],
      cwd
    };
  }
}
