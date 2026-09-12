import {
  DEV_COMMAND_REGISTRY,
  DEVELOPMENT_CONTROLS_ENABLED,
  findDevCommand,
  findDevCommandById,
  formatDevShortcut,
  formatObservedKey,
  type DevCommandDefinition,
  type DevCommandId,
  type DevKeyboardInput
} from "./devCommandRegistry";

export type DevCommandRejectionReason =
  | "NONE"
  | "KEY_REPEAT"
  | "NOT_STARTED"
  | "WINDOW_HIDDEN"
  | "AUTONOMY_PAUSED"
  | "LOW_POWER_BLOCKED"
  | "MOVEMENT_CAPABILITY_DISABLED"
  | "CURSOR_CAPABILITY_DISABLED"
  | "MOUSE_AWARENESS_DISABLED"
  | "RARE_EVENTS_DISABLED"
  | "CURRENT_STATE_BLOCKED"
  | "DRAG_ACTIVE"
  | "NOT_NEAR_EDGE"
  | "NOT_GROUNDED"
  | "NOT_ELEVATED"
  | "NOT_PERCHED"
  | "NOT_SLEEPING"
  | "RESET_UNAVAILABLE"
  | "ASSET_VALIDATION_FAILED"
  | "COMMAND_STALLED"
  | "EXECUTION_REJECTED"
  | "EXECUTION_ERROR";

export interface DevCommandExecution {
  readonly accepted: boolean;
  readonly reason: DevCommandRejectionReason;
  readonly detail?: string;
  readonly devOverride?: boolean;
  readonly trace?: readonly DevCommandTraceEntry[];
}

export type DevCommandSource = "KEYBOARD" | "PANEL";

export type DevCommandTraceStage =
  | "COMMAND_RECOGNIZED"
  | "RUNTIME_ENTERED"
  | "PRECONDITION_ACCEPTED"
  | "PRECONDITION_REJECTED"
  | "CLEANUP_STARTED"
  | "CLEANUP_FINISHED"
  | "CONTROLLER_REQUESTED"
  | "EVENT_FORCE_STARTED"
  | "STATE_ENTERED"
  | "ANIMATION_SELECTED"
  | "IMMEDIATE_VERIFICATION"
  | "EXECUTION_ERROR";

export interface DevCommandTraceEntry {
  readonly stage: DevCommandTraceStage;
  readonly detail?: string;
}

export interface DevCommandActualState {
  readonly state: string | null;
  readonly animation: string | null;
}

export interface DevCommandResult extends DevCommandExecution {
  readonly commandId: DevCommandId;
  readonly label: string;
  readonly shortcut: string;
  readonly requestedState: string | null;
  readonly actualState: string | null;
  readonly requestedAnimation: string | null;
  readonly actualAnimation: string | null;
  readonly source: DevCommandSource;
  readonly devOverride: boolean;
  readonly trace: readonly DevCommandTraceEntry[];
}

export interface DevCommandTelemetry {
  readonly enabled: boolean;
  readonly lastKey: string;
  readonly lastCommand: string;
  readonly lastSource: DevCommandSource | null;
  readonly result: DevCommandResult | null;
}

export interface DevCommandRuntime {
  execute(command: DevCommandDefinition): Promise<DevCommandExecution>;
  getActualState(): DevCommandActualState;
}

type TelemetryListener = (telemetry: DevCommandTelemetry) => void;

export class DevCommandController {
  private lastKey = "--";
  private lastCommand = "--";
  private lastSource: DevCommandSource | null = null;
  private result: DevCommandResult | null = null;

  public constructor(
    private readonly runtime: DevCommandRuntime,
    private readonly onTelemetry?: TelemetryListener,
    private readonly enabled = DEVELOPMENT_CONTROLS_ENABLED
  ) {}

  public async handleKey(input: DevKeyboardInput): Promise<DevCommandResult | null> {
    this.lastKey = formatObservedKey(input);
    const command = this.enabled ? findDevCommand(input) : null;
    if (command === null) {
      this.emit();
      return null;
    }
    input.preventDefault();
    return this.executeDefinition(command, "KEYBOARD", input.repeat);
  }

  public async handlePanelCommand(commandId: DevCommandId): Promise<DevCommandResult | null> {
    if (!this.enabled) return null;
    const command = findDevCommandById(commandId);
    if (command === null) return null;
    this.lastKey = "PANEL";
    return this.executeDefinition(command, "PANEL", false);
  }

  private async executeDefinition(
    command: DevCommandDefinition,
    source: DevCommandSource,
    repeated: boolean
  ): Promise<DevCommandResult> {
    this.lastCommand = command.label;
    this.lastSource = source;
    let execution: DevCommandExecution;
    if (repeated && command.oneShot) {
      execution = {
        accepted: false,
        reason: "KEY_REPEAT",
        trace: [{ stage: "COMMAND_RECOGNIZED", detail: source }]
      };
    } else {
      try {
        execution = await this.runtime.execute(command);
      } catch (error: unknown) {
        execution = {
          accepted: false,
          reason: "EXECUTION_ERROR",
          detail: error instanceof Error ? error.message : String(error),
          trace: [
            { stage: "COMMAND_RECOGNIZED", detail: source },
            { stage: "EXECUTION_ERROR", detail: error instanceof Error ? error.message : String(error) }
          ]
        };
      }
    }
    const actual = this.runtime.getActualState();
    if (
      execution.accepted &&
      command.requestedState !== undefined &&
      actual.state !== command.requestedState
    ) {
      execution = {
        ...execution,
        accepted: false,
        reason: "COMMAND_STALLED",
        detail: `Expected ${command.requestedState}; observed ${actual.state ?? "NONE"}.`,
        trace: [
          ...(execution.trace ?? []),
          {
            stage: "IMMEDIATE_VERIFICATION",
            detail: `COMMAND_STALLED:${actual.state ?? "NONE"}`
          }
        ]
      };
    }
    this.result = {
      ...execution,
      commandId: command.id,
      label: command.label,
      shortcut: formatDevShortcut(command.shortcut),
      requestedState: command.requestedState ?? null,
      actualState: actual.state,
      requestedAnimation: command.requestedAnimation ?? null,
      actualAnimation: actual.animation,
      source,
      devOverride: execution.devOverride === true,
      trace: [
        { stage: "COMMAND_RECOGNIZED", detail: source },
        ...(execution.trace ?? [])
      ]
    };
    this.emit();
    return this.result;
  }

  public getTelemetry(): DevCommandTelemetry {
    return {
      enabled: this.enabled,
      lastKey: this.lastKey,
      lastCommand: this.lastCommand,
      lastSource: this.lastSource,
      result: this.result
    };
  }

  private emit(): void {
    this.onTelemetry?.(this.getTelemetry());
  }
}
