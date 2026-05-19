#!/usr/bin/env node
import { runCli } from "./cli.js";

runCli(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\x1b[31mError:\x1b[0m ${message}`);
  process.exit(1);
});
