import { loadOraDevEnv } from "./env-file";

const env = {
  ...process.env,
  ...loadOraDevEnv(),
};

const child = Bun.spawn({
  cmd: ["./node_modules/.bin/next", "dev", "--port", "3000"],
  cwd: new URL("../site", import.meta.url).pathname,
  env,
  stdout: "inherit",
  stderr: "inherit",
  stdin: "inherit",
});

function stop(code = 0) {
  try {
    child.kill();
  } catch {
    // ignore
  }

  setTimeout(() => process.exit(code), 50);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

child.exited.then((code) => stop(code || 0));

console.log("starting ora playground");
console.log("  app -> http://localhost:3000/playground");
if (env.OPENAI_API_KEY) {
  console.log("  creds -> OPENAI_API_KEY loaded from env file");
} else {
  console.log("  creds -> OPENAI_API_KEY missing");
}
