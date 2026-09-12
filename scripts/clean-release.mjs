import { rm } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));
const releaseDirectory = resolve(join(projectRoot, "release"));
const relativeTarget = relative(projectRoot, releaseDirectory);

if (relativeTarget !== "release") {
  throw new Error(`Refusing to clean unexpected path: ${releaseDirectory}`);
}

await rm(releaseDirectory, { recursive: true, force: true });
console.info(`[THUKUNA release] Cleaned ${releaseDirectory}`);
