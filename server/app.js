import { createReadStream, rmSync, statSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { isAdmin } from './access.js';
import { HttpError, forbidden } from './rules.js';
import { clearOperationalData, hasDemoData, loadDemo } from './demo.js';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json'
};

const CSP = [
  "default-src 'self'", "img-src 'self' data: blob:", "style-src 'self' 'unsafe-inline'", "font-src 'self' data:",
  "connect-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'"
].join('; ');

// IPv4 addresses other devices on the network can use to reach this PC.
export function lanAddresses() {
  const rank = a => (/^192\.168\./.test(a) ? 0 : /^10\./.test(a) ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(a) ? 2 : /^169\.254\./.test(a) ? 9 : 5);
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) if (a.family === 'IPv4' && !a.internal) out.push(a.address);
  }
  return [...new Set(out)].sort((a, b) => rank(a) - rank(b));
}

// Server-sent events: every open app gets told which tables changed so it
// can refresh them. Only table names are sent, never data.
export class Events {
  constructor(accounts) {
    this.accounts = accounts;
    this.clients = new Set();
    this.timer = setInterval(() => this.ping(), 25000);
    this.timer.unref();
  }

  open(req, res, token) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write('retry: 3000\n\n: connected\n\n');
    const client = { res, token };
    this.clients.add(client);
    req.on('close', () => this.clients.delete(client));
  }

  publish(tables) {
    const msg = `event: change\ndata: ${JSON.stringify({ tables })}\n\n`;
    for (const c of this.clients) c.res.write(msg);
  }

  // Keeps connections alive and drops ones whose session has ended.
  ping() {
    for (const c of this.clients) {
      if (!this.accounts.authenticate(c.token)) {
        c.res.end();
        this.clients.delete(c);
      } else {
        c.res.write(': ping\n\n');
      }
    }
  }

  close() {
    clearInterval(this.timer);
    for (const c of this.clients) c.res.end();
    this.clients.clear();
  }
}

