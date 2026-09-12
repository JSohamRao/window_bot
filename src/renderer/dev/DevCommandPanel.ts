import type { DevCommandController, DevCommandTelemetry } from "./DevCommandController";
import { getDevPanelCommands } from "./devCommandRegistry";

export interface DevCommandPanel {
  readonly element: HTMLElement;
  setVisible(visible: boolean): void;
  update(telemetry: DevCommandTelemetry): void;
  destroy(): void;
}

export const createDevCommandPanel = (
  mount: HTMLElement,
  controller: DevCommandController
): DevCommandPanel => {
  const panel = document.createElement("section");
  panel.className = "dev-command-panel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "THUKUNA development commands");

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
  const cleanups: Array<() => void> = [];
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
    destroy: () => {
      for (const cleanup of cleanups) cleanup();
      panel.remove();
    }
  };
};
