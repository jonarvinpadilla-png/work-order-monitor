import { existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { localStamp } from './time.js';

// Copies of the database in data/backups. The server makes one every night
// and keeps the newest 14. To restore, stop the server and copy a backup
// over data/cmms.db (see the README).
export class Backups {
  constructor(db, dir, { keep = 14, timezone = () => 'Asia/Manila' } = {}) {
    this.db = db;
    this.dir = dir;
    this.keep = keep;
    this.timezone = timezone;
  }

  list() {
    let names;
    try {
      names = readdirSync(this.dir).filter(n => /^cmms-.*\.db$/.test(n));
    } catch {
      return [];
    }
    return names
      .map(name => {
        const st = statSync(path.join(this.dir, name));
        return { name, bytes: st.size, at: st.mtime.toISOString() };
      })
      .sort((a, b) => (a.at < b.at ? 1 : -1));
  }

  last() {
    return this.list()[0] || null;
  }

  // Writes a new backup and prunes old ones. Returns the file name.
  run() {
    mkdirSync(this.dir, { recursive: true });
    const stamp = localStamp(this.timezone());
    let name = `cmms-${stamp}.db`;
    for (let n = 2; existsSync(path.join(this.dir, name)); n++) name = `cmms-${stamp}-${n}.db`;
    const tmp = path.join(this.dir, `.${name}.partial`);
    rmSync(tmp, { force: true });
    this.db.backupTo(tmp);
    renameSync(tmp, path.join(this.dir, name));
    for (const old of this.list().slice(this.keep)) rmSync(path.join(this.dir, old.name), { force: true });
    return name;
  }

  // A one-off copy for downloading; the caller deletes it afterwards.
  snapshot(tmpDir) {
    mkdirSync(tmpDir, { recursive: true });
    const file = path.join(tmpDir, `download-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
    this.db.backupTo(file);
    return file;
  }
}
