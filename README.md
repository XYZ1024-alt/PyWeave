# PyWeave

PyWeave is a desktop algorithm visualization app for Python code. It combines a
Monaco-based Python editor with a React Flow variable graph, then uses a Tauri
backend with PyO3 to execute Python code and collect line-by-line trace data.

## Features

- Edit and run Python code inside the app.
- Visualize Python locals as variable and array nodes.
- Step through captured execution states.
- Play, pause and change playback speed.
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
