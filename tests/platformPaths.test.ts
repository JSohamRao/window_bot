import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createPlatformPaths } from "../src/main/platform/platformPaths";

const pathValues: Record<string, string> = {
  home: path.join("root", "home"),
  userData: path.join("root", "user-data"),
  appData: path.join("root", "app-data"),
  temp: path.join("root", "temp"),
  exe: path.join("root", "bin", "thukuna")
};

const application = {
  getPath: (name: string) => pathValues[name]
};

test("Windows platform paths use Electron path providers", () => {
  const paths = createPlatformPaths(
    application as never,
    "windows",
    {}
  );
  assert.equal(paths.userData, pathValues.userData);
  assert.equal(paths.configuration, pathValues.appData);
  assert.equal(paths.temporary, pathValues.temp);
  assert.equal(paths.executable, pathValues.exe);
});

test("Linux platform paths honor XDG_CONFIG_HOME without manual separators", () => {
  const configured = path.join("custom", "xdg-config");
  const paths = createPlatformPaths(
    application as never,
    "linux",
    { XDG_CONFIG_HOME: configured }
  );
  assert.equal(paths.configuration, path.resolve(configured));
});

test("Linux platform paths safely fall back to the home config directory", () => {
  const paths = createPlatformPaths(
    application as never,
    "linux",
    {}
  );
  assert.equal(paths.configuration, path.join(pathValues.home, ".config"));
});
