// Builds the Windows package: a folder people unzip and run, with nothing
// else to install. It holds a portable Node.js runtime (checked against
// nodejs.org's published SHA-256), the server and the built web app.
//
//   npm run build && npm run package            → release/HLPI-CMMS-<version>-win-x64.zip
//   npm run package -- --node 24.21.0           → pin the Node.js version
//
// Downloads are cached in .cache/ so repeat builds work offline.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { unzipSync, zipSync } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
const { values: args } = parseArgs({ options: { node: { type: 'string' }, major: { type: 'string', default: '24' } } });
const NAME = 'HLPI-CMMS';
const PLATFORM = 'win-x64';

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

// The newest release of the chosen Node.js major line (an LTS line).
async function nodeVersion() {
  if (args.node) return args.node.replace(/^v/, '');
  const index = JSON.parse((await download('https://nodejs.org/dist/index.json')).toString('utf8'));
  const hit = index.find(r => r.version.startsWith(`v${args.major}.`) && r.files.includes('win-x64-zip'));
  if (!hit) throw new Error(`No Node.js ${args.major}.x release for Windows found.`);
  return hit.version.slice(1);
}

async function nodeRuntime(version) {
  const cache = path.join(root, '.cache', 'node');
  mkdirSync(cache, { recursive: true });
  const file = `node-v${version}-${PLATFORM}.zip`;
  const local = path.join(cache, file);
  const base = `https://nodejs.org/dist/v${version}`;
  const sums = (await download(`${base}/SHASUMS256.txt`)).toString('utf8');
  const expected = sums.split('\n').find(l => l.trim().endsWith(` ${file}`))?.split(/\s+/)[0];
  if (!expected) throw new Error(`${file} is not listed in SHASUMS256.txt`);
  if (!existsSync(local) || sha256(readFileSync(local)) !== expected) {
    console.log(`Downloading ${file}…`);
    writeFileSync(local, await download(`${base}/${file}`));
  }
  const zip = readFileSync(local);
  if (sha256(zip) !== expected) throw new Error(`Checksum mismatch for ${file}`);
  const dir = `node-v${version}-${PLATFORM}/`;
  const files = unzipSync(new Uint8Array(zip), { filter: f => f.name === `${dir}node.exe` || f.name === `${dir}LICENSE` });
  return { exe: files[`${dir}node.exe`], license: files[`${dir}LICENSE`] };
}

const sha256 = buf => createHash('sha256').update(buf).digest('hex');
const crlf = text => text.replace(/\r?\n/g, '\r\n');

function walk(dir, prefix, out, skip = () => false) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = `${prefix}/${name}`;
    if (skip(rel)) continue;
    if (statSync(full).isDirectory()) walk(full, rel, out, skip);
    else out[rel] = readFileSync(full);
  }
  return out;
}

const startBat = crlf(`@echo off
setlocal
title HLPI Facilities CMMS
cd /d "%~dp0"
rem Extra names people use to reach this PC, comma-separated (e.g. cmms.havi.local):
rem set CMMS_ALLOWED_HOSTS=
"%~dp0runtime\\node.exe" --disable-warning=ExperimentalWarning "%~dp0app\\server\\index.js" --data "%~dp0data" --port 8080 --open
echo.
echo The CMMS server has stopped. Close this window, or press a key.
pause >nul
`);

