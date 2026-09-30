import { app, BrowserWindow } from "electron";
import path from "node:path";
import { IPC_CHANNELS } from "../shared/ipcChannels";
import type { ThukunaSettingKey, ThukunaSettings } from "../shared/settings";
import { registerPetWindowIpc } from "./ipc";
import { createPetWindow, resetPetWindowPosition } from "./petWindow";
import { SettingsStore } from "./settingsStore";
import { createThukunaTray, type ThukunaTrayController } from "./tray";
import { getTrayIconPath } from "./runtimeAssetPaths";
import {
  installRuntimeDiagnostics,
  logRuntimeDiagnostic
} from "./runtimeDiagnostics";
import { configureSingleInstance } from "./singleInstance";
import {
  createPlatformService,
  type PlatformService
} from "./platform/PlatformService";
import { SystemAwarenessService } from "./systemAwareness/SystemAwarenessService";
import { createElectronSystemAwarenessProvider } from "./systemAwareness/ElectronSystemAwarenessProvider";
import { ProductivityTimerService } from "./productivityTimer/ProductivityTimerService";
import { ProductivityTimerStore } from "./productivityTimer/ProductivityTimerStore";
import {
  requestForProductivityTimerPreset,
  type ProductivityTimerPresetId
} from "../shared/productivityTimer";

console.info("[THUKUNA startup] Main module reached.");

let petWindow: BrowserWindow | null = null;
let trayController: ThukunaTrayController | null = null;
let settingsStore: SettingsStore | null = null;
let platformService: PlatformService | null = null;
let systemAwarenessService: SystemAwarenessService | null = null;
let productivityTimerService: ProductivityTimerService | null = null;
let disposePhase15Ipc: (() => void) | null = null;
let quitting = false;

const sendToRenderer = (channel: string, value?: unknown): void => {
  if (petWindow !== null && !petWindow.isDestroyed()) {
    petWindow.webContents.send(channel, value);
  }
};

const refreshTray = (): void => {
  if (settingsStore === null) return;
  trayController?.refresh(
    settingsStore.getSnapshot(),
    petWindow?.isVisible() ?? false,
    productivityTimerService?.getSnapshot()
  );
};

const hideThukuna = (): void => {
  if (petWindow === null || petWindow.isDestroyed()) return;
  sendToRenderer(IPC_CHANNELS.visibilityChanged, false);
  if (petWindow.isVisible()) petWindow.hide();
  refreshTray();
};

const showThukuna = (): void => {
  if (petWindow === null || petWindow.isDestroyed()) {
    if (platformService === null) return;
    const settings = settingsStore?.getSnapshot();
    petWindow = createPetWindow(
      platformService,
      settings?.alwaysOnTop ?? true
    );
    petWindow.on("close", (event) => {
      if (!quitting && trayController !== null) {
        event.preventDefault();
        hideThukuna();
      }
    });
    petWindow.on("closed", () => {
      petWindow = null;
      refreshTray();
    });
    petWindow.webContents.once("did-finish-load", () => {
      if (settingsStore !== null) {
        sendToRenderer(IPC_CHANNELS.settingsChanged, settingsStore.getSnapshot());
      }
      sendToRenderer(IPC_CHANNELS.visibilityChanged, true);
      if (systemAwarenessService !== null) {
        sendToRenderer(
          IPC_CHANNELS.systemAwarenessChanged,
          systemAwarenessService.getSnapshot()
        );
      }
      if (productivityTimerService !== null) {
        sendToRenderer(
          IPC_CHANNELS.productivityTimerChanged,
          productivityTimerService.getSnapshot()
        );
      }
    });
  } else {
    petWindow.showInactive();
    sendToRenderer(IPC_CHANNELS.visibilityChanged, true);
  }
  refreshTray();
};

const updateSettings = async (
  patch: Partial<ThukunaSettings>
): Promise<ThukunaSettings> => {
  if (settingsStore === null) throw new Error("Settings are not initialized.");
  const before = settingsStore.getSnapshot();
  const changed = await settingsStore.update(patch);
  const settings = settingsStore.getSnapshot();
  if (!changed) return settings;

  if (before.alwaysOnTop !== settings.alwaysOnTop && petWindow !== null) {
    platformService?.setAlwaysOnTop(petWindow, settings.alwaysOnTop);
  }
  if (
    before.launchOnStartup !== settings.launchOnStartup &&
    platformService?.capabilities.supportsAutostart
  ) {
    try {
      await platformService.setLaunchAtStartup(settings.launchOnStartup);
    } catch (error: unknown) {
      console.warn("[THUKUNA] Startup setting could not be applied.", error);
    }
  }
  sendToRenderer(IPC_CHANNELS.settingsChanged, settings);
  refreshTray();
  return settings;
};

const resetPosition = (): void => {
  if (
    petWindow === null ||
    petWindow.isDestroyed() ||
    platformService === null
  ) return;
  if (resetPetWindowPosition(platformService, petWindow)) {
    sendToRenderer(IPC_CHANNELS.resetPosition);
  }
};

const quitThukuna = (): void => {
  quitting = true;
  trayController?.destroy();
  trayController = null;
  petWindow?.close();
  app.quit();
};

