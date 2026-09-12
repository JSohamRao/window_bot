import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const productionBuild = process.argv.includes("--production");

const projectFilesPlugin = {
  name: "thukuna-project-files",
  setup(buildContext) {
    buildContext.onResolve(
      { filter: /^\./ },
      (args) => {
        const unresolvedPath = resolve(args.resolveDir, args.path);
        const resolvedPath = extname(unresolvedPath)
          ? unresolvedPath
          : `${unresolvedPath}.ts`;
        return { path: resolvedPath, namespace: "thukuna-project" };
      }
    );

    buildContext.onLoad(
      { filter: /.*/, namespace: "thukuna-project" },
      async (args) => ({
        contents: await readFile(args.path, "utf8"),
        loader: "ts",
        resolveDir: dirname(args.path)
      })
    );
  }
};

const bundle = async ({ entry, outfile, platform, format, external = [] }) => {
  const entryPath = join(projectRoot, entry);
  await build({
    stdin: {
      contents: await readFile(entryPath, "utf8"),
      loader: "ts",
      resolveDir: dirname(entryPath),
      sourcefile: entryPath
    },
    bundle: true,
    platform,
    format,
    external,
    outfile: join(projectRoot, outfile),
    sourcemap: productionBuild ? false : true,
    define: {
      __THUKUNA_PRODUCTION_BUILD__: productionBuild ? "true" : "false"
    },
    plugins: [projectFilesPlugin]
  });
};

await Promise.all([
  bundle({
    entry: "src/renderer/pet.ts",
    outfile: "dist/renderer/pet.js",
    platform: "browser",
    format: "iife"
  }),
  bundle({
    entry: "src/main/preload.ts",
    outfile: "dist/main/preload.js",
    platform: "node",
    format: "cjs",
    external: ["electron"]
  })
]);
