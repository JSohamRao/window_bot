export type SystemSessionState = "active" | "locked" | "suspended";
export type SystemActivityState = "active" | "idle" | "unknown";
export type SystemPowerSource = "ac" | "battery" | "unknown";

export type SystemAwarenessTransitionKind =
  | "session"
  | "activity"
  | "power"
  | "display"
  | "refresh";

export interface SystemAwarenessCapabilities {
  readonly idleAwareness: boolean;
  readonly sessionEvents: boolean;
  readonly suspendResume: boolean;
  readonly powerSource: boolean;
  readonly displayEvents: boolean;
}

export interface SystemAwarenessTransition {
  readonly kind: SystemAwarenessTransitionKind;
  readonly from: string;
  readonly to: string;
  readonly at: number;
}

export interface SystemAwarenessSnapshot {
  readonly sessionState: SystemSessionState;
  readonly activityState: SystemActivityState;
  readonly powerSource: SystemPowerSource;
  readonly idleSeconds: number;
  readonly updatedAt: number;
  readonly capabilities: SystemAwarenessCapabilities;
  readonly lastTransition: SystemAwarenessTransition | null;
  readonly idleSamplerActive: boolean;
  readonly listenerCount: number;
}

export const SYSTEM_IDLE_THRESHOLD_SECONDS = 120;
export const SYSTEM_IDLE_SAMPLE_INTERVAL_MS = 15_000;
export const SYSTEM_AWARENESS_HISTORY_LIMIT = 20;

export const NO_SYSTEM_AWARENESS_CAPABILITIES: SystemAwarenessCapabilities = {
  idleAwareness: false,
  sessionEvents: false,
  suspendResume: false,
  powerSource: false,
  displayEvents: false
};

export const createUnknownSystemAwarenessSnapshot = (
  updatedAt = 0
): SystemAwarenessSnapshot => ({
  sessionState: "active",
  activityState: "unknown",
  powerSource: "unknown",
  idleSeconds: 0,
  updatedAt,
  capabilities: { ...NO_SYSTEM_AWARENESS_CAPABILITIES },
  lastTransition: null,
  idleSamplerActive: false,
  listenerCount: 0
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSessionState = (value: unknown): value is SystemSessionState =>
  value === "active" || value === "locked" || value === "suspended";

const isActivityState = (value: unknown): value is SystemActivityState =>
  value === "active" || value === "idle" || value === "unknown";

const isPowerSource = (value: unknown): value is SystemPowerSource =>
  value === "ac" || value === "battery" || value === "unknown";

const isTransitionKind = (
  value: unknown
): value is SystemAwarenessTransitionKind =>
  value === "session" ||
  value === "activity" ||
  value === "power" ||
  value === "display" ||
  value === "refresh";

const isCapabilities = (
  value: unknown
): value is SystemAwarenessCapabilities => {
  if (!isObject(value)) return false;
  return (
    typeof value.idleAwareness === "boolean" &&
    typeof value.sessionEvents === "boolean" &&
    typeof value.suspendResume === "boolean" &&
    typeof value.powerSource === "boolean" &&
    typeof value.displayEvents === "boolean"
  );
};

const isTransition = (
  value: unknown
): value is SystemAwarenessTransition => {
  if (!isObject(value)) return false;
  return (
    isTransitionKind(value.kind) &&
    typeof value.from === "string" &&
    typeof value.to === "string" &&
    typeof value.at === "number" &&
    Number.isFinite(value.at) &&
    value.at >= 0
  );
};

export const isSystemAwarenessSnapshot = (
  value: unknown
): value is SystemAwarenessSnapshot => {
  if (!isObject(value)) return false;
  return (
    isSessionState(value.sessionState) &&
    isActivityState(value.activityState) &&
    isPowerSource(value.powerSource) &&
    typeof value.idleSeconds === "number" &&
    Number.isFinite(value.idleSeconds) &&
    value.idleSeconds >= 0 &&
    typeof value.updatedAt === "number" &&
    Number.isFinite(value.updatedAt) &&
    value.updatedAt >= 0 &&
    isCapabilities(value.capabilities) &&
    (value.lastTransition === null || isTransition(value.lastTransition)) &&
    typeof value.idleSamplerActive === "boolean" &&
    typeof value.listenerCount === "number" &&
    Number.isInteger(value.listenerCount) &&
    value.listenerCount >= 0
  );
};

export const copySystemAwarenessSnapshot = (
  snapshot: SystemAwarenessSnapshot
): SystemAwarenessSnapshot => ({
  ...snapshot,
  capabilities: { ...snapshot.capabilities },
  lastTransition:
    snapshot.lastTransition === null ? null : { ...snapshot.lastTransition }
});
