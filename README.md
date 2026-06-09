# PyWeave

PyWeave is a desktop algorithm visualization app for Python code. It combines a
Monaco-based Python editor with a React Flow variable graph, then uses a Tauri
backend with PyO3 to execute Python code and collect line-by-line trace data.

## Features

- Edit and run Python code inside the app.
- Visualize Python locals as variable and array nodes.
- See pointer labels directly on array cells.
- Step through captured execution states.
- Review localized step guidance, current line context and variable changes.
- Play, pause and change playback speed.
- Switch the UI between Chinese and English.
- Start from built-in templates:
  - Custom Code
  - Bubble Sort
  - Binary Search
  - Two-Pointer Reverse
- See syntax and runtime errors with line information.

## Tech Stack

- Tauri 2
- React 19
- TypeScript
- Vite
- Monaco Editor
- React Flow
- Rust
- PyO3

## Requirements

- Node.js
- npm
- Rust
- Python 3
- Tauri system dependencies for your operating system

Python must be available on the machine because PyWeave executes user-provided
Python code through the native Tauri backend.

## Security Model

PyWeave runs Python locally for algorithm visualization. By default, the backend
accepts a restricted Python subset: basic control flow, functions, indexing,
literals and a small set of safe builtins such as `len`, `range`, `list`,
`min`, `max`, `sum` and `sorted`. Imports, attribute access, classes, lambdas
and indirect calls are rejected with an explicit line-numbered error.

Set `PYWEAVE_ALLOW_UNRESTRICTED_PYTHON=1` only for trusted local code when full
Python execution is required. Unrestricted mode gives code the same host access
as the desktop process.

Trace capture is bounded by `MAX_TRACE_EVENTS` in the backend and by a local
snapshot byte limit. Set `PYWEAVE_MAX_SNAPSHOT_BYTES=0` to disable the snapshot
size limit for trusted local experiments.

## Install

```bash
npm install
```

## Development

Run the Tauri desktop app in development mode:

```bash
npm run tauri -- dev
```

Run the frontend dev server only:

```bash
npm run dev
```

## Build

Build the frontend:

```bash
npm run build
```

Build the desktop app:

```bash
npm run tauri -- build
```

Generated installers and binaries are written under `src-tauri/target/`.

## Tests

Run the Rust backend tests:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Run the TypeScript derivation and localization tests:

```bash
npm test
```

## Project Structure

```text
.
+-- src/                  # React frontend
+-- src-tauri/            # Tauri and Rust backend
|   +-- src/              # Rust tracing and Python execution code
|   +-- capabilities/     # Tauri capability config
|   +-- icons/            # App icons
|   +-- tauri.conf.json   # Tauri app config
+-- index.html
+-- package.json
+-- tsconfig.json
+-- vite.config.ts
```

## Notes

PyWeave traces line events from Python code and displays values that can be
serialized for visualization. It works best when algorithms use clear variable
names such as `items`, `i`, `j`, `left`, `right` and `mid`.
