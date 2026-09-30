import type { DevCommandController, DevCommandTelemetry } from "./DevCommandController";
import { getDevPanelCommands } from "./devCommandRegistry";
import type { SystemAwarenessControllerSnapshot } from "../engine/SystemAwarenessController";
import { formatSystemAwarenessDiagnostics } from "./SystemAwarenessDiagnostics";
import type { ProductivityTimerSnapshot } from "../../shared/productivityTimer";
import { formatProductivityTimerDiagnostics } from "./ProductivityTimerDiagnostics";

export interface DevCommandPanel {
  readonly element: HTMLElement;
  setVisible(visible: boolean): void;
  update(telemetry: DevCommandTelemetry): void;
  updateSystemAwareness(
    behaviorState: string | null,
    snapshot: SystemAwarenessControllerSnapshot
  ): void;
  updateProductivityTimer(snapshot: ProductivityTimerSnapshot): void;
  destroy(): void;
}

export interface DevTimerActions {
  startFiveSecondTimer(): void;
  startTenSecondTimer(): void;
}

export const createDevCommandPanel = (
  mount: HTMLElement,
  controller: DevCommandController,
  timerActions?: DevTimerActions
): DevCommandPanel => {
  const panel = document.createElement("section");
  panel.className = "dev-command-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "THUKUNA diagnostics and development commands");

  const awareness = document.createElement("output");
  awareness.className = "dev-command-panel__awareness";
  awareness.setAttribute("aria-live", "polite");
  awareness.textContent = "SYSTEM AWARENESS\nWaiting for current state...";
  panel.append(awareness);

  const timer = document.createElement("output");
  timer.className = "dev-command-panel__timer";
  timer.setAttribute("aria-live", "polite");
  timer.textContent = "PRODUCTIVITY TIMER\nWaiting for current state...";
  panel.append(timer);
  const cleanups: Array<() => void> = [];

  if (timerActions !== undefined) {
    const timerGrid = document.createElement("div");
    timerGrid.className = "dev-command-panel__timer-grid";
    const timerButtons = [
      ["Timer 5s", timerActions.startFiveSecondTimer],
      ["Timer 10s", timerActions.startTenSecondTimer]
    ] as const;
    for (const [label, action] of timerButtons) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "dev-command-panel__button";
      button.textContent = label;
      button.addEventListener("click", action);
      cleanups.push(() => button.removeEventListener("click", action));
      timerGrid.append(button);
    }
    panel.append(timerGrid);
  }

  const heading = document.createElement("strong");
  heading.className = "dev-command-panel__heading";
  heading.textContent = "DEV COMMANDS";
  panel.append(heading);

  const status = document.createElement("output");
  status.className = "dev-command-panel__status";
  status.textContent = "Select a command";
  panel.append(status);

  const grid = document.createElement("div");
  grid.className = "dev-command-panel__grid";
  for (const command of getDevPanelCommands()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dev-command-panel__button";
    button.dataset.commandId = command.id;
    button.title = `${command.label} (${command.expectedResult})`;
    button.textContent = command.label;
    const listener = (): void => {
      void controller.handlePanelCommand(command.id);
    };
    button.addEventListener("click", listener);
    cleanups.push(() => button.removeEventListener("click", listener));
    grid.append(button);
  }
  panel.append(grid);
  mount.append(panel);

  return {
    element: panel,
    setVisible: (visible) => { panel.hidden = !visible; },
    update: (telemetry) => {
      const result = telemetry.result;
      if (result === null) return;
      status.textContent = [
        `${result.label}: ${result.accepted ? "ACCEPTED" : "REJECTED"}`,
        `REASON ${result.reason} · DEV OVERRIDE ${result.devOverride ? "YES" : "NO"}`,
        `REQ ${result.requestedState ?? "--"}/${result.requestedAnimation ?? "--"}`,
        `NOW ${result.actualState ?? "--"}/${result.actualAnimation ?? "--"}`
      ].join("\n");
    },
    updateSystemAwareness: (behaviorState, snapshot) => {
      const text = formatSystemAwarenessDiagnostics(behaviorState, snapshot);
      if (awareness.textContent !== text) awareness.textContent = text;
    },
    updateProductivityTimer: (snapshot) => {
      const text = formatProductivityTimerDiagnostics(snapshot);
      if (timer.textContent !== text) timer.textContent = text;
    },
    destroy: () => {
      for (const cleanup of cleanups) cleanup();
      panel.remove();
    }
  };
};
