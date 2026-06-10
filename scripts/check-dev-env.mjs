import { spawnSync } from "node:child_process";

const npmExecPath = process.env.npm_execpath;
const NPM_CANDIDATES = [
  ...(npmExecPath ? [{ command: process.execPath, args: [npmExecPath, "--version"] }] : []),
  { command: "npm", args: ["--version"] },
  { command: "npm.cmd", args: ["--version"] },
];

const REQUIRED_TOOLS = [
  { name: "Node.js", candidates: [{ command: "node", args: ["--version"] }] },
  { name: "npm", candidates: NPM_CANDIDATES },
  { name: "Rust cargo", candidates: [{ command: "cargo", args: ["--version"] }] },
  {
    name: "Python 3",
    candidates: [
      { command: "python", args: ["--version"] },
      { command: "python3", args: ["--version"] },
      { command: "py", args: ["-3", "--version"] },
    ],
  },
];

const results = REQUIRED_TOOLS.map(checkTool);
const missing = results.filter((result) => !result.ok);

if (missing.length > 0) {
  console.error("PyWeave desktop development requirements are not satisfied:");
  for (const result of missing) {
    console.error(`- ${result.name}: ${result.message}`);
  }
  process.exit(1);
}

for (const result of results) {
  console.log(`✓ ${result.name}: ${result.message}`);
}

function checkTool(tool) {
  for (const candidate of tool.candidates) {
    const version = commandVersion(candidate.command, candidate.args);

    if (version) {
      return { ok: true, name: tool.name, message: version };
    }
  }

  return {
    ok: false,
    name: tool.name,
    message: `none of ${tool.candidates.map((candidate) => candidate.command).join(", ")} worked`,
  };
}

function commandVersion(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    windowsHide: true,
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  return versionOutput(result);
}

function versionOutput(result) {
  return (result.stdout || result.stderr).trim();
}
