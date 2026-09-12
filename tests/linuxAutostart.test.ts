import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {
  createLinuxAutostartEntry,
  getLinuxAutostartPath
} from "../src/main/platform/linuxAutostart";

test("Linux autostart path follows the XDG configuration root", () => {
  assert.equal(
    getLinuxAutostartPath(path.join("user", "config")),
    path.join("user", "config", "autostart", "thukuna.desktop")
  );
});

test("Linux desktop entry safely quotes executable paths", () => {
  const entry = createLinuxAutostartEntry(
    path.join("opt", "THUKUNA Pet", "thukuna")
  );
  assert.match(entry, /^\[Desktop Entry\]/);
  assert.match(entry, /Exec=".*THUKUNA Pet.*thukuna"/);
  assert.match(entry, /Terminal=false/);
  assert.equal(entry.endsWith("\n"), true);
});

test("Linux desktop entry strips line breaks from executable values", () => {
  const entry = createLinuxAutostartEntry("thukuna\nInjected=true");
  assert.equal(entry.includes("\nInjected=true\n"), false);
});

test("Linux development autostart safely quotes the Electron app argument", () => {
  const entry = createLinuxAutostartEntry("electron", [
    path.join("projects", "THUKUNA Pet")
  ]);
  assert.match(entry, /Exec="electron" ".*THUKUNA Pet"/);
});
