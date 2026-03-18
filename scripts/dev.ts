const commands = [
  {
    name: "site",
    cwd: "site",
    cmd: ["bun", "run", "dev"],
  },
  {
    name: "docs-site",
    cwd: "docs-site",
    cmd: ["bun", "run", "dev"],
  },
  {
    name: "gateway",
    cwd: ".",
    cmd: ["bun", "run", "site:proxy"],
  },
] as const;

const children = commands.map((entry) =>
  Bun.spawn({
    cmd: entry.cmd,
    cwd: new URL(entry.cwd, `file://${process.cwd()}/`).pathname,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  }),
);

let shuttingDown = false;

function stopAll(code = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    try {
      child.kill();
    } catch {
      // ignore
    }
  }

  setTimeout(() => process.exit(code), 50);
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

for (const [index, child] of children.entries()) {
  child.exited.then((code) => {
    if (!shuttingDown && code !== 0) {
      console.error(`${commands[index]!.name} exited with code ${code}`);
      stopAll(code || 1);
    }
  });
}

console.log("starting ora dev stack");
console.log("  site      -> http://localhost:3000");
console.log("  docs-site -> http://localhost:4321");
console.log("  gateway   -> http://localhost:3100");
