import * as esbuild from "esbuild";
import { cp, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const publicSrc = join(root, "src/dashboard/public");
const publicDest = join(root, "dist/dashboard/public");

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/index.js",
  external: ["commander", "yaml"],
  logLevel: "info",
});

await mkdir(publicDest, { recursive: true });
await cp(publicSrc, publicDest, { recursive: true });
