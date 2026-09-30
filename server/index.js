#!/usr/bin/env node
// HLPI Facilities CMMS server: one program that keeps the database, signs
// people in and serves the app to every browser on the site network.
//
//   node server/index.js [--port 8080] [--data ./data] [--open]
//
// Environment: PORT, CMMS_DATA_DIR, CMMS_ALLOWED_HOSTS (extra host names,
// comma-separated), CMMS_REMOTE_SETUP=1 (allow creating the first admin
// from another device).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { startServer } from './server.js';
import { lanAddresses } from './app.js';
import { msUntilLocalTime } from './time.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8'));

const { values: args } = parseArgs({
  options: {
    port: { type: 'string' },
    data: { type: 'string' },
    host: { type: 'string' },
    open: { type: 'boolean', default: false }
  }
});

const port = Number(args.port || process.env.PORT || 8080);
const dataDir = path.resolve(args.data || process.env.CMMS_DATA_DIR || 'data');
const log = msg => console.log(`[${new Date().toLocaleString('en-PH')}] ${msg}`);

let app;
try {
  app = await startServer({
    dataDir,
    distDir: path.join(here, '..', 'dist'),
    port,
    host: args.host || process.env.HOST || undefined,
    version: pkg.version,
    allowedHosts: (process.env.CMMS_ALLOWED_HOSTS || '').split(','),
    remoteSetup: process.env.CMMS_REMOTE_SETUP === '1'
  });
} catch (e) {
  if (e.code === 'EADDRINUSE') {
    console.error(`\nPort ${port} is already in use. Another copy of the CMMS may already be running.`
      + `\nClose it, or start this one on another port, e.g. --port ${port + 1}.\n`);
  } else {
    console.error(`\nThe CMMS server could not start: ${e.message}\n`);
  }
  process.exit(1);
}

const { store, accounts, backups } = app;

function generatePm() {
  try {
    const n = store.transact(null, ctx => store.generatePm(ctx));
    if (n) log(`Created ${n} preventive maintenance work order${n > 1 ? 's' : ''}.`);
  } catch (e) {
    log(`PM generation failed: ${e.message}`);
  }
}

function backup() {
  try {
    log(`Backup saved: ${path.join(backups.dir, backups.run())}`);
  } catch (e) {
    log(`Backup failed: ${e.message}`);
  }
}

// Runs fn every day at hh:mm in the site's time zone.
function daily(hour, minute, fn) {
  const next = () => setTimeout(() => { fn(); next(); }, msUntilLocalTime(store.timezone(), hour, minute) + 1000).unref();
  next();
}

const line = '─'.repeat(64);
console.log(`\n${line}\n  HLPI Facilities CMMS ${pkg.version}\n${line}`);
console.log(`  On this PC:     http://localhost:${app.port}`);
const lan = lanAddresses();
if (lan.length) {
  console.log('  Phones and other PCs on the same network:');
  for (const a of lan) console.log(`                  http://${a}:${app.port}`);
}
console.log(`  Data folder:    ${dataDir}`);
console.log(`\n  Keep this window open while people use the CMMS.\n  Close it (or press Ctrl+C) to stop the server.\n${line}\n`);

accounts.pruneSessions();
generatePm();
const last = backups.last();
if (!last || Date.now() - Date.parse(last.at) > 20 * 3600000) backup();
daily(0, 30, () => { backup(); accounts.pruneSessions(); });
daily(5, 50, generatePm);

if (args.open) openBrowser(`http://localhost:${app.port}`);

function openBrowser(url) {
  const [cmd, cmdArgs] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  try {
    const child = spawn(cmd, cmdArgs, { detached: true, stdio: 'ignore', windowsVerbatimArguments: true });
    child.on('error', () => {});
    child.unref();
  } catch { /* no browser: the address is printed above */ }
}

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  log('Stopping the server…');
  setTimeout(() => process.exit(0), 3000).unref();
  await app.close();
  process.exit(0);
}
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGBREAK']) process.on(sig, shutdown);
