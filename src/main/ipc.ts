import {
  BrowserWindow,
  ipcMain,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from "electron";
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
  type SettingUpdateRequest,
  type ThukunaSettings
} from "../shared/settings";
import type { PlatformService } from "./platform/PlatformService";
import { PET_WINDOW_HEIGHT, PET_WINDOW_WIDTH } from "./petWindow";
import type { SystemAwarenessSnapshot } from "../shared/systemAwareness";
import {
  isProductivityTimerStartRequest,
  type ProductivityTimerCommandResult,
  type ProductivityTimerSnapshot,
  type ProductivityTimerStartRequest
} from "../shared/productivityTimer";

interface DragSession {
  windowId: number;
  offsetX: number;
  offsetY: number;
}

const isScreenPoint = (value: unknown): value is ScreenPoint => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const point = value as Partial<ScreenPoint>;
  return (
    typeof point.screenX === "number" &&
    Number.isFinite(point.screenX) &&
    typeof point.screenY === "number" &&
    Number.isFinite(point.screenY)
  );
};

const isAutonomousMoveRequest = (
  value: unknown
): value is AutonomousMoveRequest => {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const request = value as Partial<AutonomousMoveRequest>;
  return (
    typeof request.deltaX === "number" &&
    Number.isFinite(request.deltaX) &&
    Math.abs(request.deltaX) <= 100 &&
    typeof request.deltaY === "number" &&
    Number.isFinite(request.deltaY) &&
    Math.abs(request.deltaY) <= 100
  );
};

const getPetWindowForEvent = (
  event: IpcMainEvent | IpcMainInvokeEvent,
  getPetWindow: () => BrowserWindow | null
): BrowserWindow | null => {
  const petWindow = getPetWindow();
  const senderWindow = BrowserWindow.fromWebContents(event.sender);

  if (petWindow === null || senderWindow?.id !== petWindow.id) {
    return null;
  }

  return petWindow;
};

