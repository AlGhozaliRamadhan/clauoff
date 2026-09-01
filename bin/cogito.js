#!/usr/bin/env node

/**
 * Cogito CLI Runner
 * Interactive menu and process manager for Cogito Web UI.
 */

const { spawn, exec, execSync } = require("node:child_process");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

process.title = "Cogito";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const PID_FILE = path.join(DATA_DIR, ".cogito.pid");

let VERSION = "0.1.0";
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf-8"));
  if (pkg.version) VERSION = pkg.version;
} catch {}

const args = process.argv.slice(2);

// Parse CLI flags
let port = 2648;
let isDev = false;
let forceBg = false;
let forceFg = false;
let forceRestart = false;
let openRequested = false;
let explicitCommand = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === "--port" || arg === "-p") {
    port = parseInt(args[i + 1], 10) || 2648;
    i++;
  } else if (arg === "--dev" || arg === "-d") {
    isDev = true;
  } else if (arg === "--bg" || arg === "--background") {
    forceBg = true;
  } else if (arg === "--fg" || arg === "--foreground") {
    forceFg = true;
  } else if (arg === "--force" || arg === "-f") {
    forceRestart = true;
  } else if (arg === "--open") {
    openRequested = true;
  } else if (arg === "--help" || arg === "-h") {
    showHelp();
    process.exit(0);
  } else if (!arg.startsWith("-") && !explicitCommand) {
    explicitCommand = arg.toLowerCase();
  }
}

function showHelp() {
  console.log(`
====================================================
  Cogito Web UI CLI (v${VERSION})
====================================================

Usage:
  cogito                 Launch interactive choice menu
  cogito [command]       Run a specific command directly

Commands:
  start                  Start Cogito server
  stop                   Stop running Cogito background server
  restart                Restart Cogito server
  open                   Open Cogito Web UI in default browser
  status                 Check server status

Flags:
  --fg, --foreground     Run in foreground with console logs
  --bg, --background     Run in background with system tray
  -f, --force            Force restart if already running
  --open                 Open default browser after starting
  -p, --port <number>    Port to listen on (default: 2648)
  -d, --dev              Run development server with hot-reloading
  -h, --help             Show this help message
`);
}

function askYesNo(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      const val = answer.trim().toLowerCase();
      resolve(val === "y" || val === "yes");
    });
  });
}

/**
 * Checks if Cogito HTTP server is responsive on the given port
 */
function checkServer(checkPort = port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${checkPort}/api/config`, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    req.on("error", () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Opens default web browser
 */
function openBrowser(targetUrl) {
  const platform = process.platform;
  if (platform === "win32") {
    exec(`start "" "${targetUrl}"`);
  } else if (platform === "darwin") {
    exec(`open "${targetUrl}"`);
  } else {
    exec(`xdg-open "${targetUrl}"`);
  }
}

/**
 * Saves PID metadata
 */
function savePidInfo(info) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PID_FILE, JSON.stringify(info, null, 2), "utf-8");
  } catch {
    // ignore
  }
}

/**
 * Reads stored PID metadata
 */
function readPidInfo() {
  try {
    if (fs.existsSync(PID_FILE)) {
      return JSON.parse(fs.readFileSync(PID_FILE, "utf-8"));
    }
  } catch {}
  return null;
}

/**
 * Kills a process and its children cleanly
 */
function killPid(pid) {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F 2>nul`, { stdio: "ignore" });
    } else {
      process.kill(pid, "SIGTERM");
    }
  } catch {}
}

async function handleStop() {
  console.log("[Cogito] Stopping server...");
  const info = readPidInfo();
  if (info) {
    if (info.serverPid) killPid(info.serverPid);
    if (info.trayPid) killPid(info.trayPid);
    try {
      fs.unlinkSync(PID_FILE);
    } catch {}
  }

  // Also terminate any leftover process listening on the port and stray tray processes
  if (process.platform === "win32") {
    try {
      execSync("taskkill /F /IM tray.exe 2>nul", { stdio: "ignore" });
    } catch {}
    try {
      const netstat = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: "utf-8" }).trim();
      const lines = netstat.split("\n");
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && parseInt(pid, 10) > 0) {
          killPid(parseInt(pid, 10));
        }
      }
    } catch {}
  }

  console.log("[Cogito] Server stopped.");
}

async function handleStatus() {
  const isRunning = await checkServer();
  const info = readPidInfo();
  if (isRunning) {
    console.log(`[Status] Cogito is RUNNING at http://localhost:${port} (PID: ${info?.serverPid || "unknown"})`);
  } else {
    console.log(`[Status] Cogito is STOPPED`);
  }
}