const primaryInstance = configureSingleInstance(app, showThukuna);

if (primaryInstance) void app.whenReady().then(async () => {
  console.info("[THUKUNA startup] Electron app ready.");
  platformService = createPlatformService(app);
  systemAwarenessService = new SystemAwarenessService(
    createElectronSystemAwarenessProvider(),
    {
      onChanged: (snapshot) => {
        sendToRenderer(IPC_CHANNELS.systemAwarenessChanged, snapshot);
        if (snapshot.sessionState === "active" && productivityTimerService !== null) {
          productivityTimerService.refresh();
          sendToRenderer(
            IPC_CHANNELS.productivityTimerChanged,
            productivityTimerService.getSnapshot()
          );
        }
      },
      onGeometryInvalidated: () => {
        if (
          petWindow === null ||
          petWindow.isDestroyed() ||
          platformService === null
        ) return;
        const bounds = petWindow.getBounds();
        platformService.moveWindowTo(petWindow, bounds.x, bounds.y);
      }
    }
  );
  systemAwarenessService.start();
  installRuntimeDiagnostics(platformService.paths.userData, (code) => app.exit(code));
  app.on("child-process-gone", (_event, details) => {
    const message = `${details.type} process exited: ${details.reason} (${details.exitCode}).`;
    console.error(`[THUKUNA startup] ${message}`);
    logRuntimeDiagnostic("ERROR", message);
  });
  settingsStore = new SettingsStore(
    path.join(platformService.paths.userData, "thukuna-settings.json")
  );
  await settingsStore.load();
  productivityTimerService = new ProductivityTimerService(
    new ProductivityTimerStore(
      path.join(platformService.paths.userData, "thukuna-productivity-timer.json")
    ),
    {
      allowDevelopmentDurations: !app.isPackaged,
      onChanged: (snapshot) => {
        if (systemAwarenessService?.getSnapshot().sessionState === "active") {
          sendToRenderer(IPC_CHANNELS.productivityTimerChanged, snapshot);
        }
        refreshTray();
      }
    }
  );
  await productivityTimerService.initialize();
  disposePhase15Ipc = registerPetWindowIpc(
    () => petWindow,
    platformService,
    {
      get: () => {
        if (settingsStore === null) throw new Error("Settings unavailable.");
        return settingsStore.getSnapshot();
      },
      update: ({ key, value }) => updateSettings({ [key]: value })
    },
    {
      get: () => {
        if (systemAwarenessService === null) {
          throw new Error("System Awareness unavailable.");
        }
        return systemAwarenessService.getSnapshot();
      }
    },
    {
      allowDevelopmentDurations: !app.isPackaged,
      get: () => {
        if (productivityTimerService === null) {
          throw new Error("Productivity timer unavailable.");
        }
        return productivityTimerService.getSnapshot();
      },
      start: (request) => {
        if (productivityTimerService === null) {
          throw new Error("Productivity timer unavailable.");
        }
        return productivityTimerService.startTimer(request);
      },
      pause: () => {
        if (productivityTimerService === null) {
          throw new Error("Productivity timer unavailable.");
        }
        return productivityTimerService.pause();
      },
      resume: () => {
        if (productivityTimerService === null) {
          throw new Error("Productivity timer unavailable.");
        }
        return productivityTimerService.resume();
      },
      cancel: () => {
        if (productivityTimerService === null) {
          throw new Error("Productivity timer unavailable.");
        }
        return productivityTimerService.cancel();
      },
      acknowledge: (completionId) => {
        if (productivityTimerService === null) {
          throw new Error("Productivity timer unavailable.");
        }
        return productivityTimerService.acknowledgeCompletion(completionId);
      }
    }
  );
  console.info("[THUKUNA startup] Creating pet window.");
  showThukuna();
  if (platformService.capabilities.supportsTray) {
    try {
      trayController = createThukunaTray(
        getTrayIconPath(__dirname),
        settingsStore.getSnapshot(),
        true,
        {
          show: showThukuna,
          hide: hideThukuna,
          updateSetting: (key: ThukunaSettingKey, value: boolean) => {
            void updateSettings({ [key]: value });
          },
          resetPosition,
          startTimer: (presetId: ProductivityTimerPresetId) => {
            void productivityTimerService
              ?.startTimer(requestForProductivityTimerPreset(presetId));
          },
          pauseTimer: () => { void productivityTimerService?.pause(); },
          resumeTimer: () => { void productivityTimerService?.resume(); },
          cancelTimer: () => { void productivityTimerService?.cancel(); },
          quit: quitThukuna
        },
        platformService.capabilities,
        productivityTimerService.getSnapshot()
      );
    } catch (error: unknown) {
      console.warn("[THUKUNA] System tray is unavailable.", error);
    }
  }
  app.on("activate", showThukuna);
});

if (primaryInstance) {
  app.on("before-quit", () => {
    quitting = true;
    disposePhase15Ipc?.();
    disposePhase15Ipc = null;
    systemAwarenessService?.dispose();
    productivityTimerService?.dispose();
  });

  app.on("window-all-closed", () => {
    // The native tray owns lifecycle; only the explicit Quit action exits.
    if (trayController === null) app.quit();
  });
}