const readme = version => crlf(`HLPI Facilities CMMS ${pkg.version}
${'='.repeat(21 + pkg.version.length)}

Maintenance management for facilities and material handling equipment.
This PC runs the CMMS; everyone else opens it in a browser on the site
network. Nothing else needs to be installed and no internet is needed.


START IT
--------
1. Unzip this folder somewhere permanent on a PC that stays on during
   every shift, for example C:\\HLPI-CMMS.
   Tip: before unzipping, right-click the zip > Properties > Unblock, so
   Windows doesn't warn about each file.

2. Double-click "Start HLPI CMMS". A black window opens and your browser
   shows the CMMS. The first time, Windows may ask:
     - "Do you want to run this file?" or "Windows protected your PC":
       choose Run (or More info > Run anyway).
     - Windows Defender Firewall about "Node.js JavaScript Runtime":
       tick Private networks and click Allow access (needs admin rights).
       This is what lets phones and other PCs reach the CMMS.

3. Create the admin account. This only works on this PC. Then add your
   team under Settings > Users & roles, or load the sample data from the
   dashboard to look around first.

4. Keep the black window open. Closing it stops the CMMS for everyone.


PHONES AND OTHER PCs
--------------------
The black window lists addresses such as http://192.168.1.20:8080.
Open one on any phone or PC connected to the same network (Settings >
General shows them too). Ask IT to reserve a fixed IP address for this
PC so the address never changes, then bookmark it or add it to the
phones' home screens.


QR LABELS
---------
Print QR stickers under Assets > QR labels (or "QR label" on an asset).
Scanning one with a phone camera opens that unit: report a problem, run
the pre-use check, or (technicians) start a work order. Labels for rooms
and areas are under the Places tab. Set the address phones use under
Settings > General before printing: labels stop working if it changes.


YOUR DATA
---------
Everything is in the "data" folder next to this file:
  data\\cmms.db       the database
  data\\backups\\      a copy made every night at 00:30 (newest 14 kept)
Copy the backups to another drive or a shared folder regularly. Admins can
also download a copy from Settings > General.

To restore a backup: close the black window, delete data\\cmms.db-wal and
data\\cmms.db-shm if they exist, copy the backup file over data\\cmms.db,
then start the CMMS again.


UPDATING
--------
Close the black window, then unzip the new version over this folder and
replace the files when asked. The "data" folder is not in the zip, so your
records are kept.


START AUTOMATICALLY WITH WINDOWS (optional)
-------------------------------------------
Task Scheduler > Create Task:
  General:  Run whether user is logged on or not
  Triggers: At startup
  Actions:  Start a program
            Program:   <this folder>\\runtime\\node.exe
            Arguments: app\\server\\index.js --data data --port 8080
            Start in:  <this folder>
Then use the CMMS from a browser as usual; there is no black window.


SETTINGS
--------
Port: edit "Start HLPI CMMS.bat" and change --port 8080.
Other names: if IT gives this PC a name like cmms.havi.local, add it to
CMMS_ALLOWED_HOSTS in "Start HLPI CMMS.bat" (remove the "rem").


INSIDE THIS FOLDER
------------------
runtime\\   Node.js ${version} (https://nodejs.org), MIT licence
app\\       the CMMS server and web app
LICENSES\\  licences of the bundled software and fonts
`);

async function main() {
  if (!existsSync(path.join(root, 'dist', 'index.html'))) throw new Error('Build the web app first: npm run build');
  const version = await nodeVersion();
  console.log(`Packaging ${NAME} ${pkg.version} with Node.js ${version} (${PLATFORM})`);
  const node = await nodeRuntime(version);

  const top = `${NAME}`;
  const files = {
    [`${top}/Start HLPI CMMS.bat`]: Buffer.from(startBat),
    [`${top}/README.txt`]: Buffer.from(readme(version)),
    [`${top}/runtime/node.exe`]: node.exe,
    [`${top}/runtime/LICENSE`]: node.license,
    [`${top}/app/package.json`]: Buffer.from(JSON.stringify({ name: pkg.name, version: pkg.version, private: true, type: 'module' }, null, 2) + '\n')
  };
  walk(path.join(root, 'server'), `${top}/app/server`, files, rel => rel.includes('/test'));
  walk(path.join(root, 'dist'), `${top}/app/dist`, files);
  const licenses = {
    'react': 'react/LICENSE', 'react-dom': 'react-dom/LICENSE', 'scheduler': 'scheduler/LICENSE',
    'atkinson-hyperlegible-font (OFL)': '@fontsource/atkinson-hyperlegible/LICENSE',
    'barlow-condensed-font (OFL)': '@fontsource/barlow-condensed/LICENSE',
    'jetbrains-mono-font (OFL)': '@fontsource/jetbrains-mono/LICENSE'
  };
  for (const [name, rel] of Object.entries(licenses)) {
    const file = path.join(root, 'node_modules', rel);
    if (existsSync(file)) files[`${top}/LICENSES/${name}.txt`] = readFileSync(file);
  }
  // qrcode-generator ships its MIT notice in the source header, not a file.
  files[`${top}/LICENSES/qrcode-generator.txt`] = Buffer.from(crlf(`QR Code Generator for JavaScript
Copyright (c) 2009 Kazuhiko Arase
URL: http://www.d-project.com/

Licensed under the MIT license:

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

The word "QR Code" is registered trademark of DENSO WAVE INCORPORATED
  http://www.denso-wave.com/qrcode/faqpatent-e.html
`));

  const outDir = path.join(root, 'release');
  mkdirSync(outDir, { recursive: true });
  const zipName = `${NAME}-${pkg.version}-${PLATFORM}.zip`;
  const entries = Object.fromEntries(Object.entries(files).map(([k, v]) => [k, [new Uint8Array(v), { level: 6 }]]));
  const zipped = zipSync(entries);
  writeFileSync(path.join(outDir, zipName), zipped);

  // Also leave the unzipped folder, for CI to upload as the download.
  const folder = path.join(outDir, NAME);
  rmSync(folder, { recursive: true, force: true });
  for (const [rel, data] of Object.entries(files)) {
    const dest = path.join(outDir, rel);
    mkdirSync(path.dirname(dest), { recursive: true });
    writeFileSync(dest, data);
  }
  console.log(`Wrote release/${zipName} (${(zipped.length / 1048576).toFixed(1)} MB) and release/${NAME}/`);
}

main().catch(e => {
  console.error(e.message);
  process.exit(1);
});
