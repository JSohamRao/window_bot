export interface ThukunaSettings {
  readonly dialogueEnabled: boolean;
  readonly mouseAwarenessEnabled: boolean;
  readonly rareEventsEnabled: boolean;
  readonly chaosMode: boolean;
  readonly lowPowerMode: boolean;
  readonly alwaysOnTop: boolean;
  readonly autonomyEnabled: boolean;
  readonly launchOnStartup: boolean;
}

export type ThukunaSettingKey = keyof ThukunaSettings;

export interface SettingUpdateRequest {
  readonly key: ThukunaSettingKey;
  readonly value: boolean;
}

type MutableThukunaSettings = {
  -readonly [Key in keyof ThukunaSettings]: ThukunaSettings[Key];
};

export const THUKUNA_SETTING_KEYS: readonly ThukunaSettingKey[] = [
  "dialogueEnabled",
  "mouseAwarenessEnabled",
  "rareEventsEnabled",
  "chaosMode",
  "lowPowerMode",
  "alwaysOnTop",
  "autonomyEnabled",
  "launchOnStartup"
];

export const DEFAULT_THUKUNA_SETTINGS: ThukunaSettings = {
  dialogueEnabled: true,
  mouseAwarenessEnabled: true,
  rareEventsEnabled: true,
  chaosMode: false,
  lowPowerMode: false,
  alwaysOnTop: true,
  autonomyEnabled: true,
  launchOnStartup: false
};

export const isThukunaSettingKey = (
  value: unknown
): value is ThukunaSettingKey =>
  typeof value === "string" &&
  THUKUNA_SETTING_KEYS.includes(value as ThukunaSettingKey);

export const isSettingUpdateRequest = (
  value: unknown
): value is SettingUpdateRequest => {
  if (typeof value !== "object" || value === null) return false;
  const request = value as Partial<SettingUpdateRequest>;
  return isThukunaSettingKey(request.key) && typeof request.value === "boolean";
};

export const sanitizeThukunaSettings = (value: unknown): ThukunaSettings => {
  const source = typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {};
  const settings: MutableThukunaSettings = { ...DEFAULT_THUKUNA_SETTINGS };
  for (const key of THUKUNA_SETTING_KEYS) {
    if (typeof source[key] === "boolean") settings[key] = source[key];
  }
  if (settings.lowPowerMode && settings.chaosMode) settings.chaosMode = false;
  return settings;
};

export const applySettingsPatch = (
  current: ThukunaSettings,
  patch: Partial<ThukunaSettings>
): ThukunaSettings => {
  const source: MutableThukunaSettings = { ...current, ...patch };
  if (patch.lowPowerMode === true) source.chaosMode = false;
  if (patch.chaosMode === true) source.lowPowerMode = false;
  return sanitizeThukunaSettings(source);
};

export const settingsEqual = (
  left: ThukunaSettings,
  right: ThukunaSettings
): boolean => THUKUNA_SETTING_KEYS.every((key) => left[key] === right[key]);
