import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { extractFile, listPackage } from "@electron/asar";

const projectRoot = path.resolve(import.meta.dirname, "..");
const asarPath = path.join(projectRoot, "release", "win-unpacked", "resources", "app.asar");
const executablePath = path.join(projectRoot, "release", "win-unpacked", "THUKUNA.exe");
const installerPath = path.join(projectRoot, "release", "THUKUNA-Setup-0.1.0.exe");
const blockMapPath = `${installerPath}.blockmap`;
const normalizedEntries = listPackage(asarPath).map((entry) => entry.replaceAll("\\", "/").replace(/^\//, ""));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const extract = (entry) => extractFile(asarPath, entry.replaceAll("/", path.sep));

const collectPngs = async (directory) => {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await collectPngs(fullPath));
    else if (entry.name.toLowerCase().endsWith(".png")) found.push(fullPath);
  }
  return found;
};

const sourceAnimationRoot = path.join(projectRoot, "assets", "thukuna", "animations");
const spriteFiles = await collectPngs(sourceAnimationRoot);
assert.equal(spriteFiles.length, 116, "source sprite count");
const animationFamilies = (await readdir(sourceAnimationRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
assert.equal(animationFamilies.length, 15, "animation family count");

const packagedSpriteEntries = normalizedEntries.filter((entry) =>
  /^dist\/assets\/thukuna\/animations\/.*\.png$/i.test(entry)
);
assert.equal(packagedSpriteEntries.length, 116, "packaged sprite count");
assert.equal(
  packagedSpriteEntries.filter((entry) => entry.includes("/domain/")).length,
  20,
  "packaged Domain sprite count"
);
assert.ok(normalizedEntries.includes("dist/assets/icons/thukuna.ico"));
assert.ok(normalizedEntries.includes("dist/assets/icons/tray.png"));

let matchingSpriteHashes = 0;
for (const sourcePath of spriteFiles) {
  const relativeSprite = path.relative(sourceAnimationRoot, sourcePath).replaceAll("\\", "/");
  const asarEntry = `dist/assets/thukuna/animations/${relativeSprite}`;
  const [source, packaged] = await Promise.all([
    readFile(sourcePath),
    Promise.resolve(extract(asarEntry))
  ]);
  assert.equal(sha256(packaged), sha256(source), `sprite hash ${relativeSprite}`);
  matchingSpriteHashes += 1;
}

const forbiddenEntries = normalizedEntries.filter((entry) =>
  /(^|\/)(tests|art-production|diagnostics)(\/|$)|(^|\/).*\.(map|ts|csv)$/i.test(entry) ||
  /(^|\/)(soak|profile)[^/]*$/i.test(entry)
);
assert.deepEqual(forbiddenEntries, [], "forbidden development files");

const packagedManifest = JSON.parse(extract("package.json").toString("utf8"));
assert.equal(packagedManifest.main, "dist/main/main.js");
assert.equal(packagedManifest.version, "0.1.0");
assert.equal(packagedManifest.dependencies?.["electron-updater"], undefined);

const rendererBundle = extract("dist/renderer/pet.js").toString("utf8");
assert.match(rendererBundle, /productionBuild = true/);
const petWindow = extract("dist/main/petWindow.js").toString("utf8");
assert.match(petWindow, /contextIsolation: true/);
assert.match(petWindow, /nodeIntegration: false/);
assert.match(petWindow, /sandbox: true/);

const executable = await readFile(executablePath);
assert.equal(executable.toString("ascii", 0, 2), "MZ");
const peOffset = executable.readUInt32LE(0x3c);
assert.equal(executable.toString("ascii", peOffset, peOffset + 4), "PE\0\0");
assert.equal(executable.readUInt16LE(peOffset + 4), 0x8664, "x64 PE machine");

const installer = await readFile(installerPath);
const blockMap = await readFile(blockMapPath);
const report = {
  result: "PASS",
  appVersion: packagedManifest.version,
  architecture: "x64",
  asarEntries: normalizedEntries.length,
  sprites: packagedSpriteEntries.length,
  animationFamilies,
  animationFamilyCount: animationFamilies.length,
  matchingSpriteHashes,
  forbiddenEntries,
  productionDevelopmentControlsDisabled: true,
  electronSecurity: {
    sandbox: true,
    contextIsolation: true,
    nodeIntegration: false
  },
  autoUpdaterPresent: false,
  installerBytes: installer.length,
  blockMapBytes: blockMap.length,
  hashes: {
    installerSha256: sha256(installer),
    blockMapSha256: sha256(blockMap),
    executableSha256: sha256(executable),
    asarSha256: sha256(await readFile(asarPath))
  }
};

await writeFile(
  path.join(projectRoot, "release", "release-audit.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8"
);
console.info(JSON.stringify(report, null, 2));
