import { rm } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));
const distDirectory = resolve(join(projectRoot, "dist"));

if (relative(projectRoot, distDirectory) !== "dist") {
  throw new Error(`Refusing to clean unexpected path: ${distDirectory}`);
}

await rm(distDirectory, { recursive: true, force: true });
console.info(`[THUKUNA build] Cleaned ${distDirectory}`);
