export type ProductivityTimerState =
  | "idle"
  | "running"
  | "paused"
  | "completed";

export type ProductivityTimerKind =
  | "countdown"
  | "focus"
  | "short-break"
  | "long-break";

export type ProductivityTimerPresetId =
  | "countdown-5"
  | "countdown-10"
  | "focus-25"
  | "short-break-5"
  | "long-break-15"
  | "development-5-seconds"
  | "development-10-seconds";

export interface ProductivityTimerStartRequest {
  readonly kind: ProductivityTimerKind;
  readonly durationMs: number;
  readonly label: string | null;
}

export interface ProductivityTimerSnapshot {
  readonly state: ProductivityTimerState;
  readonly durationMs: number;
  readonly remainingMs: number;
  readonly startedAt: number | null;
  readonly deadlineAt: number | null;
  readonly pausedAt: number | null;
  readonly completedAt: number | null;
  readonly kind: ProductivityTimerKind | null;
  readonly label: string | null;
  readonly timerId: string | null;
  readonly completionId: string | null;
  readonly completionPending: boolean;
  readonly schedulerActive: boolean;
  readonly updatedAt: number;
}

export type ProductivityTimerCommandReason =
  | "STARTED"
  | "PAUSED"
  | "RESUMED"
  | "CANCELLED"
  | "COMPLETION_ACKNOWLEDGED"
  | "ACTIVE_TIMER_EXISTS"
  | "INVALID_REQUEST"
  | "INVALID_STATE"
  | "COMPLETION_ID_MISMATCH";

export interface ProductivityTimerCommandResult {
  readonly accepted: boolean;
  readonly reason: ProductivityTimerCommandReason;
  readonly snapshot: ProductivityTimerSnapshot;
}

export interface ProductivityTimerPreset {
  readonly id: ProductivityTimerPresetId;
  readonly label: string;
  readonly request: ProductivityTimerStartRequest;
  readonly developmentOnly: boolean;
}

export const PRODUCTIVITY_TIMER_SCHEDULER_INTERVAL_MS = 1_000;
export const PRODUCTIVITY_TIMER_MIN_DURATION_MS = 60_000;
export const PRODUCTIVITY_TIMER_MAX_DURATION_MS = 180 * 60_000;
export const PRODUCTIVITY_TIMER_LABEL_MAX_LENGTH = 48;
export const PRODUCTIVITY_TIMER_DEVELOPMENT_DURATIONS_MS = [
  5_000,
  10_000
] as const;

export const PRODUCTIVITY_TIMER_PRESETS: Readonly<
  Record<ProductivityTimerPresetId, ProductivityTimerPreset>
> = {
  "countdown-5": {
    id: "countdown-5",
    label: "5 minutes",
    request: { kind: "countdown", durationMs: 5 * 60_000, label: "5 minute timer" },
    developmentOnly: false
  },
  "countdown-10": {
    id: "countdown-10",
    label: "10 minutes",
    request: { kind: "countdown", durationMs: 10 * 60_000, label: "10 minute timer" },
    developmentOnly: false
  },
  "focus-25": {
    id: "focus-25",
    label: "Focus — 25 minutes",
    request: { kind: "focus", durationMs: 25 * 60_000, label: "Focus" },
    developmentOnly: false
  },
  "short-break-5": {
    id: "short-break-5",
    label: "Short Break — 5 minutes",
    request: { kind: "short-break", durationMs: 5 * 60_000, label: "Short Break" },
    developmentOnly: false
  },
  "long-break-15": {
    id: "long-break-15",
    label: "Long Break — 15 minutes",
    request: { kind: "long-break", durationMs: 15 * 60_000, label: "Long Break" },
    developmentOnly: false
  },
  "development-5-seconds": {
    id: "development-5-seconds",
    label: "Test Timer — 5 seconds",
    request: { kind: "countdown", durationMs: 5_000, label: "5 second test" },
    developmentOnly: true
  },
  "development-10-seconds": {
    id: "development-10-seconds",
    label: "Test Timer — 10 seconds",
    request: { kind: "countdown", durationMs: 10_000, label: "10 second test" },
    developmentOnly: true
  }
};

export const PRODUCTIVITY_TIMER_USER_PRESET_IDS = [
  "focus-25",
  "short-break-5",
  "long-break-15",
  "countdown-5",
  "countdown-10"
] as const satisfies readonly ProductivityTimerPresetId[];

export const PRODUCTIVITY_TIMER_DEVELOPMENT_PRESET_IDS = [
  "development-5-seconds",
  "development-10-seconds"
] as const satisfies readonly ProductivityTimerPresetId[];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isFiniteTimestamp = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

export const isProductivityTimerKind = (
  value: unknown
): value is ProductivityTimerKind =>
  value === "countdown" ||
  value === "focus" ||
  value === "short-break" ||
  value === "long-break";

const isTimerLabel = (value: unknown): value is string | null =>
  value === null ||
  (typeof value === "string" &&
    value.length > 0 &&
    value.length <= PRODUCTIVITY_TIMER_LABEL_MAX_LENGTH &&
    value.trim() === value);

const isTimerIdentity = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 128;

