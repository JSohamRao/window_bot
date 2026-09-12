import { powerMonitor, screen } from "electron";
import type {
  SystemAwarenessEvent,
  SystemAwarenessProvider
} from "./SystemAwarenessService";

const WINDOWS_CAPABILITIES = {
  idleAwareness: true,
  sessionEvents: true,
  suspendResume: true,
  powerSource: true,
  displayEvents: true
} as const;

const UNSUPPORTED_CAPABILITIES = {
  idleAwareness: false,
  sessionEvents: false,
  suspendResume: false,
  powerSource: false,
  displayEvents: false
} as const;

const displayEvents = new Set<SystemAwarenessEvent>([
  "display-added",
  "display-removed",
  "display-metrics-changed"
]);

export const createElectronSystemAwarenessProvider = (
  platform = process.platform
): SystemAwarenessProvider => {
  const supported = platform === "win32";
  return {
    capabilities: supported ? WINDOWS_CAPABILITIES : UNSUPPORTED_CAPABILITIES,
    getSystemIdleTime: () => supported ? powerMonitor.getSystemIdleTime() : 0,
    getPowerSource: () =>
      supported ? (powerMonitor.isOnBatteryPower() ? "battery" : "ac") : "unknown",
    subscribe: (event, listener) => {
      if (!supported) return () => undefined;
      if (displayEvents.has(event)) {
        screen.on(event as "display-added", listener);
        return () => screen.removeListener(event as "display-added", listener);
      }
      const monitor = powerMonitor as unknown as {
        on(name: string, callback: () => void): void;
        removeListener(name: string, callback: () => void): void;
      };
      monitor.on(event, listener);
      return () => monitor.removeListener(event, listener);
    }
  };
};
