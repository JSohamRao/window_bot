import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from "electron";
import type { ThukunaSettingKey, ThukunaSettings } from "../shared/settings";
import type { PlatformCapabilities } from "../shared/platform";
import {
  createIdleProductivityTimerSnapshot,
  type ProductivityTimerPresetId,
  type ProductivityTimerSnapshot
} from "../shared/productivityTimer";
import {
  createProductivityTimerTrayModel,
  createTrayMenuModel,
  type TrayActionId
} from "./trayMenuModel";

export interface ThukunaTrayActions {
  show(): void;
  hide(): void;
  updateSetting(key: ThukunaSettingKey, value: boolean): void;
  resetPosition(): void;
  startTimer(presetId: ProductivityTimerPresetId): void;
  pauseTimer(): void;
  resumeTimer(): void;
  cancelTimer(): void;
  quit(): void;
}

export interface ThukunaTrayController {
  refresh(
    settings: ThukunaSettings,
    visible: boolean,
    timerSnapshot?: ProductivityTimerSnapshot
  ): void;
  destroy(): void;
}

const settingByAction: Partial<Record<TrayActionId, ThukunaSettingKey>> = {
  DIALOGUE: "dialogueEnabled",
  MOUSE_AWARENESS: "mouseAwarenessEnabled",
  RARE_EVENTS: "rareEventsEnabled",
  CHAOS_MODE: "chaosMode",
  LOW_POWER_MODE: "lowPowerMode",
  ALWAYS_ON_TOP: "alwaysOnTop",
  LAUNCH_ON_STARTUP: "launchOnStartup"
};

export const createThukunaTray = (
  iconPath: string,
  initialSettings: ThukunaSettings,
  initiallyVisible: boolean,
  actions: ThukunaTrayActions,
  capabilities: PlatformCapabilities,
  initialTimerSnapshot: ProductivityTimerSnapshot = createIdleProductivityTimerSnapshot()
): ThukunaTrayController => {
  const trayImage = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  const tray = new Tray(trayImage);
  tray.setToolTip("THUKUNA");
  let signature = "";

  const refresh = (
    settings: ThukunaSettings,
    visible: boolean,
    timerSnapshot = createIdleProductivityTimerSnapshot()
  ): void => {
    const nextSignature = JSON.stringify({ settings, visible, capabilities, timerSnapshot });
    if (nextSignature === signature) return;
    signature = nextSignature;
    const model = createTrayMenuModel(settings, visible, capabilities);
    const items: MenuItemConstructorOptions[] = [
      { label: "THUKUNA", enabled: false },
      { type: "separator" },
      {
        label: "Productivity Timer",
        submenu: createProductivityTimerTrayModel(timerSnapshot).map((item) => ({
          label: item.label,
          enabled: item.enabled,
          click: () => {
            if (item.id === "TIMER_PAUSE") actions.pauseTimer();
            else if (item.id === "TIMER_RESUME") actions.resumeTimer();
            else if (item.id === "TIMER_CANCEL") actions.cancelTimer();
            else if (item.id !== "TIMER_STATUS") actions.startTimer(item.id);
          }
        }))
      },
      { type: "separator" }
    ];
    for (const item of model) {
      if (item.id === "RESET_POSITION" || item.id === "QUIT") {
        items.push({
          label: item.label,
          enabled: item.enabled,
          click: item.id === "QUIT" ? actions.quit : actions.resetPosition
        });
      } else if (item.id === "VISIBILITY") {
        items.push({ label: item.label, click: visible ? actions.hide : actions.show });
      } else if (item.id === "AUTONOMY") {
        items.push({
          label: item.label,
          click: () => actions.updateSetting("autonomyEnabled", !settings.autonomyEnabled)
        });
      } else {
        const key = settingByAction[item.id];
        if (key !== undefined) {
          items.push({
            label: item.label,
            type: "checkbox",
            checked: item.checked,
            enabled: item.enabled,
            click: () => actions.updateSetting(key, !settings[key])
          });
        }
      }
      if (item.id === "VISIBILITY" || item.id === "AUTONOMY" || item.id === "LOW_POWER_MODE" || item.id === "RESET_POSITION") {
        items.push({ type: "separator" });
      }
    }
    tray.setContextMenu(Menu.buildFromTemplate(items));
  };

  tray.on("click", actions.show);
  refresh(initialSettings, initiallyVisible, initialTimerSnapshot);
  return {
    refresh,
    destroy: () => tray.destroy()
  };
};
