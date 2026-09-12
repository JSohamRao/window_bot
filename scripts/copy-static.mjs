import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const files = [
  ["src/renderer/index.html", "dist/renderer/index.html"],
  ["src/renderer/pet.css", "dist/renderer/pet.css"]
];

for (const [source, destination] of files) {
  const destinationPath = join(projectRoot, destination);
  await mkdir(dirname(destinationPath), { recursive: true });
  await copyFile(join(projectRoot, source), destinationPath);
}

const runtimeAssets = join(projectRoot, "dist/assets");
await rm(runtimeAssets, { recursive: true, force: true });
await cp(
  join(projectRoot, "assets/thukuna/animations"),
  join(runtimeAssets, "thukuna/animations"),
  { recursive: true }
);
await cp(join(projectRoot, "assets/icons"), join(runtimeAssets, "icons"), {
  recursive: true
});
