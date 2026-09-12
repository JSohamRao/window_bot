export interface SingleInstanceApplication {
  requestSingleInstanceLock(): boolean;
  quit(): void;
  on(event: "second-instance", listener: () => void): unknown;
}

export const configureSingleInstance = (
  application: SingleInstanceApplication,
  onSecondInstance: () => void
): boolean => {
  if (!application.requestSingleInstanceLock()) {
    application.quit();
    return false;
  }

  application.on("second-instance", onSecondInstance);
  return true;
};
