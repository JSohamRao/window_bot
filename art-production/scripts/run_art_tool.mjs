import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const script = path.join(here, "art_tools.py");
const candidates = process.env.PYTHON ? [process.env.PYTHON] : ["python", "py", "python3"];

for (const executable of candidates) {
  const args = executable === "py" ? ["-3", script, ...process.argv.slice(2)] : [script, ...process.argv.slice(2)];
  const result = spawnSync(executable, args, { stdio: "inherit", shell: false });
  if (result.error?.code === "ENOENT") continue;
  process.exit(result.status ?? 1);
}

console.error("Unable to find Python. Set the PYTHON environment variable to a Python 3 executable.");
process.exit(1);