export const registerPetWindowIpc = (
  getPetWindow: () => BrowserWindow | null,
  platform: PlatformService,
  settings?: {
    get(): ThukunaSettings;
    update(request: SettingUpdateRequest): Promise<ThukunaSettings>;
  },
  systemAwareness?: {
    get(): SystemAwarenessSnapshot;
  },
  productivityTimer?: {
    readonly allowDevelopmentDurations: boolean;
    get(): ProductivityTimerSnapshot;
    start(request: ProductivityTimerStartRequest): Promise<ProductivityTimerCommandResult>;
    pause(): Promise<ProductivityTimerCommandResult>;
    resume(): Promise<ProductivityTimerCommandResult>;
    cancel(): Promise<ProductivityTimerCommandResult>;
    acknowledge(completionId: string): Promise<ProductivityTimerCommandResult>;
  }
): (() => void) => {
  let dragSession: DragSession | null = null;

  ipcMain.on(IPC_CHANNELS.dragStart, (event, point: unknown) => {
    const petWindow = getPetWindowForEvent(event, getPetWindow);
    if (
      petWindow === null ||
      !platform.capabilities.supportsProgrammaticWindowMove ||
      !isScreenPoint(point)
    ) {
      return;
    }

    const bounds = petWindow.getBounds();
    dragSession = {
      windowId: petWindow.id,
      offsetX: Math.min(Math.max(point.screenX - bounds.x, 0), PET_WINDOW_WIDTH),
      offsetY: Math.min(Math.max(point.screenY - bounds.y, 0), PET_WINDOW_HEIGHT)
    };
  });

  ipcMain.on(IPC_CHANNELS.dragMove, (event, point: unknown) => {
    const petWindow = getPetWindowForEvent(event, getPetWindow);
    if (
      petWindow === null ||
      dragSession === null ||
      dragSession.windowId !== petWindow.id ||
      !isScreenPoint(point)
    ) {
      return;
    }

    platform.moveWindowTo(
      petWindow,
      point.screenX - dragSession.offsetX,
      point.screenY - dragSession.offsetY
    );
  });

  ipcMain.on(IPC_CHANNELS.dragEnd, (event) => {
    const petWindow = getPetWindowForEvent(event, getPetWindow);
    if (petWindow?.id === dragSession?.windowId) {
      dragSession = null;
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.autonomousMove,
    (event, request: unknown): WindowMoveResult => {
      const petWindow = getPetWindowForEvent(event, getPetWindow);
      if (petWindow === null || !isAutonomousMoveRequest(request)) {
        throw new Error("Invalid autonomous window movement request.");
      }

      if (dragSession !== null) {
        const position = platform.getWindowPosition(petWindow);
        return {
          ...position,
          hitBoundary: false,
          hitBoundaryX: false,
          hitBoundaryY: false
        };
      }
      return platform.moveWindowBy(petWindow, request.deltaX, request.deltaY);
    }
  );

  ipcMain.handle(IPC_CHANNELS.windowPosition, (event): WindowPositionResult => {
    const petWindow = getPetWindowForEvent(event, getPetWindow);
    if (petWindow === null) {
      throw new Error("Invalid window position request.");
    }
    return platform.getWindowPosition(petWindow);
  });

  ipcMain.handle(IPC_CHANNELS.cursorPosition, (event): CursorPositionResult => {
    const petWindow = getPetWindowForEvent(event, getPetWindow);
    if (petWindow === null) {
      throw new Error("Invalid cursor position request.");
    }
    return platform.getCursorPosition(petWindow);
  });

  ipcMain.handle(IPC_CHANNELS.platformCapabilities, (event) => {
    if (getPetWindowForEvent(event, getPetWindow) === null) {
      throw new Error("Invalid platform-capabilities request.");
    }
    return platform.capabilities;
  });

  ipcMain.handle(IPC_CHANNELS.resetPositionRequest, (event): boolean => {
    const petWindow = getPetWindowForEvent(event, getPetWindow);
    if (
      petWindow === null ||
      !platform.capabilities.supportsAbsoluteWindowPosition ||
      !platform.capabilities.supportsProgrammaticWindowMove
    ) {
      return false;
    }
    const reset = platform.resetWindowPosition(petWindow);
    if (reset) event.sender.send(IPC_CHANNELS.resetPosition);
    return reset;
  });

  if (settings !== undefined) {
    ipcMain.handle(IPC_CHANNELS.settingsGet, (event): ThukunaSettings => {
      if (getPetWindowForEvent(event, getPetWindow) === null) {
        throw new Error("Invalid settings request.");
      }
      return settings.get();
    });
    ipcMain.handle(
      IPC_CHANNELS.settingsUpdate,
      async (event, request: unknown): Promise<ThukunaSettings> => {
        if (
          getPetWindowForEvent(event, getPetWindow) === null ||
          !isSettingUpdateRequest(request)
        ) {
          throw new Error("Invalid settings update request.");
        }
        return settings.update(request);
      }
    );
  }

  if (systemAwareness !== undefined) {
    ipcMain.handle(
      IPC_CHANNELS.systemAwarenessGet,
      (event): SystemAwarenessSnapshot => {
        if (getPetWindowForEvent(event, getPetWindow) === null) {
          throw new Error("Invalid system-awareness request.");
        }
        return systemAwareness.get();
      }
    );
  }

  if (productivityTimer !== undefined) {
    ipcMain.handle(
      IPC_CHANNELS.productivityTimerGet,
      (event): ProductivityTimerSnapshot => {
        if (getPetWindowForEvent(event, getPetWindow) === null) {
          throw new Error("Invalid productivity-timer request.");
        }
        return productivityTimer.get();
      }
    );
    ipcMain.handle(
      IPC_CHANNELS.productivityTimerStart,
      async (event, request: unknown): Promise<ProductivityTimerCommandResult> => {
        if (
          getPetWindowForEvent(event, getPetWindow) === null ||
          !isProductivityTimerStartRequest(
            request,
            productivityTimer.allowDevelopmentDurations
          )
        ) throw new Error("Invalid productivity-timer start request.");
        return productivityTimer.start(request);
      }
    );
    ipcMain.handle(
      IPC_CHANNELS.productivityTimerPause,
      async (event): Promise<ProductivityTimerCommandResult> => {
        if (getPetWindowForEvent(event, getPetWindow) === null) {
          throw new Error("Invalid productivity-timer pause request.");
        }
        return productivityTimer.pause();
      }
    );
    ipcMain.handle(
      IPC_CHANNELS.productivityTimerResume,
      async (event): Promise<ProductivityTimerCommandResult> => {
        if (getPetWindowForEvent(event, getPetWindow) === null) {
          throw new Error("Invalid productivity-timer resume request.");
        }
        return productivityTimer.resume();
      }
    );
    ipcMain.handle(
      IPC_CHANNELS.productivityTimerCancel,
      async (event): Promise<ProductivityTimerCommandResult> => {
        if (getPetWindowForEvent(event, getPetWindow) === null) {
          throw new Error("Invalid productivity-timer cancel request.");
        }
        return productivityTimer.cancel();
      }
    );
    ipcMain.handle(
      IPC_CHANNELS.productivityTimerAcknowledge,
      async (event, completionId: unknown): Promise<ProductivityTimerCommandResult> => {
        if (
          getPetWindowForEvent(event, getPetWindow) === null ||
          typeof completionId !== "string" ||
          completionId.length === 0 ||
          completionId.length > 128
        ) throw new Error("Invalid productivity-timer completion acknowledgement.");
        return productivityTimer.acknowledge(completionId);
      }
    );
  }

  return () => {
    if (systemAwareness !== undefined) {
      ipcMain.removeHandler(IPC_CHANNELS.systemAwarenessGet);
    }
    if (productivityTimer !== undefined) {
      ipcMain.removeHandler(IPC_CHANNELS.productivityTimerGet);
      ipcMain.removeHandler(IPC_CHANNELS.productivityTimerStart);
      ipcMain.removeHandler(IPC_CHANNELS.productivityTimerPause);
      ipcMain.removeHandler(IPC_CHANNELS.productivityTimerResume);
      ipcMain.removeHandler(IPC_CHANNELS.productivityTimerCancel);
      ipcMain.removeHandler(IPC_CHANNELS.productivityTimerAcknowledge);
    }
  };
};
