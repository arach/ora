import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function parseEnvFile(path: string) {
  if (!existsSync(path)) {
    return {};
  }

  const raw = readFileSync(path, "utf8");
  const values: Record<string, string> = {};

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...rest] = trimmed.split("=");
    values[key] = rest.join("=").trim();
  }

  return values;
}

export function loadOraDevEnv(cwd = process.cwd()) {
  const candidates = [
    resolve(cwd, ".env"),
    resolve(cwd, "..", ".env"),
    resolve(cwd, "..", "..", ".env"),
    resolve(cwd, "site", ".env.local"),
  ];

  return candidates.reduce<Record<string, string>>((accumulator, path) => {
    return {
      ...accumulator,
      ...parseEnvFile(path),
    };
  }, {});
}
