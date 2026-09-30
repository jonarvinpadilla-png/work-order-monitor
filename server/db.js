import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { seedReferenceData } from './reference.js';
import { isValidDate } from './time.js';

// Changes after the first release, oldest first. Entry n upgrades a
// version n+1 database to version n+2. Never edit one that has shipped;
// add a new entry instead.
const MIGRATIONS = [
  // 2: the address printed on QR labels (e.g. http://192.168.1.20:8080)
  db => db.raw.exec('alter table app_settings add column label_base_url TEXT')
];

export const SCHEMA_VERSION = 1 + MIGRATIONS.length;

// A value the client sent that doesn't fit the column. Shown to the user.
export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_TEXT = 20000;

// Column kinds come from the declared types in schema.sql.
function kindOf(declared) {
  const t = (declared || '').toUpperCase();
  if (t === 'UUID') return { kind: 'uuid' };
  if (t === 'BOOLEAN') return { kind: 'bool' };
  if (t === 'DATE') return { kind: 'date' };
  if (t === 'TIMESTAMPTZ') return { kind: 'timestamp' };
  if (t === 'JSONB') return { kind: 'json' };
  if (t === 'TEXT[]') return { kind: 'textarray' };
  if (t === 'INTEGER') return { kind: 'int' };
  const num = /^NUMERIC\((\d+),\s*(\d+)\)$/.exec(t);
  if (num) return { kind: 'numeric', scale: Number(num[2]) };
  if (t === '') return { kind: 'any' };
  return { kind: 'text' };
}

// Round half away from zero without binary surprises (1.005 → 1.01).
export function roundTo(n, scale) {
  const r = Math.round(Number(`${Math.abs(n)}e${scale}`));
  return Math.sign(n) * Number(`${r}e-${scale}`) || 0;
}

const label = col => col.replace(/_id$/, '').replace(/_/g, ' ');

// Converts what the client sent into the JS value the rules work with.
// Empty strings mean "no value" for everything except text.
export function coerce(col, meta, value) {
  if (value === undefined || value === null) return null;
  const { kind, scale } = meta;
  if (value === '' && kind !== 'text' && kind !== 'any') return null;
  switch (kind) {
    case 'uuid':
      if (typeof value === 'string' && UUID_RE.test(value)) return value.toLowerCase();
      throw new ValidationError(`The ${label(col)} isn't valid.`);
    case 'bool':
      if (value === true || value === 1 || value === 'true') return true;
      if (value === false || value === 0 || value === 'false') return false;
      throw new ValidationError(`The ${label(col)} must be yes or no.`);
    case 'int': {
      const n = Number(value);
      if (typeof value === 'boolean' || !Number.isInteger(n)) throw new ValidationError(`The ${label(col)} must be a whole number.`);
      return n;
    }
    case 'numeric': {
      const n = Number(value);
      if (typeof value === 'boolean' || typeof value === 'object' || !Number.isFinite(n)) throw new ValidationError(`The ${label(col)} must be a number.`);
      return roundTo(n, scale);
    }
    case 'date': {
      const s = typeof value === 'string' ? value.slice(0, 10) : '';
      if (!isValidDate(s)) throw new ValidationError(`The ${label(col)} must be a date (YYYY-MM-DD).`);
      return s;
    }
    case 'timestamp': {
      const d = typeof value === 'string' || typeof value === 'number' || value instanceof Date ? new Date(value) : new Date(NaN);
      if (Number.isNaN(d.getTime())) throw new ValidationError(`The ${label(col)} must be a date and time.`);
      return d.toISOString();
    }
    case 'json':
      if (typeof value !== 'object') throw new ValidationError(`The ${label(col)} must be a list.`);
      if (JSON.stringify(value).length > 200000) throw new ValidationError(`The ${label(col)} is too long.`);
      return value;
    case 'textarray':
      if (!Array.isArray(value) || value.some(v => typeof v !== 'string')) throw new ValidationError(`The ${label(col)} must be a list of names.`);
      return value;
    case 'text': {
      if (typeof value === 'object') throw new ValidationError(`The ${label(col)} must be text.`);
      const s = String(value);
      if (s.length > MAX_TEXT) throw new ValidationError(`The ${label(col)} is too long.`);
      return s;
    }
    default:
      return value;
  }
}

// JS value → what SQLite stores.
function encode(meta, value) {
  if (value === null || value === undefined) return null;
  switch (meta.kind) {
    case 'bool': return value ? 1 : 0;
    case 'json':
    case 'textarray': return JSON.stringify(value);
    default: return value;
  }
}

