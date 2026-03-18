#!/usr/bin/env node

import { runOraWorkerCli } from "./worker";

void runOraWorkerCli(process.argv.slice(2)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Unknown ora-worker CLI error.");
  process.exitCode = 1;
});