function readCookie(req, name) {
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

function readJson(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) {
      reject(new HttpError(415, 'Send the request as JSON.'));
      req.resume();
      return;
    }
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', chunk => {
      if (failed) return;
      size += chunk.length;
      if (size > limit) {
        failed = true;
        reject(new HttpError(413, 'That is too much data for one request.'));
      } else {
        chunks.push(chunk);
      }
    });
    req.on('end', () => {
      if (failed) return;
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new HttpError(400, 'The request was not valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function hostName(hostHeader) {
  const h = String(hostHeader || '').trim().toLowerCase();
  if (h.startsWith('[')) return h.slice(1, h.indexOf(']'));
  return h.replace(/:\d+$/, '');
}

const isLoopback = addr => /^(127\.|::1$|::ffff:127\.)/.test(addr || '');

export function createApp({ store, accounts, events, backups, distDir, dataDir, port, version = '', allowedHosts = [], remoteSetup = false, startedAt = new Date() }) {
  const cookieName = `hlpi_cmms_${port}`;
  const machine = os.hostname().toLowerCase();
  const extraHosts = allowedHosts.map(h => h.trim().toLowerCase()).filter(Boolean);

  // Blocks DNS-rebinding: only IP addresses, localhost, this PC's name and
  // names an admin listed in CMMS_ALLOWED_HOSTS are answered.
  function hostAllowed(req) {
    const h = hostName(req.headers.host);
    if (!h) return false;
    return h === 'localhost' || net.isIP(h) !== 0 || h === machine || h === `${machine}.local`
      || extraHosts.includes(h) || extraHosts.includes('*');
  }

  // Requests from a browser on the server PC itself.
  function isLocal(req) {
    const h = hostName(req.headers.host);
    return isLoopback(req.socket.remoteAddress) && (h === 'localhost' || h === '127.0.0.1' || h === '::1');
  }

  function sameOrigin(req) {
    if (req.headers['sec-fetch-site'] === 'cross-site') return false;
    const origin = req.headers.origin;
    if (!origin) return true;
    try {
      return new URL(origin).host.toLowerCase() === String(req.headers.host || '').toLowerCase();
    } catch {
      return false;
    }
  }

  const meta = req => ({ ip: req.socket.remoteAddress, userAgent: req.headers['user-agent'] });
  const setSession = (req, token) => {
    const secure = req.socket.encrypted ? '; Secure' : '';
    return { 'Set-Cookie': `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${secure}` };
  };
  const clearSession = { 'Set-Cookie': `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0` };

  const signups = new Map();
  function limitSignups(ip) {
    const now = Date.now();
    const s = signups.get(ip);
    if (s && s.until > now) {
      if (s.count >= 10) throw new HttpError(429, 'Too many new accounts from this device. Try again in an hour.');
      s.count++;
    } else {
      signups.set(ip, { count: 1, until: now + 3600000 });
    }
  }

  function setupInfo(req) {
    const settings = store.settings();
    const users = accounts.count();
    return {
      needsAdmin: users === 0,
      canSetUp: users === 0 && (isLocal(req) || remoteSetup),
      allowSignup: users === 0 || !!settings.allow_signup,
      orgName: settings.org_name,
      version
    };
  }

  function serverInfo() {
    const size = f => { try { return statSync(f).size; } catch { return 0; } };
    const db = path.join(dataDir, 'cmms.db');
    const last = backups.last();
    return {
      version,
      startedAt: startedAt.toISOString(),
      dataDir,
      database: db,
      databaseBytes: size(db) + size(`${db}-wal`),
      backupsDir: backups.dir,
      backupCount: backups.list().length,
      lastBackupAt: last?.at ?? null,
      urls: [`http://localhost:${port}`, ...lanAddresses().map(a => `http://${a}:${port}`)],
      hostname: os.hostname(),
      hasDemoData: hasDemoData(store.db)
    };
  }

  function sendBackup(res) {
    const file = backups.snapshot(path.join(dataDir, 'tmp'));
    const name = `hlpi-cmms-backup-${store.today()}.db`;
    res.writeHead(200, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': statSync(file).size,
      'Cache-Control': 'no-store'
    });
    const stream = createReadStream(file);
    const cleanup = () => rmSync(file, { force: true });
    stream.on('close', cleanup);
    stream.on('error', cleanup);
    stream.pipe(res);
  }

  async function api(req, res, url) {
    const method = req.method;
    const p = url.pathname.slice(4);
    if (method !== 'GET' && method !== 'HEAD' && !sameOrigin(req)) throw forbidden();
    const token = readCookie(req, cookieName);
    const auth = accounts.authenticate(token);
    const user = auth?.profile ?? null;
    const body = () => readJson(req);

    // ---- open to everyone
    if (p === '/setup' && method === 'GET') return send(res, 200, setupInfo(req));
    if (p === '/auth/session' && method === 'GET') {
      return auth ? send(res, 200, accounts.payload(user.id)) : send(res, 401, { error: 'Not signed in.' });
    }
    if (p === '/auth/signin' && method === 'POST') {
      const b = await body();
      const t = await accounts.signIn(b.email, b.password, meta(req));
      const signedIn = accounts.authenticate(t);
      return send(res, 200, accounts.payload(signedIn.profile.id), setSession(req, t));
    }
    if (p === '/auth/signup' && method === 'POST') {
      const b = await body();
      if (accounts.count() === 0) {
        if (!isLocal(req) && !remoteSetup) throw new HttpError(403, `Create the first admin account on the server PC itself: open http://localhost:${port} there.`);
      } else if (!store.settings().allow_signup) {
        throw new HttpError(403, 'New accounts are created by a CMMS admin. Ask them to add you.');
      }
      limitSignups(req.socket.remoteAddress);
      const profile = await accounts.create({ email: b.email, password: b.password, full_name: b.full_name });
      const t = accounts.startSession(profile.id, meta(req));
      return send(res, 201, accounts.payload(profile.id), setSession(req, t));
    }
    if (p === '/auth/signout' && method === 'POST') {
      accounts.signOut(token);
      return send(res, 200, { ok: true }, clearSession);
    }

    // ---- signed in
    if (!auth) return send(res, 401, { error: 'Your session has ended. Sign in again.' });
    if (p === '/auth/password' && method === 'POST') {
      const b = await body();
      await accounts.changePassword(auth, b.current_password, b.new_password);
      return send(res, 200, accounts.payload(user.id));
    }
    if (auth.mustChangePassword) throw new HttpError(403, 'Choose a new password before you continue.');

    if (p === '/events' && method === 'GET') return events.open(req, res, token);

    let m;
    if ((m = /^\/rows\/([a-z_]+)$/.exec(p))) {
      if (method === 'GET') {
        let spec = {};
        const q = url.searchParams.get('q');
        if (q) {
          try { spec = JSON.parse(q); } catch { throw new HttpError(400, 'The query was not valid.'); }
        }
        return send(res, 200, store.select(user, m[1], spec));
      }
      if (method === 'POST') return send(res, 201, store.insert(user, m[1], await body()));
    }
    if ((m = /^\/rows\/([a-z_]+)\/([^/]+)$/.exec(p))) {
      const id = decodeURIComponent(m[2]);
      if (method === 'PATCH') return send(res, 200, store.update(user, m[1], id, await body()));
      if (method === 'DELETE') return send(res, 200, store.remove(user, m[1], id));
    }
    if ((m = /^\/rpc\/([a-z_]+)$/.exec(p)) && method === 'POST') {
      return send(res, 200, store.rpc(user, m[1], await body()) ?? null);
    }

    // ---- admin
    if (p.startsWith('/admin/')) {
      if (!isAdmin(user)) throw forbidden();
      if (p === '/admin/info' && method === 'GET') return send(res, 200, serverInfo());
      if (p === '/admin/users' && method === 'POST') {
        const b = await body();
        const profile = await accounts.adminCreate(user, b);
        return send(res, 201, profile);
      }
      if ((m = /^\/admin\/users\/([0-9a-f-]{36})\/password$/.exec(p)) && method === 'POST') {
        const b = await body();
        await accounts.adminResetPassword(user, m[1], b.password);
        return send(res, 200, { ok: true });
      }
      if (p === '/admin/backup' && method === 'GET') return sendBackup(res);
      if (p === '/admin/backup' && method === 'POST') {
        const name = backups.run();
        return send(res, 200, { name, ...serverInfo() });
      }
      if (p === '/admin/demo' && method === 'POST') {
        await body();
        return send(res, 200, { loaded: loadDemo(store) });
      }
      if (p === '/admin/clear' && method === 'POST') {
        const b = await body();
        if (b.confirm !== 'DELETE') throw new HttpError(400, 'Type DELETE to confirm.');
        backups.run();
        clearOperationalData(store);
        return send(res, 200, { ok: true });
      }
    }
    return send(res, 404, { error: 'Not found.' });
  }

  function serveStatic(req, res, pathname) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method not allowed');
    let rel;
    try {
      rel = decodeURIComponent(pathname);
    } catch {
      return sendText(res, 400, 'Bad request');
    }
    if (rel.includes('\0')) return sendText(res, 400, 'Bad request');
    const root = path.resolve(distDir);
    let file = path.resolve(root, `.${path.posix.normalize(rel)}`);
    if (file !== root && !file.startsWith(root + path.sep)) return sendText(res, 404, 'Not found');
    let st = null;
    try { st = statSync(file); } catch { /* missing */ }
    if (!st || st.isDirectory()) {
      if (path.extname(rel)) return sendText(res, 404, 'Not found');
      file = path.join(root, 'index.html');
      try { st = statSync(file); } catch {
        return sendText(res, 503, 'The web app has not been built yet. Run "npm run build", then restart the server.');
      }
    }
    const immutable = rel.startsWith('/assets/');
    const lastModified = st.mtime.toUTCString();
    if (!immutable && req.headers['if-modified-since'] === lastModified) {
      res.writeHead(304);
      return res.end();
    }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
      'Last-Modified': lastModified
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  }

  return async function handler(req, res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', CSP);
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return sendText(res, 400, 'Bad request');
    }
    if (!hostAllowed(req)) {
      return sendText(res, 421, `This address (${hostName(req.headers.host)}) is not on the CMMS server's list of allowed names. `
        + 'Use the IP address shown in the server window, or add the name to CMMS_ALLOWED_HOSTS.');
    }
    if (!url.pathname.startsWith('/api/')) return serveStatic(req, res, url.pathname);
    try {
      await api(req, res, url);
    } catch (e) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (e.status && e.status < 500) return send(res, e.status, { error: e.message });
      console.error(`[${new Date().toISOString()}] ${req.method} ${url.pathname} failed:`, e);
      return send(res, 500, { error: 'Something went wrong on the CMMS server. Try again, and tell your admin if it keeps happening.' });
    }
  };
}
