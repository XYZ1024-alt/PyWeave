import { spawn } from "node:child_process";

const BACKEND_TEST_TIMEOUT_MS = 60_000;
const CARGO_ARGS = ["test", "--manifest-path", "src-tauri\\Cargo.toml"];

const child = spawn("cargo", CARGO_ARGS, {
  stdio: "inherit",
  windowsHide: true,
});

const timeout = setTimeout(() => {
  console.error(`cargo test exceeded ${BACKEND_TEST_TIMEOUT_MS} ms; terminating backend tests`);
  child.kill();
}, BACKEND_TEST_TIMEOUT_MS);

child.on("error", (error) => {
  clearTimeout(timeout);
  console.error(error.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  clearTimeout(timeout);

  if (signal) {
    console.error(`cargo test terminated by ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});
