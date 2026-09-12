import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";

const MAX_LOG_BYTES = 256 * 1024;
let diagnosticWriter: ((level: string, message: string) => void) | null = null;

export const logRuntimeDiagnostic = (
  level: "INFO" | "WARN" | "ERROR" | "FATAL",
  message: string
): void => diagnosticWriter?.(level, message);

const formatReason = (reason: unknown): string =>
  reason instanceof Error
    ? `${reason.name}: ${reason.message}\n${reason.stack ?? ""}`
    : String(reason);

export const installRuntimeDiagnostics = (
  userDataDirectory: string,
  exitApplication: (code: number) => void
): void => {
  const logDirectory = path.join(userDataDirectory, "logs");
  const logPath = path.join(logDirectory, "thukuna.log");
  let writeQueue = Promise.resolve();

  const write = (level: string, message: string): void => {
    const line = `${new Date().toISOString()} ${level} ${message}\n`;
    writeQueue = writeQueue.then(async () => {
      await mkdir(logDirectory, { recursive: true });
      try {
        if ((await stat(logPath)).size >= MAX_LOG_BYTES) {
          await rename(logPath, `${logPath}.previous`).catch(() => undefined);
        }
      } catch {
        // A missing first-run log is expected.
      }
      await appendFile(logPath, line, "utf8");
    }).catch((error: unknown) => {
      console.error("[THUKUNA diagnostics] Could not write runtime log.", error);
    });
  };
  diagnosticWriter = write;

  process.on("uncaughtException", (error) => {
    console.error("[THUKUNA fatal]", error);
    write("FATAL", formatReason(error));
    void writeQueue.finally(() => exitApplication(1));
  });
  process.on("unhandledRejection", (reason) => {
    console.error("[THUKUNA unhandled rejection]", reason);
    write("ERROR", formatReason(reason));
  });

  write("INFO", `THUKUNA started (${process.platform}, ${process.arch}).`);
};
