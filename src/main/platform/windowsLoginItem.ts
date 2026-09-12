import path from "node:path";

export interface WindowsLoginApplication {
  readonly isPackaged: boolean;
  getPath(name: "exe"): string;
  getAppPath(): string;
}

export interface WindowsLoginItemSettings {
  readonly openAtLogin: boolean;
  readonly path: string;
  readonly args: string[];
}

export const createWindowsLoginItemSettings = (
  application: WindowsLoginApplication,
  enabled: boolean
): WindowsLoginItemSettings => ({
  openAtLogin: enabled,
  path: path.resolve(application.getPath("exe")),
  args: application.isPackaged ? [] : [path.resolve(application.getAppPath())]
});
