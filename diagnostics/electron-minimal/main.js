const { app, BrowserWindow } = require("electron");

const log = (stage, detail = "") => {
  process.stdout.write(`[MINIMAL] ${stage}${detail ? ` ${detail}` : ""}\n`);
};

log("MAIN_MODULE");

app.on("child-process-gone", (_event, details) => {
  log(
    "CHILD_PROCESS_GONE",
    JSON.stringify({
      type: details.type,
      reason: details.reason,
      exitCode: details.exitCode,
      serviceName: details.serviceName ?? ""
    })
  );
});

app.whenReady().then(() => {
  log("APP_READY");
  const window = new BrowserWindow({ width: 320, height: 240 });
  log("BROWSER_WINDOW_CONSTRUCTED");
  window.webContents.on("render-process-gone", (_event, details) => {
    log(
      "RENDER_PROCESS_GONE",
      JSON.stringify({ reason: details.reason, exitCode: details.exitCode })
    );
  });
  window.webContents.on("did-fail-load", (_event, code, description) => {
    log("DID_FAIL_LOAD", `${code} ${description}`);
  });
  window.webContents.on("did-finish-load", () => {
    log("DID_FINISH_LOAD");
    app.quit();
  });
  window.once("ready-to-show", () => log("READY_TO_SHOW"));
  void window.loadFile("index.html");
}).catch((error) => {
  log("APP_READY_ERROR", error instanceof Error ? error.message : String(error));
  app.exit(1);
});

