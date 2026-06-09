import { spawn } from "node:child_process";
import http from "node:http";

const HOST = "127.0.0.1";
const PORT = 1420;
const BASE_URL = `http://${HOST}:${PORT}`;
const START_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 250;

const existingServer = await canReachServer();
const server = existingServer ? null : startVite();

try {
  if (existingServer) {
    console.log(`Using existing dev server at ${BASE_URL}`);
  } else {
    await waitForServer();
  }

  const exitCode = await runPlaywright();
  process.exitCode = exitCode;
} finally {
  if (server) {
    server.kill();
  }
}

function startVite() {
  return spawn(
    process.execPath,
    ["node_modules/vite/bin/vite.js", "--host", HOST, "--port", String(PORT)],
    {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
}

function runPlaywright() {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["node_modules/@playwright/test/cli.js", "test"], {
      cwd: process.cwd(),
      stdio: "inherit",
    });

    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function waitForServer() {
  const startedAt = Date.now();

  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    if (await canReachServer()) {
      return;
    }

    if (serverExited()) {
      throw new Error("Vite dev server exited before it became reachable");
    }

    await delay(POLL_INTERVAL_MS);
  }

  throw new Error(`Timed out waiting for ${BASE_URL}`);
}

function serverExited() {
  return server?.exitCode !== null;
}

function canReachServer() {
  return new Promise((resolve) => {
    const request = http.get(BASE_URL, (response) => {
      response.resume();
      resolve(response.statusCode !== undefined && response.statusCode < 500);
    });

    request.on("error", () => resolve(false));
    request.setTimeout(1_000, () => {
      request.destroy();
      resolve(false);
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
