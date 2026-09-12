import { access, mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { PlatformCapabilities } from "../../shared/platform";
import { BasePlatformAdapter } from "./BasePlatformAdapter";
import type { LaunchSpec } from "./PlatformAdapter";
import {
  createLinuxAutostartEntry,
  getLinuxAutostartPath
} from "./linuxAutostart";

export interface LinuxPlatformPaths {
  readonly home: string;
  readonly config: string;
  readonly executable: string;
  readonly arguments?: readonly string[];
}

export class LinuxPlatformAdapter extends BasePlatformAdapter {
  private readonly autostartPath: string;

  public constructor(
    capabilities: PlatformCapabilities,
    private readonly paths: LinuxPlatformPaths,
    private readonly userShell?: string
  ) {
    super(capabilities);
    this.autostartPath = getLinuxAutostartPath(paths.config);
  }

  public async setLaunchAtStartup(enabled: boolean): Promise<void> {
    if (!enabled) {
      try {
        await unlink(this.autostartPath);
      } catch (error: unknown) {
        if ((error as { code?: unknown }).code !== "ENOENT") throw error;
      }
      return;
    }

    const directory = path.dirname(this.autostartPath);
    const temporaryPath = path.join(directory, ".thukuna.desktop.tmp");
    const contents = createLinuxAutostartEntry(
      this.paths.executable,
      this.paths.arguments
    );
    await mkdir(directory, { recursive: true });
    await writeFile(temporaryPath, contents, "utf8");
    await rename(temporaryPath, this.autostartPath);
  }

  public async getLaunchAtStartup(): Promise<boolean> {
    try {
      await access(this.autostartPath);
      return true;
    } catch {
      return false;
    }
  }

  public createShellLaunchSpec(cwd: string): LaunchSpec {
    return {
      executable: this.userShell?.trim() || "sh",
      args: [],
      cwd
    };
  }
}