export const isProductivityTimerStartRequest = (
  value: unknown,
  allowDevelopmentDurations = false
): value is ProductivityTimerStartRequest => {
  if (!isObject(value)) return false;
  const duration = value.durationMs;
  const normalDuration =
    typeof duration === "number" &&
    Number.isInteger(duration) &&
    duration >= PRODUCTIVITY_TIMER_MIN_DURATION_MS &&
    duration <= PRODUCTIVITY_TIMER_MAX_DURATION_MS;
  const developmentDuration =
    allowDevelopmentDurations &&
    typeof duration === "number" &&
    PRODUCTIVITY_TIMER_DEVELOPMENT_DURATIONS_MS.includes(
      duration as (typeof PRODUCTIVITY_TIMER_DEVELOPMENT_DURATIONS_MS)[number]
    );
  return (
    isProductivityTimerKind(value.kind) &&
    (normalDuration || developmentDuration) &&
    isTimerLabel(value.label)
  );
};

export const createIdleProductivityTimerSnapshot = (
  updatedAt = 0
): ProductivityTimerSnapshot => ({
  state: "idle",
  durationMs: 0,
  remainingMs: 0,
  startedAt: null,
  deadlineAt: null,
  pausedAt: null,
  completedAt: null,
  kind: null,
  label: null,
  timerId: null,
  completionId: null,
  completionPending: false,
  schedulerActive: false,
  updatedAt
});

export const copyProductivityTimerSnapshot = (
  snapshot: ProductivityTimerSnapshot
): ProductivityTimerSnapshot => ({ ...snapshot });

export const isProductivityTimerSnapshot = (
  value: unknown
): value is ProductivityTimerSnapshot => {
  if (!isObject(value)) return false;
  const common =
    (value.state === "idle" ||
      value.state === "running" ||
      value.state === "paused" ||
      value.state === "completed") &&
    typeof value.durationMs === "number" &&
    Number.isFinite(value.durationMs) &&
    value.durationMs >= 0 &&
    typeof value.remainingMs === "number" &&
    Number.isFinite(value.remainingMs) &&
    value.remainingMs >= 0 &&
    value.remainingMs <= value.durationMs &&
    (value.startedAt === null || isFiniteTimestamp(value.startedAt)) &&
    (value.deadlineAt === null || isFiniteTimestamp(value.deadlineAt)) &&
    (value.pausedAt === null || isFiniteTimestamp(value.pausedAt)) &&
    (value.completedAt === null || isFiniteTimestamp(value.completedAt)) &&
    (value.kind === null || isProductivityTimerKind(value.kind)) &&
    isTimerLabel(value.label) &&
    (value.timerId === null || isTimerIdentity(value.timerId)) &&
    (value.completionId === null || isTimerIdentity(value.completionId)) &&
    typeof value.completionPending === "boolean" &&
    typeof value.schedulerActive === "boolean" &&
    isFiniteTimestamp(value.updatedAt);
  if (!common) return false;

  if (value.state === "idle") {
    return value.durationMs === 0 &&
      value.remainingMs === 0 &&
      value.startedAt === null &&
      value.deadlineAt === null &&
      value.pausedAt === null &&
      value.completedAt === null &&
      value.kind === null &&
      value.label === null &&
      value.timerId === null &&
      value.completionId === null &&
      !value.completionPending &&
      !value.schedulerActive;
  }
  if (
    (value.durationMs as number) <= 0 ||
    value.kind === null ||
    value.timerId === null ||
    value.startedAt === null
  ) return false;
  if (value.state === "running") {
    return value.deadlineAt !== null &&
      value.pausedAt === null &&
      value.completedAt === null &&
      value.completionId === null &&
      !value.completionPending;
  }
  if (value.state === "paused") {
    return value.deadlineAt === null &&
      value.pausedAt !== null &&
      value.completedAt === null &&
      value.completionId === null &&
      !value.completionPending &&
      !value.schedulerActive;
  }
  return value.remainingMs === 0 &&
    value.deadlineAt === null &&
    value.pausedAt === null &&
    value.completedAt !== null &&
    value.completionId === value.timerId &&
    !value.schedulerActive;
};

export const isProductivityTimerCommandResult = (
  value: unknown
): value is ProductivityTimerCommandResult => {
  if (!isObject(value)) return false;
  const reasons: readonly ProductivityTimerCommandReason[] = [
    "STARTED",
    "PAUSED",
    "RESUMED",
    "CANCELLED",
    "COMPLETION_ACKNOWLEDGED",
    "ACTIVE_TIMER_EXISTS",
    "INVALID_REQUEST",
    "INVALID_STATE",
    "COMPLETION_ID_MISMATCH"
  ];
  return typeof value.accepted === "boolean" &&
    reasons.includes(value.reason as ProductivityTimerCommandReason) &&
    isProductivityTimerSnapshot(value.snapshot);
};

export const requestForProductivityTimerPreset = (
  presetId: ProductivityTimerPresetId
): ProductivityTimerStartRequest => ({
  ...PRODUCTIVITY_TIMER_PRESETS[presetId].request
});

export const formatProductivityTimerRemaining = (
  remainingMs: number
): string => {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
};
