import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/index.js",
  external: ["commander", "yaml"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  logLevel: "info",
});
