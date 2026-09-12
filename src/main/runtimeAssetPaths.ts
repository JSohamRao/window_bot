import path from "node:path";

export const getTrayIconPath = (compiledMainDirectory: string): string =>
  path.resolve(compiledMainDirectory, "../assets/icons/tray.png");