async function handleOpen() {
  const url = `http://localhost:${port}`;
  const isRunning = await checkServer();
  if (!isRunning) {
    console.log(`[Cogito] Server is not running. Starting in background...`);
    openRequested = true;
    await startBackground();
    return;
  }
  console.log(`[Cogito] Opening ${url} in default browser...`);
  openBrowser(url);
}

function ensureProductionBuild() {
  if (!isDev) {
    const nextBuildDir = path.join(PROJECT_ROOT, ".next");
    if (!fs.existsSync(nextBuildDir)) {
      console.log(`[Cogito] Production build not found. Running next build...`);
      execSync("npm run build", { cwd: PROJECT_ROOT, stdio: "inherit" });
    }
  }
}

/**
 * Start in Foreground (console logs, press Ctrl+C to stop)
 */
async function startForeground(options = {}) {
  const url = `http://localhost:${port}`;
  const alreadyRunning = await checkServer();

  if (alreadyRunning) {
    if (forceRestart || options.force) {
      console.log(`[Cogito] Stopping existing instance on ${url}...`);
      await handleStop();
      await new Promise((r) => setTimeout(r, 600));
    } else if (options.promptIfRunning) {
      console.log(`[Cogito] Server is already active on ${url}`);
      const shouldRestart = await askYesNo("Do you want to restart and force this instance? (y/N): ");
      if (shouldRestart) {
        console.log(`[Cogito] Stopping existing instance and starting in foreground...`);
        await handleStop();
        await new Promise((r) => setTimeout(r, 600));
      } else {
        console.log(`[Cogito] Keeping existing server running.`);
        if (openRequested) openBrowser(url);
        return;
      }
    } else {
      console.log(`[Cogito] Server is already active on ${url}`);
      if (openRequested) openBrowser(url);
      return;
    }
  }

  ensureProductionBuild();

  console.log(`[Cogito] Starting foreground server on ${url}...`);
  console.log(`[Cogito] Press Ctrl+C to stop the server at any time.\n`);

  const nextBin = path.join(PROJECT_ROOT, "node_modules", "next", "dist", "bin", "next");
  const serverArgs = [nextBin, isDev ? "dev" : "start", "-p", String(port)];

  if (openRequested) {
    setTimeout(() => openBrowser(url), 1500);
  }

  const child = spawn(process.execPath, serverArgs, {
    cwd: PROJECT_ROOT,
    stdio: "inherit",
    env: { ...process.env, PORT: String(port) },
  });

  child.on("exit", (code) => {
    process.exit(code || 0);
  });
}

function isPidAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function spawnTray(serverPid = 0) {
  if (process.platform !== "win32") return null;

  // Kill existing stray tray processes first so only one tray icon ever exists
  try {
    execSync("taskkill /F /IM tray.exe 2>nul", { stdio: "ignore" });
  } catch {}

  const trayExe = fs.existsSync(path.join(PROJECT_ROOT, "native", "windows", "tray.exe"))
    ? path.join(PROJECT_ROOT, "native", "windows", "tray.exe")
    : path.join(__dirname, "tray.exe");
  if (fs.existsSync(trayExe)) {
    const cmd = `start "" "${trayExe}" /port:${port} /pid:${serverPid} "/root:${PROJECT_ROOT}"`;
    exec(cmd, { windowsHide: false });
    return null;
  }

  const trayScript = fs.existsSync(path.join(PROJECT_ROOT, "native", "windows", "tray.ps1"))
    ? path.join(PROJECT_ROOT, "native", "windows", "tray.ps1")
    : path.join(__dirname, "tray.ps1");
  if (fs.existsSync(trayScript)) {
    const cmd = `powershell -WindowStyle Hidden -ExecutionPolicy Bypass -File "${trayScript}" -Port ${port} -ServerPid ${serverPid} -ProjectRoot "${PROJECT_ROOT}"`;
    exec(cmd, { windowsHide: false });
    return null;
  }

  return null;
}

/**
 * Start in Background with Windows System Tray
 */
