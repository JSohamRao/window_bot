import path from "node:path";

const desktopExec = (value: string): string =>
  `"${value.replace(/[\\"`$]/g, "\\$&").replace(/[\r\n]/g, "")}"`;

export const getLinuxAutostartPath = (configurationPath: string): string =>
  path.join(configurationPath, "autostart", "thukuna.desktop");

export const createLinuxAutostartEntry = (
  executablePath: string,
  args: readonly string[] = []
): string =>
  [
    "[Desktop Entry]",
    "Type=Application",
    "Name=THUKUNA",
    `Exec=${[executablePath, ...args].map(desktopExec).join(" ")}`,
    "Terminal=false",
    "X-GNOME-Autostart-enabled=true",
    ""
  ].join("\n");
