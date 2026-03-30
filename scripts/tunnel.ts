#!/usr/bin/env npx tsx
/**
 * Convenience script to start a Cloudflare Tunnel for local development.
 * Usage: npm run tunnel
 *        npm run tunnel -- --port 3001
 */

import { spawn } from "child_process";

const TUNNEL_URL_REGEX = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/;

const portArg = process.argv.find((a) => a.startsWith("--port="));
const parsedPort = portArg ? parseInt(portArg.split("=")[1], 10) : 3000;

if (Number.isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
  console.error(`  Error: Invalid port "${portArg?.split("=")[1]}". Must be 1–65535.\n`);
  process.exit(1);
}

const port = parsedPort;

console.log(`\n  Starting Cloudflare Tunnel → http://localhost:${port}\n`);

const child = spawn("cloudflared", ["tunnel", "--url", `http://localhost:${port}`], {
  stdio: ["ignore", "pipe", "pipe"],
});

let found = false;

function handleData(data: Buffer) {
  const line = data.toString();
  if (!found) {
    const match = line.match(TUNNEL_URL_REGEX);
    if (match) {
      found = true;
      const url = match[0];
      const mcpUrl = url + "/api/mcp";
      const maxLen = Math.max(url.length, mcpUrl.length, 30);
      const w = maxLen + 16; // "  Public URL : " prefix
      const line = "─".repeat(w + 2);
      const pad = (s: string) => s.padEnd(w);

      console.log(`  ┌${line}┐`);
      console.log(`  │ ${pad("Tunnel active")} │`);
      console.log(`  ├${line}┤`);
      console.log(`  │ ${pad(`Public URL : ${url}`)} │`);
      console.log(`  │ ${pad(`MCP Server : ${mcpUrl}`)} │`);
      console.log(`  ├${line}┤`);
      console.log(`  │ ${pad("Press Ctrl+C to stop")} │`);
      console.log(`  └${line}┘\n`);
    }
  }
}

child.stderr?.on("data", handleData);
child.stdout?.on("data", handleData);

child.on("error", (err) => {
  if ((err as NodeJS.ErrnoException).code === "ENOENT") {
    console.error("  Error: cloudflared is not installed.\n");
    console.error("  Install it with:");
    console.error("    brew install cloudflare/cloudflare/cloudflared\n");
    console.error("  Or visit: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n");
    process.exit(1);
  }
  console.error(`  Error: ${err.message}`);
  process.exit(1);
});

child.on("close", (code) => {
  if (code !== null && code !== 0) {
    console.log(`\n  Tunnel exited with code ${code}\n`);
  } else {
    console.log("\n  Tunnel stopped.\n");
  }
  process.exit(code ?? 0);
});

// Graceful shutdown
function cleanup() {
  if (!child.killed) {
    child.kill("SIGTERM");
  }
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
