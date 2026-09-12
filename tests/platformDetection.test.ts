import assert from "node:assert/strict";
import test from "node:test";
import {
  detectLinuxDisplayServer,
  detectPlatformCapabilities,
  isPlatformCapabilities
} from "../src/shared/platform";

test("Windows detection exposes the full win32 capability matrix", () => {
  const capabilities = detectPlatformCapabilities("win32", {});
  assert.equal(capabilities.platform, "windows");
  assert.equal(capabilities.displayServer, "win32");
  assert.equal(capabilities.supportsProgrammaticWindowMove, true);
  assert.equal(capabilities.supportsCursorScreenPosition, true);
  assert.equal(capabilities.supportsEdgeClimbing, true);
});

test("Linux DISPLAY-only sessions classify as X11 with full positioning", () => {
  assert.equal(detectLinuxDisplayServer({ DISPLAY: ":0" }), "x11");
  const capabilities = detectPlatformCapabilities("linux", { DISPLAY: ":0" });
  assert.equal(capabilities.supportsProgrammaticWindowMove, true);
  assert.equal(capabilities.supportsPerching, true);
});

test("native Wayland is conservative even when a compatibility DISPLAY exists", () => {
  const capabilities = detectPlatformCapabilities("linux", {
    XDG_SESSION_TYPE: "wayland",
    WAYLAND_DISPLAY: "wayland-0",
    DISPLAY: ":1"
  });
  assert.equal(capabilities.displayServer, "wayland");
  assert.equal(capabilities.supportsProgrammaticWindowMove, false);
  assert.equal(capabilities.supportsCursorScreenPosition, false);
  assert.equal(capabilities.supportsAlwaysOnTop, false);
});

test("mixed X/Wayland signals without a native-session claim classify as XWayland", () => {
  assert.equal(
    detectLinuxDisplayServer({ WAYLAND_DISPLAY: "wayland-0", DISPLAY: ":1" }),
    "xwayland"
  );
  assert.equal(
    detectLinuxDisplayServer({
      XDG_SESSION_TYPE: "wayland",
      WAYLAND_DISPLAY: "wayland-0",
      DISPLAY: ":1",
      ELECTRON_OZONE_PLATFORM_HINT: "x11"
    }),
    "xwayland"
  );
});

test("missing Linux display values fail safely to unknown limited mode", () => {
  const capabilities = detectPlatformCapabilities("linux", {});
  assert.equal(capabilities.displayServer, "unknown");
  assert.equal(capabilities.supportsAbsoluteWindowPosition, false);
  assert.equal(capabilities.supportsProgrammaticWindowMove, false);
  assert.equal(capabilities.supportsTray, true);
});

test("explicit native Wayland Ozone selection wins over mixed environment values", () => {
  assert.equal(
    detectLinuxDisplayServer({
      XDG_SESSION_TYPE: "wayland",
      WAYLAND_DISPLAY: "wayland-0",
      DISPLAY: ":1",
      ELECTRON_OZONE_PLATFORM_HINT: "wayland"
    }),
    "wayland"
  );
});

test("platform capability payload validation rejects malformed bridge values", () => {
  assert.equal(isPlatformCapabilities(detectPlatformCapabilities("linux", {})), true);
  assert.equal(isPlatformCapabilities({ platform: "linux" }), false);
  assert.equal(isPlatformCapabilities(null), false);
});
