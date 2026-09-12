import path from "node:path";
import type { App } from "electron";
import type { PlatformEnvironment, ThukunaPlatform } from "../../shared/platform";

export interface PlatformPaths {
  readonly userData: string;
  readonly home: string;
  readonly configuration: string;
  readonly temporary: string;
  readonly executable: string;
}

export const createPlatformPaths = (
  application: Pick<App, "getPath">,
  platform: ThukunaPlatform,
  environment: PlatformEnvironment
): PlatformPaths => {
  const home = application.getPath("home");
  return {
    userData: application.getPath("userData"),
    home,
    configuration:
      platform === "linux" && environment.XDG_CONFIG_HOME?.trim()
        ? path.resolve(environment.XDG_CONFIG_HOME)
        : platform === "linux"
          ? path.join(home, ".config")
          : application.getPath("appData"),
    temporary: application.getPath("temp"),
    executable: application.getPath("exe")
  };
};
