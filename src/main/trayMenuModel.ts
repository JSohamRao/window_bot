import type { ThukunaSettings } from "../shared/settings";
import {
  DEFAULT_PLATFORM_CAPABILITIES,
  type PlatformCapabilities
} from "../shared/platform";

export type TrayActionId =
  | "VISIBILITY"
  | "AUTONOMY"
  | "DIALOGUE"
  | "MOUSE_AWARENESS"
  | "RARE_EVENTS"
  | "CHAOS_MODE"
  | "LOW_POWER_MODE"
  | "ALWAYS_ON_TOP"
  | "RESET_POSITION"
  | "LAUNCH_ON_STARTUP"
  | "QUIT";

export interface TrayMenuItemModel {
  readonly id: TrayActionId;
  readonly label: string;
  readonly checked?: boolean;
  readonly enabled?: boolean;
}

export const createTrayMenuModel = (
  settings: ThukunaSettings,
  visible: boolean,
  capabilities: PlatformCapabilities = DEFAULT_PLATFORM_CAPABILITIES
): readonly TrayMenuItemModel[] => [
  { id: "VISIBILITY", label: visible ? "Hide Thukuna" : "Show Thukuna" },
  { id: "AUTONOMY", label: settings.autonomyEnabled ? "Pause Autonomy" : "Resume Autonomy" },
  { id: "DIALOGUE", label: "Dialogue", checked: settings.dialogueEnabled },
  { id: "MOUSE_AWARENESS", label: "Mouse Awareness", checked: settings.mouseAwarenessEnabled },
  { id: "RARE_EVENTS", label: "Rare Events", checked: settings.rareEventsEnabled },
  { id: "CHAOS_MODE", label: "Chaos Mode", checked: settings.chaosMode },
  { id: "LOW_POWER_MODE", label: "Low Power Mode", checked: settings.lowPowerMode },
  {
    id: "ALWAYS_ON_TOP",
    label: "Always On Top",
    checked: settings.alwaysOnTop,
    enabled: capabilities.supportsAlwaysOnTop
  },
  {
    id: "RESET_POSITION",
    label: capabilities.supportsProgrammaticWindowMove
      ? "Reset Position"
      : "Reset Position (Unavailable)",
    enabled:
      capabilities.supportsAbsoluteWindowPosition &&
      capabilities.supportsProgrammaticWindowMove
  },
  {
    id: "LAUNCH_ON_STARTUP",
    label: "Launch on Startup",
    checked: settings.launchOnStartup,
    enabled: capabilities.supportsAutostart
  },
  { id: "QUIT", label: "Quit" }
];
