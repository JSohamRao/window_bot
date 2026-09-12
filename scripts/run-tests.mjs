import { build } from "esbuild";
import { readFile, readdir } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const testsDirectory = join(projectRoot, "tests");
const outputDirectory = join(projectRoot, "dist", "tests");
const testNames = (await readdir(testsDirectory)).filter((name) =>
  name.endsWith(".test.ts")
);
const projectFilesPlugin = {
  name: "thukuna-test-project-files",
  setup(buildContext) {
    buildContext.onResolve({ filter: /^\./ }, (args) => {
      const unresolvedPath = resolve(args.resolveDir, args.path);
      const resolvedPath = extname(unresolvedPath)
        ? unresolvedPath
        : `${unresolvedPath}.ts`;
      return { path: resolvedPath, namespace: "thukuna-test-project" };
    });
    buildContext.onLoad(
      { filter: /.*/, namespace: "thukuna-test-project" },
      async (args) => ({
        contents: await readFile(args.path, "utf8"),
        loader: "ts",
        resolveDir: dirname(args.path)
      })
    );
  }
};

await Promise.all(
  testNames.map(async (name) => {
    const testPath = join(testsDirectory, name);
    await build({
      stdin: {
        contents: await readFile(testPath, "utf8"),
        loader: "ts",
        resolveDir: testsDirectory,
        sourcefile: testPath
      },
      outfile: join(outputDirectory, name.replace(/\.ts$/, ".js")),
      bundle: true,
      platform: "node",
      format: "cjs",
      sourcemap: true,
      plugins: [projectFilesPlugin]
    });
  })
);

const compiledTests = testNames.map((name) =>
  join(outputDirectory, name.replace(/\.ts$/, ".js"))
);
const result = spawnSync(process.execPath, ["--test", ...compiledTests], {
  cwd: projectRoot,
  stdio: "inherit"
});

process.exitCode = result.status ?? 1;
