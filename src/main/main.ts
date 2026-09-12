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

console.info("[THUKUNA startup] Main module reached.");

let petWindow: BrowserWindow | null = null;
let trayController: ThukunaTrayController | null = null;
let settingsStore: SettingsStore | null = null;
let platformService: PlatformService | null = null;
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
    petWindow?.isVisible() ?? false
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
  registerPetWindowIpc(
    () => petWindow,
    platformService,
    {
      get: () => {
        if (settingsStore === null) throw new Error("Settings unavailable.");
        return settingsStore.getSnapshot();
      },
      update: ({ key, value }) => updateSettings({ [key]: value })
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
          quit: quitThukuna
        },
        platformService.capabilities
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
  });

  app.on("window-all-closed", () => {
    // The native tray owns lifecycle; only the explicit Quit action exits.
    if (trayController === null) app.quit();
  });
}
