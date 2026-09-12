import { BrowserWindow } from "electron";
import path from "node:path";
import { PET_WINDOW_HEIGHT, PET_WINDOW_WIDTH } from "../shared/windowGeometry";
import type { PlatformService } from "./platform/PlatformService";
import { logRuntimeDiagnostic } from "./runtimeDiagnostics";

export { PET_WINDOW_HEIGHT, PET_WINDOW_WIDTH } from "../shared/windowGeometry";
export const createPetWindow = (
  platform: PlatformService,
  alwaysOnTop = true
): BrowserWindow => {
  const initialPosition = platform.getInitialWindowPosition();
  console.info("[THUKUNA startup] BrowserWindow construction reached.");
  const window = new BrowserWindow({
    ...(initialPosition ?? {}),
    width: PET_WINDOW_WIDTH,
    height: PET_WINDOW_HEIGHT,
    useContentSize: true,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: platform.capabilities.supportsAlwaysOnTop && alwaysOnTop,
    skipTaskbar: true,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  console.info("[THUKUNA startup] BrowserWindow created; loading renderer.");

  platform.setAlwaysOnTop(window, alwaysOnTop);
  window.webContents.on("console-message", (details) => {
    if (details.level === "warning" || details.level === "error") {
      console.warn(`[THUKUNA renderer:${details.level}] ${details.message}`);
    }
  });
  window.webContents.on(
    "did-fail-load",
    (_event, code, description, validatedUrl) => {
      console.error(
        `[THUKUNA] Renderer load failed (${code}) ${description}: ${validatedUrl}`
      );
      logRuntimeDiagnostic(
        "ERROR",
        `Renderer load failed (${code}) ${description}: ${validatedUrl}`
      );
    }
  );
  window.webContents.on("did-finish-load", () => {
    console.info("[THUKUNA startup] Renderer document finished loading.");
  });
  window.webContents.on("render-process-gone", (_event, details) => {
    console.error(
      `[THUKUNA startup] Renderer process exited: ${details.reason} (${details.exitCode}).`
    );
    logRuntimeDiagnostic(
      "ERROR",
      `Renderer process exited: ${details.reason} (${details.exitCode}).`
    );
  });
  void window.loadFile(path.join(__dirname, "../renderer/index.html"));

  window.once("ready-to-show", () => {
    console.info("[THUKUNA startup] Pet window ready to show.");
    window.showInactive();
  });

  return window;
};

export const resetPetWindowPosition = (
  platform: PlatformService,
  window: BrowserWindow
): boolean => platform.resetWindowPosition(window);
