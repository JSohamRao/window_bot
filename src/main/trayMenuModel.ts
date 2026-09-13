import type { ThukunaSettings } from "../shared/settings";
import {
  DEFAULT_PLATFORM_CAPABILITIES,
  type PlatformCapabilities
} from "../shared/platform";
import {
  PRODUCTIVITY_TIMER_PRESETS,
  PRODUCTIVITY_TIMER_USER_PRESET_IDS,
  formatProductivityTimerRemaining,
  type ProductivityTimerPresetId,
  type ProductivityTimerSnapshot
} from "../shared/productivityTimer";

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

export type ProductivityTimerTrayActionId =
  | ProductivityTimerPresetId
  | "TIMER_STATUS"
  | "TIMER_PAUSE"
  | "TIMER_RESUME"
  | "TIMER_CANCEL";

export interface ProductivityTimerTrayItemModel {
  readonly id: ProductivityTimerTrayActionId;
  readonly label: string;
  readonly enabled: boolean;
}

export const createProductivityTimerTrayModel = (
  snapshot: ProductivityTimerSnapshot
): readonly ProductivityTimerTrayItemModel[] => {
  const mayStart =
    snapshot.state === "idle" ||
    (snapshot.state === "completed" && !snapshot.completionPending);
  const status = snapshot.state === "idle"
    ? "No active timer"
    : snapshot.state === "completed"
      ? `${snapshot.label ?? "Timer"}: complete`
      : `${snapshot.label ?? "Timer"}: ${formatProductivityTimerRemaining(snapshot.remainingMs)} (${snapshot.state})`;
  return [
    { id: "TIMER_STATUS", label: status, enabled: false },
    ...PRODUCTIVITY_TIMER_USER_PRESET_IDS.map((id) => ({
      id,
      label: PRODUCTIVITY_TIMER_PRESETS[id].label,
      enabled: mayStart
    })),
    { id: "TIMER_PAUSE", label: "Pause", enabled: snapshot.state === "running" },
    { id: "TIMER_RESUME", label: "Resume", enabled: snapshot.state === "paused" },
    {
      id: "TIMER_CANCEL",
      label: "Cancel",
      enabled: snapshot.state !== "idle"
    }
  ];
};

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
