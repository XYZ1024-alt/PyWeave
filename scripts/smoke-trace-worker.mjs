import { spawnSync } from "node:child_process";

const EXPECTED_TOTAL = 6;
const WORKER_ARG = "--pyweave-trace-worker";
const exePath = process.argv[2];

if (!exePath) {
  console.error("Usage: node scripts/smoke-trace-worker.mjs <pyweave-tauri.exe>");
  process.exit(1);
}

const request = JSON.stringify({
  pythonCode: "items = [1, 2, 3]\ntotal = sum(items)\n",
});
const result = spawnSync(exePath, [WORKER_ARG], {
  encoding: "utf8",
  input: request,
  windowsHide: true,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`trace worker exited with code ${result.status}`);
  console.error(result.stderr.trim());
  process.exit(result.status ?? 1);
}

const response = JSON.parse(result.stdout);

if (response.status !== "ok") {
  console.error(`trace worker returned status ${response.status}`);
  console.error(response.payload?.message ?? "");
  process.exit(1);
}

if (!Array.isArray(response.payload.frames) || response.payload.frames.length === 0) {
  console.error("trace worker returned no frames");
  process.exit(1);
}

const lastFrame = response.payload.frames.at(-1);

if (lastFrame.locals.total !== EXPECTED_TOTAL) {
  console.error(`expected total to be ${EXPECTED_TOTAL}, got ${lastFrame.locals.total}`);
  process.exit(1);
}

console.log("trace worker smoke test passed");
