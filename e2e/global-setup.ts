import type { FullConfig } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const HEALTH_PATH = "/login";
const POLL_INTERVAL_MS = 2_000;
const STARTUP_TIMEOUT_MS = 180_000;
const STATE_FILE = path.resolve(process.cwd(), ".playwright-e2e-state.json");

type E2eState = {
  baseURL: string;
  startedStack: boolean;
};

function resolveBaseUrl(config: FullConfig) {
  const configuredBaseUrl = config.projects[0]?.use?.baseURL;

  if (typeof configuredBaseUrl === "string" && configuredBaseUrl.length > 0) {
    return configuredBaseUrl;
  }

  return process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL;
}

async function isReachable(baseURL: string) {
  try {
    const response = await fetch(new URL(HEALTH_PATH, baseURL), {
      redirect: "manual"
    });

    return response.ok || [301, 302, 303, 307, 308].includes(response.status);
  } catch {
    return false;
  }
}

async function waitForApp(baseURL: string, timeoutMs: number) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await isReachable(baseURL)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  return false;
}

function runDockerCompose(args: string[]) {
  execFileSync("docker", ["compose", ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });
}

async function writeState(state: E2eState) {
  await writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = resolveBaseUrl(config);

  if (await isReachable(baseURL)) {
    console.log(`[playwright] Reusing running app at ${baseURL}`);
    await writeState({ baseURL, startedStack: false });
    return;
  }

  console.log(`[playwright] App is down. Starting Docker stack for ${baseURL}`);
  runDockerCompose(["up", "-d", "--build"]);

  const ready = await waitForApp(baseURL, STARTUP_TIMEOUT_MS);
  await writeState({ baseURL, startedStack: true });

  if (ready) {
    console.log(`[playwright] App is ready at ${baseURL}`);
    return;
  }

  try {
    runDockerCompose(["logs", "--tail=120", "app"]);
  } catch {
    // Best-effort logging before surfacing the startup failure.
  }

  throw new Error(`[playwright] Timed out waiting for ${new URL(HEALTH_PATH, baseURL)}`);
}
