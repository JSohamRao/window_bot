import type { ThukunaSettings } from "./settings";

export type ThukunaPlatform = "windows" | "linux";
export type DisplayServer = "win32" | "x11" | "xwayland" | "wayland" | "unknown";

export interface PlatformCapabilities {
  readonly platform: ThukunaPlatform;
  readonly displayServer: DisplayServer;
  readonly supportsAbsoluteWindowPosition: boolean;
  readonly supportsProgrammaticWindowMove: boolean;
  readonly supportsAlwaysOnTop: boolean;
  readonly supportsCursorScreenPosition: boolean;
  readonly supportsEdgeClimbing: boolean;
  readonly supportsPerching: boolean;
  readonly supportsAutostart: boolean;
  readonly supportsTray: boolean;
  readonly supportsNotifications: boolean;
}

export interface PlatformEnvironment {
  readonly XDG_SESSION_TYPE?: string;
  readonly WAYLAND_DISPLAY?: string;
  readonly DISPLAY?: string;
  readonly XDG_CONFIG_HOME?: string;
  readonly ELECTRON_OZONE_PLATFORM_HINT?: string;
  readonly OZONE_PLATFORM?: string;
}

const present = (value: string | undefined): boolean =>
  typeof value === "string" && value.trim().length > 0;

const normalized = (value: string | undefined): string =>
  value?.trim().toLowerCase() ?? "";

export const detectLinuxDisplayServer = (
  environment: PlatformEnvironment
): Exclude<DisplayServer, "win32"> => {
  const session = normalized(environment.XDG_SESSION_TYPE);
  const ozone = normalized(
    environment.ELECTRON_OZONE_PLATFORM_HINT ?? environment.OZONE_PLATFORM
  );
  const hasWayland = present(environment.WAYLAND_DISPLAY);
  const hasX11 = present(environment.DISPLAY);

  if (ozone === "wayland") return "wayland";
  if (ozone === "x11" || ozone === "xwayland") {
    return ozone === "xwayland" || session === "wayland" || hasWayland
      ? "xwayland"
      : "x11";
  }
  if (session === "x11") return "x11";
  if (session === "wayland") {
    return "wayland";
  }
  if (hasWayland && hasX11) return "xwayland";
  if (hasWayland) return "wayland";
  if (hasX11) return "x11";
  return "unknown";
};

export const detectPlatformCapabilities = (
  platform: NodeJS.Platform | string,
  environment: PlatformEnvironment = {}
): PlatformCapabilities => {
  if (platform === "win32") {
    return {
      platform: "windows",
      displayServer: "win32",
      supportsAbsoluteWindowPosition: true,
      supportsProgrammaticWindowMove: true,
      supportsAlwaysOnTop: true,
      supportsCursorScreenPosition: true,
      supportsEdgeClimbing: true,
      supportsPerching: true,
      supportsAutostart: true,
      supportsTray: true,
      supportsNotifications: true
    };
  }

  const displayServer = detectLinuxDisplayServer(environment);
  const fullDesktopPositioning =
    displayServer === "x11" || displayServer === "xwayland";
  return {
    platform: "linux",
    displayServer,
    supportsAbsoluteWindowPosition: fullDesktopPositioning,
    supportsProgrammaticWindowMove: fullDesktopPositioning,
    supportsAlwaysOnTop: fullDesktopPositioning,
    supportsCursorScreenPosition: fullDesktopPositioning,
    supportsEdgeClimbing: fullDesktopPositioning,
    supportsPerching: fullDesktopPositioning,
    supportsAutostart: true,
    supportsTray: true,
    supportsNotifications: true
  };
};

export const DEFAULT_PLATFORM_CAPABILITIES =
  detectPlatformCapabilities("win32");

const BOOLEAN_CAPABILITIES: readonly (keyof PlatformCapabilities)[] = [
  "supportsAbsoluteWindowPosition",
  "supportsProgrammaticWindowMove",
  "supportsAlwaysOnTop",
  "supportsCursorScreenPosition",
  "supportsEdgeClimbing",
  "supportsPerching",
  "supportsAutostart",
  "supportsTray",
  "supportsNotifications"
];

export const isPlatformCapabilities = (
  value: unknown
): value is PlatformCapabilities => {
  if (typeof value !== "object" || value === null) return false;
  const capabilities = value as Partial<PlatformCapabilities>;
  return (
    (capabilities.platform === "windows" || capabilities.platform === "linux") &&
    ["win32", "x11", "xwayland", "wayland", "unknown"].includes(
      capabilities.displayServer ?? ""
    ) &&
    BOOLEAN_CAPABILITIES.every(
      (key) => typeof capabilities[key] === "boolean"
    )
  );
};

export interface MovementCapabilityPolicy {
  readonly groundMovementAllowed: boolean;
  readonly gravityMovementAllowed: boolean;
  readonly jumpAllowed: boolean;
  readonly hopAllowed: boolean;
  readonly edgeClimbAllowed: boolean;
  readonly perchAllowed: boolean;
  readonly cursorScreenPositionAllowed: boolean;
  readonly cursorChaseAllowed: boolean;
  readonly movingRareEventsAllowed: boolean;
  readonly localRareEventsAllowed: boolean;
  readonly resetPositionAllowed: boolean;
}

export const resolveMovementCapabilityPolicy = (
  capabilities: PlatformCapabilities,
  settings: ThukunaSettings
): MovementCapabilityPolicy => {
  const lowPower = settings.lowPowerMode;
  const autonomous = settings.autonomyEnabled;
  const canMove = capabilities.supportsProgrammaticWindowMove;
  const cursorAvailable = capabilities.supportsCursorScreenPosition;
  return {
    groundMovementAllowed: canMove && autonomous,
    gravityMovementAllowed: canMove,
    jumpAllowed: canMove && autonomous && !lowPower,
    hopAllowed: canMove && autonomous && !lowPower,
    edgeClimbAllowed:
      canMove && capabilities.supportsEdgeClimbing && autonomous && !lowPower,
    perchAllowed:
      canMove && capabilities.supportsPerching && autonomous && !lowPower,
    cursorScreenPositionAllowed:
      cursorAvailable && settings.mouseAwarenessEnabled && !lowPower,
    cursorChaseAllowed:
      canMove && cursorAvailable && settings.mouseAwarenessEnabled &&
      autonomous && !lowPower,
    movingRareEventsAllowed:
      canMove && settings.rareEventsEnabled && autonomous && !lowPower,
    localRareEventsAllowed:
      settings.rareEventsEnabled && autonomous && !lowPower,
    resetPositionAllowed:
      capabilities.supportsAbsoluteWindowPosition &&
      capabilities.supportsProgrammaticWindowMove
  };
};
