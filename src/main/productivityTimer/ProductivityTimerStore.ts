import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  PRODUCTIVITY_TIMER_LABEL_MAX_LENGTH,
  PRODUCTIVITY_TIMER_MAX_DURATION_MS,
  isProductivityTimerKind,
  type ProductivityTimerKind
} from "../../shared/productivityTimer";

export type PersistedProductivityTimer =
  | {
      readonly version: 1;
      readonly state: "running";
      readonly timerId: string;
      readonly durationMs: number;
      readonly kind: ProductivityTimerKind;
      readonly label: string | null;
      readonly startedAt: number;
      readonly deadlineAt: number;
    }
  | {
      readonly version: 1;
      readonly state: "paused";
      readonly timerId: string;
      readonly durationMs: number;
      readonly remainingMs: number;
      readonly kind: ProductivityTimerKind;
      readonly label: string | null;
      readonly startedAt: number;
      readonly pausedAt: number;
    }
  | {
      readonly version: 1;
      readonly state: "completed";
      readonly timerId: string;
      readonly durationMs: number;
      readonly kind: ProductivityTimerKind;
      readonly label: string | null;
      readonly startedAt: number;
      readonly completedAt: number;
      readonly completionPending: boolean;
    };

export interface ProductivityTimerFileIo {
  read(path: string): Promise<string>;
  ensureDirectory(path: string): Promise<void>;
  write(path: string, contents: string): Promise<void>;
  replace(source: string, destination: string): Promise<void>;
  remove(path: string): Promise<void>;
}

const nodeFileIo: ProductivityTimerFileIo = {
  read: (path) => readFile(path, "utf8"),
  ensureDirectory: async (path) => { await mkdir(path, { recursive: true }); },
  write: (path, contents) => writeFile(path, contents, "utf8"),
  replace: (source, destination) => rename(source, destination),
  remove: async (path) => { await rm(path, { force: true }); }
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isTimestamp = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const isLabel = (value: unknown): value is string | null =>
  value === null ||
  (typeof value === "string" &&
    value.length > 0 &&
    value.length <= PRODUCTIVITY_TIMER_LABEL_MAX_LENGTH &&
    value.trim() === value);

export const isPersistedProductivityTimer = (
  value: unknown
): value is PersistedProductivityTimer => {
  if (!isObject(value)) return false;
  if (
    value.version !== 1 ||
    (value.state !== "running" &&
      value.state !== "paused" &&
      value.state !== "completed") ||
    typeof value.timerId !== "string" ||
    value.timerId.length === 0 ||
    value.timerId.length > 128 ||
    typeof value.durationMs !== "number" ||
    !Number.isFinite(value.durationMs) ||
    value.durationMs <= 0 ||
    value.durationMs > PRODUCTIVITY_TIMER_MAX_DURATION_MS ||
    !isProductivityTimerKind(value.kind) ||
    !isLabel(value.label) ||
    !isTimestamp(value.startedAt)
  ) return false;
  if (value.state === "running") return isTimestamp(value.deadlineAt);
  if (value.state === "paused") {
    return typeof value.remainingMs === "number" &&
      Number.isFinite(value.remainingMs) &&
      value.remainingMs >= 0 &&
      value.remainingMs <= value.durationMs &&
      isTimestamp(value.pausedAt);
  }
  return isTimestamp(value.completedAt) &&
    typeof value.completionPending === "boolean";
};

export interface ProductivityTimerPersistence {
  load(): Promise<PersistedProductivityTimer | null>;
  save(value: PersistedProductivityTimer): Promise<void>;
  clear(): Promise<void>;
}

export class ProductivityTimerStore implements ProductivityTimerPersistence {
  private writeQueue: Promise<void> = Promise.resolve();
  private writeCount = 0;
  private clearCount = 0;

  public constructor(
    private readonly filePath: string,
    private readonly io: ProductivityTimerFileIo = nodeFileIo,
    private readonly warn: (message: string, error?: unknown) => void = console.warn
  ) {}

  public async load(): Promise<PersistedProductivityTimer | null> {
    try {
      const value: unknown = JSON.parse(await this.io.read(this.filePath));
      if (isPersistedProductivityTimer(value)) return value;
      this.warn("[THUKUNA] Persisted productivity timer was invalid; ignoring it.");
    } catch (error: unknown) {
      const code = (error as { code?: unknown })?.code;
      if (code !== "ENOENT") {
        this.warn("[THUKUNA] Productivity timer could not be loaded.", error);
      }
    }
    return null;
  }

  public save(value: PersistedProductivityTimer): Promise<void> {
    return this.enqueue(async () => {
      const temporaryPath = `${this.filePath}.tmp`;
      await this.io.ensureDirectory(dirname(this.filePath));
      await this.io.write(temporaryPath, `${JSON.stringify(value, null, 2)}\n`);
      await this.io.replace(temporaryPath, this.filePath);
      this.writeCount += 1;
    });
  }

  public clear(): Promise<void> {
    return this.enqueue(async () => {
      await this.io.remove(this.filePath);
      this.clearCount += 1;
    });
  }

  public getWriteCount(): number { return this.writeCount; }
  public getClearCount(): number { return this.clearCount; }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const guarded = async (): Promise<void> => {
      try {
        await operation();
      } catch (error: unknown) {
        this.warn("[THUKUNA] Productivity timer could not be persisted.", error);
      }
    };
    this.writeQueue = this.writeQueue.then(guarded, guarded);
    return this.writeQueue;
  }
}
