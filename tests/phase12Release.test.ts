import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { developmentControlsEnabledFor } from "../src/renderer/dev/developmentControlsPolicy";
import { configureSingleInstance } from "../src/main/singleInstance";
import { createWindowsLoginItemSettings } from "../src/main/platform/windowsLoginItem";
import { getTrayIconPath } from "../src/main/runtimeAssetPaths";

const projectRoot = path.resolve(__dirname, "../..");

test("production disables development controls while development retains them", () => {
  assert.equal(developmentControlsEnabledFor(true), false);
  assert.equal(developmentControlsEnabledFor(false), true);
});

test("secondary launches quit without registering another lifecycle", () => {
  let quitCount = 0;
  let registrationCount = 0;
  const primary = configureSingleInstance({
    requestSingleInstanceLock: () => false,
    quit: () => { quitCount += 1; },
    on: () => { registrationCount += 1; }
  }, () => undefined);
  assert.equal(primary, false);
  assert.equal(quitCount, 1);
  assert.equal(registrationCount, 0);
});

test("primary launch registers one second-instance handler", () => {
  let registrationCount = 0;
  let observedEvent = "";
  const primary = configureSingleInstance({
    requestSingleInstanceLock: () => true,
    quit: () => assert.fail("primary instance must not quit"),
    on: (event) => { observedEvent = event; registrationCount += 1; }
  }, () => undefined);
  assert.equal(primary, true);
  assert.equal(registrationCount, 1);
  assert.equal(observedEvent, "second-instance");
});

test("packaged Windows startup points directly at the installed executable", () => {
  const executable = path.join("C:\\", "Users", "tester", "THUKUNA.exe");
  const settings = createWindowsLoginItemSettings({
    isPackaged: true,
    getPath: () => executable,
    getAppPath: () => path.join("C:\\", "src", "thukuna")
  }, true);
  assert.equal(settings.openAtLogin, true);
  assert.equal(settings.path, path.resolve(executable));
  assert.deepEqual(settings.args, []);
});

test("runtime tray icon resolves inside the packaged asset layout", () => {
  const mainDirectory = path.join("C:\\", "Program Files", "THUKUNA", "resources", "app.asar", "dist", "main");
  assert.equal(
    getTrayIconPath(mainDirectory),
    path.resolve(mainDirectory, "../assets/icons/tray.png")
  );
});

test("release configuration is explicit and excludes development artifacts", () => {
  const manifest = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
  assert.equal(manifest.version, "0.1.0");
  assert.equal(manifest.build.asar, true);
  assert.equal(manifest.build.appId, "com.thukuna.desktoppet");
  assert.equal(manifest.build.productName, "THUKUNA");
  assert.equal(manifest.build.win.target[0].arch[0], "x64");
  assert.ok(manifest.build.files.includes("!dist/tests/**/*"));
  assert.ok(manifest.build.files.includes("!dist/**/*.map"));
  assert.equal(manifest.build.nsis.deleteAppDataOnUninstall, false);
});

test("release icons exist and canonical production library remains 116 PNGs", () => {
  assert.equal(existsSync(path.join(projectRoot, "assets", "icons", "thukuna.ico")), true);
  assert.equal(existsSync(path.join(projectRoot, "assets", "icons", "tray.png")), true);
  const animationRoot = path.join(projectRoot, "assets", "thukuna", "animations");
  const countPngs = (directory: string): number => readdirSync(directory, { withFileTypes: true })
    .reduce((count, entry) => count + (entry.isDirectory()
      ? countPngs(path.join(directory, entry.name))
      : entry.name.endsWith(".png") ? 1 : 0), 0);
  assert.equal(countPngs(animationRoot), 116);
});