// What SQLite stored → JS value for the API.
function decode(meta, value) {
  if (value === null || value === undefined || !meta) return value ?? null;
  switch (meta.kind) {
    case 'bool': return value === 1 || value === true;
    case 'json':
    case 'textarray': return typeof value === 'string' ? JSON.parse(value) : value;
    default: return value;
  }
}

export class Database {
  constructor(file) {
    this.file = file;
    this.raw = new DatabaseSync(file);
    this.statements = new Map();
    this.meta = new Map();
    this.depth = 0;
    if (file !== ':memory:') this.raw.exec('PRAGMA journal_mode = WAL');
    this.raw.exec('PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  // New databases get schema.sql (version 1) and then every migration;
  // existing ones get the migrations they are missing, after a backup copy.
  migrate() {
    let version = this.get('PRAGMA user_version').user_version;
    if (version > SCHEMA_VERSION) {
      throw new Error(`This database was saved by a newer version of HLPI Facilities CMMS (schema ${version}). Install the newer version to open it.`);
    }
    if (version === SCHEMA_VERSION) return;
    if (version > 0 && this.file !== ':memory:') {
      const dir = path.join(path.dirname(this.file), 'backups');
      mkdirSync(dir, { recursive: true });
      let copy = path.join(dir, `cmms-before-upgrade-v${SCHEMA_VERSION}.db`);
      if (existsSync(copy)) copy = copy.replace(/\.db$/, `-${Date.now()}.db`);
      this.backupTo(copy);
    }
    this.tx(() => {
      if (version === 0) {
        this.raw.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
        seedReferenceData(this);
        version = 1;
      }
      for (let v = version; v < SCHEMA_VERSION; v++) MIGRATIONS[v - 1](this);
      this.raw.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
    });
    this.meta.clear();
  }

  prepare(sql) {
    let st = this.statements.get(sql);
    if (!st) {
      st = this.raw.prepare(sql);
      if (this.statements.size > 400) this.statements.delete(this.statements.keys().next().value);
      this.statements.set(sql, st);
    }
    return st;
  }

  all(sql, ...params) { return this.prepare(sql).all(...params); }
  get(sql, ...params) { return this.prepare(sql).get(...params); }
  run(sql, ...params) { return this.prepare(sql).run(...params); }
  exec(sql) { this.raw.exec(sql); }

  // One write transaction. Nested calls join the outer one. Everything in
  // this app is synchronous, so a transaction never interleaves with another.
  tx(fn) {
    if (this.depth > 0) return fn();
    this.raw.exec('BEGIN IMMEDIATE');
    this.depth = 1;
    try {
      const result = fn();
      this.raw.exec('COMMIT');
      return result;
    } catch (e) {
      try { this.raw.exec('ROLLBACK'); } catch { /* already rolled back */ }
      throw e;
    } finally {
      this.depth = 0;
    }
  }

  // Column name → { kind, scale, notnull, hasDefault } for a table or view.
  columns(table) {
    let cols = this.meta.get(table);
    if (!cols) {
      cols = new Map();
      for (const c of this.all(`PRAGMA table_info("${table}")`)) {
        cols.set(c.name, { ...kindOf(c.type), notnull: !!c.notnull, hasDefault: c.dflt_value !== null, pk: !!c.pk });
      }
      if (!cols.size) throw new Error(`Unknown table ${table}`);
      this.meta.set(table, cols);
    }
    return cols;
  }

  decodeRow(table, row) {
    if (!row) return null;
    const cols = this.columns(table);
    const out = {};
    for (const k of Object.keys(row)) out[k] = decode(cols.get(k), row[k]);
    return out;
  }

  encodeValue(table, col, value) {
    return encode(this.columns(table).get(col), value);
  }

  // Tables with a foreign key pointing at `table` (to notify on cascades).
  referencing(table) {
    if (!this.refs) {
      this.refs = new Map();
      const tables = this.all("select name from sqlite_schema where type = 'table' and name not like 'sqlite_%'").map(r => r.name);
      for (const t of tables) {
        for (const fk of this.all(`PRAGMA foreign_key_list("${t}")`)) {
          if (!this.refs.has(fk.table)) this.refs.set(fk.table, new Set());
          this.refs.get(fk.table).add(t);
        }
      }
    }
    return [...(this.refs.get(table) || [])];
  }

  // Consistent copy of the whole database to a new file.
  backupTo(file) {
    this.raw.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  }

  close() {
    this.statements.clear();
    this.raw.close();
  }
}
