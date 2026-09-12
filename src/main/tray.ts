import { Menu, Tray, nativeImage, type MenuItemConstructorOptions } from "electron";
import type { ThukunaSettingKey, ThukunaSettings } from "../shared/settings";
import type { PlatformCapabilities } from "../shared/platform";
import { createTrayMenuModel, type TrayActionId } from "./trayMenuModel";

export interface ThukunaTrayActions {
  show(): void;
  hide(): void;
  updateSetting(key: ThukunaSettingKey, value: boolean): void;
  resetPosition(): void;
  quit(): void;
}

export interface ThukunaTrayController {
  refresh(settings: ThukunaSettings, visible: boolean): void;
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
  capabilities: PlatformCapabilities
): ThukunaTrayController => {
  const trayImage = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  const tray = new Tray(trayImage);
  tray.setToolTip("THUKUNA");
  let signature = "";

  const refresh = (settings: ThukunaSettings, visible: boolean): void => {
    const nextSignature = JSON.stringify({ settings, visible, capabilities });
    if (nextSignature === signature) return;
    signature = nextSignature;
    const model = createTrayMenuModel(settings, visible, capabilities);
    const items: MenuItemConstructorOptions[] = [
      { label: "THUKUNA", enabled: false },
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
  refresh(initialSettings, initiallyVisible);
  return {
    refresh,
    destroy: () => tray.destroy()
  };
};