async function startBackground(options = {}) {
  const url = `http://localhost:${port}`;
  const alreadyRunning = await checkServer();

  if (alreadyRunning) {
    if (forceRestart || options.force) {
      console.log(`[Cogito] Stopping existing instance on ${url}...`);
      await handleStop();
      await new Promise((r) => setTimeout(r, 600));
    } else if (options.promptIfRunning) {
      console.log(`[Cogito] Server is already active on ${url}`);
      const shouldRestart = await askYesNo("Do you want to restart and force this instance? (y/N): ");
      if (shouldRestart) {
        console.log(`[Cogito] Stopping existing instance and starting in background...`);
        await handleStop();
        await new Promise((r) => setTimeout(r, 600));
      } else {
        console.log(`[Cogito] Keeping existing server running.`);
        const info = readPidInfo() || {};
        if (process.platform === "win32") {
          spawnTray(info.serverPid || 0);
        }
        if (openRequested) openBrowser(url);
        return;
      }
    } else {
      console.log(`[Cogito] Server is active at ${url}`);
      const info = readPidInfo() || {};
      if (process.platform === "win32") {
        spawnTray(info.serverPid || 0);
        console.log(`[Cogito] Background system tray icon launched.`);
      }
      console.log(`[Cogito] You may safely close this terminal.`);
      if (openRequested) openBrowser(url);
      return;
    }
  }

  ensureProductionBuild();

  console.log(`[Cogito] Starting background server on ${url}...`);

  let serverPid = 0;

  if (process.platform === "win32") {
    const nextBin = path.join(PROJECT_ROOT, "node_modules", "next", "dist", "bin", "next");
    const mode = isDev ? "dev" : "start";
    const launchCmd = `powershell -NoProfile -WindowStyle Hidden -Command "$p = Start-Process -FilePath '${process.execPath}' -ArgumentList '${nextBin} ${mode} -p ${port}' -WorkingDirectory '${PROJECT_ROOT}' -PassThru -WindowStyle Hidden; $p.Id"`;
    try {
      const output = execSync(launchCmd, { encoding: "utf-8" }).trim();
      serverPid = parseInt(output, 10) || 0;
    } catch {
      // fallback
    }
  } else {
    const nextBin = path.join(PROJECT_ROOT, "node_modules", "next", "dist", "bin", "next");
    const serverArgs = [nextBin, isDev ? "dev" : "start", "-p", String(port)];

    const serverProcess = spawn(process.execPath, serverArgs, {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, PORT: String(port) },
    });

    serverProcess.unref();
    serverPid = serverProcess.pid;
  }

  const trayPid = spawnTray(serverPid);

  savePidInfo({ serverPid, trayPid, port, startedAt: new Date().toISOString() });

  // Poll until HTTP server is ready
  let attempts = 0;
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 400));
    const ready = await checkServer();
    if (ready) break;
    attempts++;
  }

  console.log(`[Cogito] Online at ${url}`);
  if (process.platform === "win32") {
    console.log(`[Cogito] Background system tray icon is active in taskbar notification area.`);
  }
  console.log(`[Cogito] Server is running in background. You may safely close this terminal.`);

  if (openRequested) {
    openBrowser(url);
  }
}

async function handleRestart() {
  await handleStop();
  await new Promise((r) => setTimeout(r, 800));
  await startBackground({ force: true });
}

/**
 * Interactive choice menu when cogito is executed without flags
 */
async function showInteractiveMenu() {
  const isRunning = await checkServer();

  console.log(`
====================================================
  Cogito Web UI (v${VERSION})
====================================================
Server Status: ${isRunning ? `RUNNING on http://localhost:${port}` : "STOPPED"}

Select how you want to run Cogito:

  [1] Open Web UI
  [2] Run in background
  [0] Exit
`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Enter choice [1-2, 0 to exit]: ", async (answer) => {
    rl.close();
    const choice = answer.trim();

    switch (choice) {
      case "1":
        await handleOpen();
        process.exit(0);
        break;
      case "2":
        await startBackground({ promptIfRunning: true });
        process.exit(0);
        break;
      case "0":
      case "3":
      case "":
        console.log("Exiting.");
        process.exit(0);
        break;
      default:
        console.log("Invalid choice. Exiting.");
        process.exit(1);
    }
  });
}

async function main() {
  // If specific flags or commands were given, execute directly
  if (explicitCommand) {
    switch (explicitCommand) {
      case "start":
        if (forceBg) {
          await startBackground({ force: forceRestart });
        } else if (forceFg) {
          await startForeground({ force: forceRestart });
        } else {
          await showInteractiveMenu();
        }
        break;
      case "stop":
        await handleStop();
        break;
      case "restart":
        await handleRestart();
        break;
      case "status":
        await handleStatus();
        break;
      case "open":
        await handleOpen();
        break;
      default:
        console.error(`Unknown command: "${explicitCommand}"`);
        showHelp();
        process.exit(1);
    }
    return;
  }

  // Direct flag execution
  if (forceBg) {
    await startBackground({ force: forceRestart });
    return;
  }
  if (forceFg) {
    await startForeground({ force: forceRestart });
    return;
  }

  // Default when running bare "cogito": show choice menu
  await showInteractiveMenu();
}

main().catch((err) => {
  console.error("Cogito CLI Error:", err);
  process.exit(1);
});
