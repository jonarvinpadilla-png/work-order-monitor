import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { HttpError } from './rules.js';
import { isAdmin } from './access.js';

// Accounts, passwords and sessions. Passwords are stored as scrypt hashes;
// a session is a random token in an HttpOnly cookie, and only its SHA-256
// hash is kept in the database.

const SESSION_DAYS = 30;
const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
const ROLES = ['admin', 'technician', 'requester'];
const LOCK_MINUTES = 15;

function scryptAsync(password, salt, keylen, opts) {
  return new Promise((resolve, reject) => scrypt(password, salt, keylen, opts, (e, key) => (e ? reject(e) : resolve(key))));
}

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password.normalize('NFKC'), salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password, stored) {
  const [alg, N, r, p, salt, hash] = String(stored || '').split('$');
  if (alg !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await scryptAsync(String(password).normalize('NFKC'), Buffer.from(salt, 'base64'), expected.length,
    { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return timingSafeEqual(key, expected);
}

export const hashToken = token => createHash('sha256').update(token).digest('base64url');

export function normalizeEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+$/.test(e) || e.length > 254) throw new HttpError(400, 'Enter a valid email address.');
  return e;
}

export function checkNewPassword(password) {
  if (typeof password !== 'string' || password.length < 8) throw new HttpError(400, 'Use a password of at least 8 characters.');
  if (password.length > 200) throw new HttpError(400, 'That password is too long.');
}

export class Accounts {
  constructor(store) {
    this.store = store;
    this.db = store.db;
    this.attempts = new Map();
    this.dummyHash = null;
  }

  count() {
    return this.db.get('select count(*) as n from users').n;
  }

  profile(id) {
    return this.db.decodeRow('profiles', this.db.get('select * from profiles where id = ?', id));
  }

  // What the app gets after signing in.
  payload(userId) {
    const u = this.db.get('select id, email, must_change_password from users where id = ?', userId);
    return { user: { id: u.id, email: u.email }, profile: this.profile(userId), mustChangePassword: !!u.must_change_password };
  }

  // Creates a login and its profile. The very first account becomes the
  // admin; later ones start as requesters unless an admin picks a role.
  async create({ email, password, full_name, role, mustChange = false }, actor = null) {
    const addr = normalizeEmail(email);
    checkNewPassword(password);
    if (role && !ROLES.includes(role)) throw new HttpError(400, 'Choose a valid role.');
    const hash = await hashPassword(password);
    return this.store.transact(actor, ctx => {
      if (this.db.get('select 1 from users where email = ?', addr)) throw new HttpError(409, 'An account with that email already exists.');
      const id = randomUUID();
      const firstAdmin = !this.db.get("select 1 from profiles where role = 'admin'");
      const name = String(full_name || '').trim().slice(0, 200) || addr.split('@')[0];
      this.db.run('insert into users (id, email, password_hash, must_change_password, created_at) values (?, ?, ?, ?, ?)',
        id, addr, hash, mustChange ? 1 : 0, ctx.now);
      this.db.run('insert into profiles (id, email, full_name, role, created_at) values (?, ?, ?, ?, ?)',
        id, addr, name, firstAdmin ? 'admin' : (role || 'requester'), ctx.now);
      ctx.changed.add('profiles');
      return this.profile(id);
    });
  }

  // ---------------------------------------------------------- sign in

  async signIn(email, password, meta = {}) {
    let addr;
    try {
      addr = normalizeEmail(email);
    } catch {
      throw new HttpError(401, "That email and password don't match an account.");
    }
    this.checkThrottle(addr, meta.ip);
    const u = this.db.get('select id, password_hash from users where email = ?', addr);
    // Hash even for unknown emails so the response time doesn't reveal which exist.
    this.dummyHash ??= await hashPassword(randomBytes(12).toString('hex'));
    const ok = await verifyPassword(String(password ?? ''), u ? u.password_hash : this.dummyHash);
    if (!u || !ok) {
      this.recordFailure(addr, meta.ip);
      throw new HttpError(401, "That email and password don't match an account.");
    }
    this.attempts.delete(`e:${addr}`);
    const profile = this.profile(u.id);
    if (!profile?.active) throw new HttpError(403, 'Your account has been deactivated. Ask a CMMS admin to re-activate it.');
    const token = this.startSession(u.id, meta);
    this.db.run('update users set last_sign_in_at = ? where id = ?', new Date().toISOString(), u.id);
    return token;
  }

  checkThrottle(email, ip) {
    const now = Date.now();
    for (const [key, limit] of [[`e:${email}`, 8], [`i:${ip}`, 40]]) {
      const a = this.attempts.get(key);
      if (a && a.until > now && a.count >= limit) {
        throw new HttpError(429, `Too many sign-in attempts. Wait ${LOCK_MINUTES} minutes, or ask a CMMS admin to reset your password.`);
      }
    }
  }

  recordFailure(email, ip) {
    const now = Date.now();
    if (this.attempts.size > 5000) for (const [k, a] of this.attempts) if (a.until <= now) this.attempts.delete(k);
    for (const key of [`e:${email}`, `i:${ip}`]) {
      const a = this.attempts.get(key);
      if (!a || a.until <= now) this.attempts.set(key, { count: 1, until: now + LOCK_MINUTES * 60000 });
      else a.count++;
    }
  }

  // --------------------------------------------------------- sessions

  startSession(userId, meta = {}) {
    const token = randomBytes(32).toString('base64url');
    const now = new Date();
    this.db.run(`insert into sessions (token_hash, user_id, created_at, last_seen_at, expires_at, user_agent, ip)
                 values (?, ?, ?, ?, ?, ?, ?)`,
      hashToken(token), userId, now.toISOString(), now.toISOString(),
      new Date(now.getTime() + SESSION_DAYS * 86400000).toISOString(),
      String(meta.userAgent || '').slice(0, 300) || null, meta.ip || null);
    return token;
  }

  // The signed-in account for a session token, or null. Sessions slide:
  // each day of use pushes the expiry out again.
  authenticate(token) {
    if (!token || typeof token !== 'string' || token.length > 200) return null;
    const tokenHash = hashToken(token);
    const s = this.db.get('select user_id, last_seen_at, expires_at from sessions where token_hash = ?', tokenHash);
    if (!s) return null;
    const now = Date.now();
    if (Date.parse(s.expires_at) <= now) {
      this.db.run('delete from sessions where token_hash = ?', tokenHash);
      return null;
    }
    const profile = this.profile(s.user_id);
    if (!profile || !profile.active) return null;
    if (now - Date.parse(s.last_seen_at) > 3600000) {
      this.db.run('update sessions set last_seen_at = ?, expires_at = ? where token_hash = ?',
        new Date(now).toISOString(), new Date(now + SESSION_DAYS * 86400000).toISOString(), tokenHash);
    }
    const u = this.db.get('select must_change_password from users where id = ?', s.user_id);
    return { profile, tokenHash, mustChangePassword: !!u?.must_change_password };
  }

  signOut(token) {
    if (token) this.db.run('delete from sessions where token_hash = ?', hashToken(String(token)));
  }

  pruneSessions() {
    this.db.run('delete from sessions where expires_at <= ?', new Date().toISOString());
  }

  // -------------------------------------------------------- passwords

  // Change your own password. After an admin reset the current password
  // isn't asked again (it was just used to sign in).
  async changePassword(auth, currentPassword, newPassword) {
    checkNewPassword(newPassword);
    const u = this.db.get('select id, password_hash, must_change_password from users where id = ?', auth.profile.id);
    if (!u.must_change_password && !(await verifyPassword(String(currentPassword ?? ''), u.password_hash))) {
      throw new HttpError(400, 'Your current password is not right.');
    }
    if (await verifyPassword(newPassword, u.password_hash)) throw new HttpError(400, 'Choose a password that is different from the current one.');
    const hash = await hashPassword(newPassword);
    this.db.tx(() => {
      this.db.run('update users set password_hash = ?, must_change_password = 0 where id = ?', hash, u.id);
      // Sign out every other device.
      this.db.run('delete from sessions where user_id = ? and token_hash <> ?', u.id, auth.tokenHash);
    });
  }

  // Admin: add someone with a temporary password they must change.
  async adminCreate(admin, { email, full_name, role, password }) {
    if (!isAdmin(admin)) throw new HttpError(403, "You don't have permission to do that.");
    return this.create({ email, password, full_name, role: role || 'requester', mustChange: true }, admin);
  }

  // Admin: set a temporary password and sign the person out everywhere.
  async adminResetPassword(admin, userId, password) {
    if (!isAdmin(admin)) throw new HttpError(403, "You don't have permission to do that.");
    checkNewPassword(password);
    if (!this.db.get('select 1 from users where id = ?', userId)) throw new HttpError(404, 'That account no longer exists.');
    const hash = await hashPassword(password);
    this.db.tx(() => {
      this.db.run('update users set password_hash = ?, must_change_password = ? where id = ?', hash, userId === admin.id ? 0 : 1, userId);
      this.db.run('delete from sessions where user_id = ?', userId);
    });
  }
}
