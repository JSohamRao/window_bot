import { contextBridge, ipcRenderer } from "electron";
import {
  IPC_CHANNELS,
  type AutonomousMoveRequest,
  type CursorPositionResult,
  type ScreenPoint,
  type WindowMoveResult,
  type WindowPositionResult
} from "../shared/ipcChannels";
import {
  isSettingUpdateRequest,
  sanitizeThukunaSettings,
  type SettingUpdateRequest,
  type ThukunaSettings
} from "../shared/settings";
import {
  isPlatformCapabilities,
  type PlatformCapabilities
} from "../shared/platform";
import {
  isSystemAwarenessSnapshot,
  type SystemAwarenessSnapshot
} from "../shared/systemAwareness";
import {
  isProductivityTimerCommandResult,
  isProductivityTimerSnapshot,
  isProductivityTimerStartRequest,
  type ProductivityTimerCommandResult,
  type ProductivityTimerSnapshot,
  type ProductivityTimerStartRequest
} from "../shared/productivityTimer";

const validatedTimerResult = async (
  promise: Promise<unknown>
): Promise<ProductivityTimerCommandResult> => {
  const result = await promise;
  if (!isProductivityTimerCommandResult(result)) {
    throw new Error("Invalid productivity-timer command response.");
  }
  return result;
};

const isCursorPositionResult = (
  value: unknown
): value is CursorPositionResult => {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const result = value as Partial<CursorPositionResult>;
  return (
    typeof result.x === "number" &&
    Number.isFinite(result.x) &&
    typeof result.y === "number" &&
    Number.isFinite(result.y) &&
    typeof result.sameDisplay === "boolean" &&
    (result.supported === undefined || typeof result.supported === "boolean")
  );
};

contextBridge.exposeInMainWorld("thukunaWindow", {
  startDrag: (point: ScreenPoint): void => {
    ipcRenderer.send(IPC_CHANNELS.dragStart, point);
  },
  moveDrag: (point: ScreenPoint): void => {
    ipcRenderer.send(IPC_CHANNELS.dragMove, point);
  },
  endDrag: (): void => {
    ipcRenderer.send(IPC_CHANNELS.dragEnd);
  },
  moveBy: (deltaX: number, deltaY = 0): Promise<WindowMoveResult> => {
    const request: AutonomousMoveRequest = { deltaX, deltaY };
    return ipcRenderer.invoke(IPC_CHANNELS.autonomousMove, request);
  },
  getPosition: (): Promise<WindowPositionResult> => {
    return ipcRenderer.invoke(IPC_CHANNELS.windowPosition);
  },
  getCursorPosition: async (): Promise<CursorPositionResult> => {
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.cursorPosition);
    if (!isCursorPositionResult(result)) {
      throw new Error("Invalid cursor position response.");
    }
    return result;
  },
  getPlatformCapabilities: async (): Promise<PlatformCapabilities> => {
    const result: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.platformCapabilities
    );
    if (!isPlatformCapabilities(result)) {
      throw new Error("Invalid platform-capabilities response.");
    }
    return result;
  },
  getSettings: async (): Promise<ThukunaSettings> => {
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.settingsGet);
    return sanitizeThukunaSettings(result);
  },
  updateSetting: async (
    key: SettingUpdateRequest["key"],
    value: boolean
  ): Promise<ThukunaSettings> => {
    const request: SettingUpdateRequest = { key, value };
    if (!isSettingUpdateRequest(request)) throw new TypeError("Invalid setting update.");
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, request);
    return sanitizeThukunaSettings(result);
  },
  resetPosition: async (): Promise<boolean> => {
    const result: unknown = await ipcRenderer.invoke(IPC_CHANNELS.resetPositionRequest);
    return result === true;
  },
  getSystemAwareness: async (): Promise<SystemAwarenessSnapshot> => {
    const result: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.systemAwarenessGet
    );
    if (!isSystemAwarenessSnapshot(result)) {
      throw new Error("Invalid system-awareness response.");
    }
    return result;
  },
  onSystemAwarenessChanged: (
    listener: (snapshot: SystemAwarenessSnapshot) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown): void => {
      if (isSystemAwarenessSnapshot(value)) listener(value);
    };
    ipcRenderer.on(IPC_CHANNELS.systemAwarenessChanged, handler);
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.systemAwarenessChanged, handler);
  },
  getProductivityTimer: async (): Promise<ProductivityTimerSnapshot> => {
    const result: unknown = await ipcRenderer.invoke(
      IPC_CHANNELS.productivityTimerGet
    );
    if (!isProductivityTimerSnapshot(result)) {
      throw new Error("Invalid productivity-timer response.");
    }
    return result;
  },
  startProductivityTimer: (
    request: ProductivityTimerStartRequest
  ): Promise<ProductivityTimerCommandResult> => {
    if (!isProductivityTimerStartRequest(request, true)) {
      throw new TypeError("Invalid productivity-timer start request.");
    }
    return validatedTimerResult(
      ipcRenderer.invoke(IPC_CHANNELS.productivityTimerStart, request)
    );
  },
  pauseProductivityTimer: (): Promise<ProductivityTimerCommandResult> =>
    validatedTimerResult(ipcRenderer.invoke(IPC_CHANNELS.productivityTimerPause)),
  resumeProductivityTimer: (): Promise<ProductivityTimerCommandResult> =>
    validatedTimerResult(ipcRenderer.invoke(IPC_CHANNELS.productivityTimerResume)),
  cancelProductivityTimer: (): Promise<ProductivityTimerCommandResult> =>
    validatedTimerResult(ipcRenderer.invoke(IPC_CHANNELS.productivityTimerCancel)),
  acknowledgeProductivityTimerCompletion: (
    completionId: string
  ): Promise<ProductivityTimerCommandResult> => {
    if (completionId.length === 0 || completionId.length > 128) {
      throw new TypeError("Invalid productivity-timer completion ID.");
    }
    return validatedTimerResult(
      ipcRenderer.invoke(IPC_CHANNELS.productivityTimerAcknowledge, completionId)
    );
  },
  onProductivityTimerChanged: (
    listener: (snapshot: ProductivityTimerSnapshot) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown): void => {
      if (isProductivityTimerSnapshot(value)) listener(value);
    };
    ipcRenderer.on(IPC_CHANNELS.productivityTimerChanged, handler);
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.productivityTimerChanged, handler);
  },
  onSettingsChanged: (listener: (settings: ThukunaSettings) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, value: unknown): void => {
      listener(sanitizeThukunaSettings(value));
    };
    ipcRenderer.on(IPC_CHANNELS.settingsChanged, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.settingsChanged, handler);
  },
  onVisibilityChanged: (listener: (visible: boolean) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, visible: unknown): void => {
      if (typeof visible === "boolean") listener(visible);
    };
    ipcRenderer.on(IPC_CHANNELS.visibilityChanged, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.visibilityChanged, handler);
  },
  onResetPositionRequested: (listener: () => void): (() => void) => {
    const handler = (): void => listener();
    ipcRenderer.on(IPC_CHANNELS.resetPosition, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.resetPosition, handler);
  }
});
