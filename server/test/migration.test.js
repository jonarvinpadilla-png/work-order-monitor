// Upgrading databases made by earlier versions, and the settings added since.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Database, SCHEMA_VERSION } from '../db.js';
import { Store } from '../rules.js';
import { Accounts } from '../auth.js';

// A database exactly as the first release left it: schema.sql, version 1.
function versionOneDatabase(dir) {
  const file = path.join(dir, 'cmms.db');
  const raw = new DatabaseSync(file);
  raw.exec(readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
  raw.exec("insert into sites (id, code, name) values ('10000000-0000-0000-0000-000000000001', 'PLD', 'Plaridel DC')");
  raw.exec('PRAGMA user_version = 1');
  raw.close();
  return file;
}

test('a version 1 database upgrades in place, keeps its data and is backed up first', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cmms-upgrade-'));
  try {
    const file = versionOneDatabase(dir);
    const db = new Database(file);
    assert.equal(db.get('PRAGMA user_version').user_version, SCHEMA_VERSION);
    assert.ok(db.columns('app_settings').has('label_base_url'));
    assert.equal(db.get('select name from sites').name, 'Plaridel DC');
    const copies = readdirSync(path.join(dir, 'backups'));
    assert.ok(copies.includes(`cmms-before-upgrade-v${SCHEMA_VERSION}.db`), copies.join(','));
    db.close();

    // Opening an up-to-date database changes nothing and makes no new copy.
    new Database(file).close();
    assert.equal(readdirSync(path.join(dir, 'backups')).length, copies.length);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a database from a newer version is left alone', () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cmms-newer-'));
  try {
    const file = path.join(dir, 'cmms.db');
    const raw = new DatabaseSync(file);
    raw.exec('PRAGMA user_version = 99');
    raw.close();
    assert.throws(() => new Database(file), /newer version/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the QR label address is checked, tidied and admin-only', async () => {
  const db = new Database(':memory:');
  const store = new Store(db);
  const accounts = new Accounts(store);
  const admin = await accounts.create({ email: 'boss@hlpi.test', password: 'password-1' });
  let tech = await accounts.create({ email: 'tech@hlpi.test', password: 'password-2' });
  store.update(admin, 'profiles', tech.id, { role: 'technician' });
  tech = accounts.profile(tech.id);

  assert.equal(store.update(admin, 'app_settings', 1, { label_base_url: '192.168.1.20:8080/' }).label_base_url, 'http://192.168.1.20:8080');
  assert.equal(store.update(admin, 'app_settings', 1, { label_base_url: 'https://CMMS.havi.local' }).label_base_url, 'https://cmms.havi.local');
  assert.throws(() => store.update(admin, 'app_settings', 1, { label_base_url: 'http://192.168.1.20:8080/app' }), /just the address/);
  assert.throws(() => store.update(admin, 'app_settings', 1, { label_base_url: 'cmms pc' }), /just the address/);
  assert.throws(() => store.update(tech, 'app_settings', 1, { label_base_url: 'http://10.0.0.5:8080' }), /permission/);
  assert.equal(store.select(tech, 'app_settings')[0].label_base_url, 'https://cmms.havi.local');
  assert.equal(store.update(admin, 'app_settings', 1, { label_base_url: '' }).label_base_url, null);
  db.close();
});
