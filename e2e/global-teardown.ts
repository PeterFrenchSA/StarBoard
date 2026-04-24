import { execFileSync } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";

const STATE_FILE = path.resolve(process.cwd(), ".playwright-e2e-state.json");

type E2eState = {
  baseURL: string;
  startedStack: boolean;
};

function runDockerCompose(args: string[]) {
  execFileSync("docker", ["compose", ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit"
  });
}

export default async function globalTeardown() {
  try {
    const rawState = await readFile(STATE_FILE, "utf8");
    const state = JSON.parse(rawState) as E2eState;

    if (state.startedStack && process.env.PLAYWRIGHT_STOP_STACK === "1") {
      console.log(`[playwright] Stopping Docker stack started for ${state.baseURL}`);
      runDockerCompose(["down"]);
      return;
    }

    if (state.startedStack) {
      console.log("[playwright] Leaving Docker stack running for local reuse.");
    }
  } catch {
    // No state file means setup did not complete, or there is nothing to clean up.
  } finally {
    await rm(STATE_FILE, { force: true });
  }
}
