import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  DEFAULT_THUKUNA_SETTINGS,
  applySettingsPatch,
  sanitizeThukunaSettings,
  settingsEqual,
  type ThukunaSettings
} from "../shared/settings";

export interface SettingsFileIo {
  read(path: string): Promise<string>;
  ensureDirectory(path: string): Promise<void>;
  write(path: string, contents: string): Promise<void>;
  replace(source: string, destination: string): Promise<void>;
}

const nodeFileIo: SettingsFileIo = {
  read: (path) => readFile(path, "utf8"),
  ensureDirectory: async (path) => { await mkdir(path, { recursive: true }); },
  write: (path, contents) => writeFile(path, contents, "utf8"),
  replace: (source, destination) => rename(source, destination)
};

export class SettingsStore {
  private settings: ThukunaSettings = { ...DEFAULT_THUKUNA_SETTINGS };
  private writeQueue: Promise<void> = Promise.resolve();
  private writeCount = 0;

  public constructor(
    private readonly filePath: string,
    private readonly io: SettingsFileIo = nodeFileIo,
    private readonly warn: (message: string, error?: unknown) => void = console.warn
  ) {}

  public async load(): Promise<ThukunaSettings> {
    try {
      const text = await this.io.read(this.filePath);
      this.settings = sanitizeThukunaSettings(JSON.parse(text));
    } catch (error: unknown) {
      const code = (error as { code?: unknown })?.code;
      if (code !== "ENOENT") {
        this.warn("[THUKUNA] Settings could not be loaded; defaults will be used.", error);
      }
      this.settings = { ...DEFAULT_THUKUNA_SETTINGS };
    }
    return this.getSnapshot();
  }

  public getSnapshot(): ThukunaSettings {
    return { ...this.settings };
  }

  public async update(patch: Partial<ThukunaSettings>): Promise<boolean> {
    const next = applySettingsPatch(this.settings, patch);
    if (settingsEqual(this.settings, next)) return false;
    this.settings = next;
    const snapshot = this.getSnapshot();
    this.writeQueue = this.writeQueue.then(
      () => this.writeSnapshot(snapshot),
      () => this.writeSnapshot(snapshot)
    );
    await this.writeQueue;
    return true;
  }

  public getWriteCount(): number {
    return this.writeCount;
  }

  private async writeSnapshot(snapshot: ThukunaSettings): Promise<void> {
    const temporaryPath = `${this.filePath}.tmp`;
    try {
      await this.io.ensureDirectory(dirname(this.filePath));
      await this.io.write(temporaryPath, `${JSON.stringify(snapshot, null, 2)}\n`);
      await this.io.replace(temporaryPath, this.filePath);
      this.writeCount += 1;
    } catch (error: unknown) {
      this.warn("[THUKUNA] Settings could not be saved.", error);
    }
  }
}
