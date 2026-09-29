// The web server end to end: accounts, sessions, the rows API, live
// updates, admin tools, sample data and the security checks.
import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { startServer } from '../server.js';

let app;
let dir;
let base;

before(async () => {
  dir = mkdtempSync(path.join(os.tmpdir(), 'cmms-test-'));
  const dist = path.join(dir, 'dist');
  mkdirSync(path.join(dist, 'assets'), { recursive: true });
  writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>HLPI</title>');
  writeFileSync(path.join(dist, 'assets', 'app-123.js'), 'console.log(1)');
  app = await startServer({ dataDir: path.join(dir, 'data'), distDir: dist, port: 0, host: '127.0.0.1', version: 'test' });
  base = `http://127.0.0.1:${app.port}`;
});

after(async () => {
  await app.close();
  rmSync(dir, { recursive: true, force: true });
});

// Raw HTTP so tests can set headers fetch() won't (Host, Origin).
function request(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(base + url, { method, headers }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

// A browser-like client that keeps its session cookie.
function client(host) {
  let cookie = '';
  async function call(method, url, body, headers = {}) {
    const res = await request(method, url, {
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(host ? { Host: host } : {}),
        ...headers
      },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const set = res.headers['set-cookie']?.[0];
    if (set) cookie = set.split(';')[0].endsWith('=') ? '' : set.split(';')[0];
    const text = res.body.toString('utf8');
    const data = (res.headers['content-type'] || '').includes('json') ? JSON.parse(text) : text;
    return { status: res.status, data, headers: res.headers };
  }
  return {
    get: url => call('GET', url),
    post: (url, body = {}, headers) => call('POST', url, body, headers),
    patch: (url, body) => call('PATCH', url, body),
    del: url => call('DELETE', url),
    get cookie() { return cookie; }
  };
}

const q = spec => `?q=${encodeURIComponent(JSON.stringify(spec))}`;
const admin = client();
const tech = client();
const op = client();

test('first run: the admin account is created on the server PC', async () => {
  const setup = await admin.get('/api/setup');
  assert.equal(setup.status, 200);
  assert.equal(setup.data.needsAdmin, true);
  assert.equal(setup.data.canSetUp, true);

  // From another device the first admin can't be created (Host is an IP).
  const remote = client('192.168.1.50');
  const denied = await remote.post('/api/auth/signup', { email: 'x@hlpi.test', password: 'password-x' });
  assert.equal(denied.status, 403);
  assert.match(denied.data.error, /server PC/);

  const res = await admin.post('/api/auth/signup', { email: 'Jon@HLPI.test', password: 'admin-pass-1', full_name: 'Jon Padilla' });
  assert.equal(res.status, 201);
  assert.equal(res.data.profile.role, 'admin');
  assert.equal(res.data.user.email, 'jon@hlpi.test');
  assert.match(admin.cookie, /^hlpi_cmms_\d+=/);
  const again = await admin.get('/api/auth/session');
  assert.equal(again.status, 200);
  assert.equal(again.data.profile.full_name, 'Jon Padilla');
});

test('sign-up, sign-in, throttling and sign-out', async () => {
  const s = await tech.post('/api/auth/signup', { email: 'ben@hlpi.test', password: 'tech-pass-1', full_name: 'Ben Tech' });
  assert.equal(s.status, 201);
  assert.equal(s.data.profile.role, 'requester');
  const r = await op.post('/api/auth/signup', { email: 'rosa@hlpi.test', password: 'op-pass-12', full_name: 'Rosa Ops' });
  assert.equal(r.data.profile.role, 'requester');

  const promoted = await admin.patch(`/api/rows/profiles/${s.data.user.id}`, { role: 'technician' });
  assert.equal(promoted.status, 200);
  assert.equal(promoted.data.role, 'technician');

  const dup = await client().post('/api/auth/signup', { email: 'ROSA@hlpi.test', password: 'whatever-1' });
  assert.equal(dup.status, 409);
  const short = await client().post('/api/auth/signup', { email: 'new@hlpi.test', password: 'short' });
  assert.equal(short.status, 400);

  const stranger = client();
  const wrong = await stranger.post('/api/auth/signin', { email: 'rosa@hlpi.test', password: 'nope-nope' });
  assert.equal(wrong.status, 401);
  assert.match(wrong.data.error, /don't match/);
  const unknown = await stranger.post('/api/auth/signin', { email: 'nobody@hlpi.test', password: 'nope-nope' });
  assert.equal(unknown.status, 401);
  assert.equal(unknown.data.error, wrong.data.error);

  for (let i = 0; i < 7; i++) await stranger.post('/api/auth/signin', { email: 'rosa@hlpi.test', password: 'nope-nope' });
  const locked = await stranger.post('/api/auth/signin', { email: 'rosa@hlpi.test', password: 'op-pass-12' });
  assert.equal(locked.status, 429);
  app.accounts.attempts.clear();

  const other = client();
  const ok = await other.post('/api/auth/signin', { email: 'rosa@hlpi.test', password: 'op-pass-12' });
  assert.equal(ok.status, 200);
  assert.equal((await other.get('/api/auth/session')).status, 200);
  await other.post('/api/auth/signout');
  assert.equal((await other.get('/api/auth/session')).status, 401);
  assert.equal((await other.get('/api/rows/work_orders')).status, 401);
});

test('self sign-up can be turned off', async () => {
  await admin.patch('/api/rows/app_settings/1', { allow_signup: false });
  const res = await client().post('/api/auth/signup', { email: 'late@hlpi.test', password: 'late-pass-1' });
  assert.equal(res.status, 403);
  assert.equal((await client().get('/api/setup')).data.allowSignup, false);
  await admin.patch('/api/rows/app_settings/1', { allow_signup: true });
});

test('security checks: host names, cross-site requests and JSON only', async () => {
  const evil = await client('cmms.attacker.example').get('/');
  assert.equal(evil.status, 421);
  const cross = await admin.post('/api/rows/sites', { code: 'X', name: 'X' }, { Origin: 'http://evil.example' });
  assert.equal(cross.status, 403);
  const form = await fetch(`${base}/api/auth/signin`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'email=a&password=b' });
  assert.equal(form.status, 415);
  const page = await fetch(`${base}/`);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.equal((await op.get('/api/rows/users')).status, 404);
  assert.equal((await op.get('/api/rows/sessions')).status, 404);
  const bad = await admin.get(`/api/rows/assets${q({ order: [['code; drop table assets', 'asc']] })}`);
  assert.equal(bad.status, 400);
  for (const odd of ['null', '5', '[]', '{"order":[5]}', '{"eq":"x"}', '{"eq":{"__proto__":1}}', '{"limit":"lots"}', 'not json']) {
    const r = await admin.get(`/api/rows/assets?q=${encodeURIComponent(odd)}`);
    assert.ok(r.status === 200 || r.status === 400, `${odd} gave ${r.status}`);
  }
  const proto = await admin.post('/api/rows/sites', JSON.parse('{"code":"X1","name":"X","__proto__":{"admin":true}}'));
  assert.equal(proto.status, 400);
});

test('the rows API applies roles and rules', async () => {
  const site = await admin.post('/api/rows/sites', { code: 'pld', name: 'Plaridel DC' });
  assert.equal(site.status, 201);
  const asset = await tech.post('/api/rows/assets', { name: 'Dock Leveler 1', site_id: site.data.id });
  assert.equal(asset.status, 201);
  assert.match(asset.data.code, /^AST-\d{4}$/);

  const req = await op.post('/api/rows/work_orders', { title: 'Leveler stuck', status: 'Requested', asset_id: asset.data.id, priority: 'High' });
  assert.equal(req.status, 201);
  assert.match(req.data.code, /^WO-\d{4}-\d{4}$/);
  assert.equal(req.data.asset_down, false);

  const mine = await op.get('/api/rows/work_orders');
  assert.equal(mine.data.length, 1);
  assert.equal((await op.get('/api/rows/parts')).data.length, 0);
  const tasks = await op.get(`/api/rows/wo_activity${q({ eq: { work_order_id: req.data.id }, order: [['created_at', 'asc'], ['id', 'asc']] })}`);
  assert.equal(tasks.data[0].body, 'Request submitted');

  const approve = await tech.patch(`/api/rows/work_orders/${req.data.id}`, { status: 'Open' });
  assert.equal(approve.status, 400);
  assert.match(approve.data.error, /Only an admin can approve/);
  const approved = await admin.patch(`/api/rows/work_orders/${req.data.id}`, { status: 'Open' });
  assert.equal(approved.data.status, 'Open');

  const gone = await op.patch(`/api/rows/work_orders/${req.data.id}`, { title: 'x' });
  assert.equal(gone.status, 404);
  const pm = await tech.post('/api/rpc/generate_pm_work_orders', {});
  assert.equal(pm.status, 200);
  assert.equal(pm.data, 0);
  const denied = await op.post('/api/rpc/generate_pm_work_orders', {});
  assert.equal(denied.status, 400);
});

test('admins add people with a temporary password they must change', async () => {
  const created = await admin.post('/api/admin/users', { email: 'mark@hlpi.test', full_name: 'Mark Tech', role: 'technician', password: 'temp-pass-1' });
  assert.equal(created.status, 201);
  assert.equal(created.data.role, 'technician');

  const mark = client();
  const signin = await mark.post('/api/auth/signin', { email: 'mark@hlpi.test', password: 'temp-pass-1' });
  assert.equal(signin.data.mustChangePassword, true);
  const blocked = await mark.get('/api/rows/work_orders');
  assert.equal(blocked.status, 403);
  assert.match(blocked.data.error, /new password/);
  const same = await mark.post('/api/auth/password', { new_password: 'temp-pass-1' });
  assert.equal(same.status, 400);
  const changed = await mark.post('/api/auth/password', { new_password: 'my-own-pass-1' });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.mustChangePassword, false);
  assert.equal((await mark.get('/api/rows/work_orders')).status, 200);

  // A normal change needs the current password and signs out other devices.
  const laptop = client();
  await laptop.post('/api/auth/signin', { email: 'mark@hlpi.test', password: 'my-own-pass-1' });
  const wrong = await mark.post('/api/auth/password', { current_password: 'guess-guess', new_password: 'another-pass-1' });
  assert.equal(wrong.status, 400);
  const ok = await mark.post('/api/auth/password', { current_password: 'my-own-pass-1', new_password: 'another-pass-1' });
  assert.equal(ok.status, 200);
  assert.equal((await mark.get('/api/auth/session')).status, 200);
  assert.equal((await laptop.get('/api/auth/session')).status, 401);

  // An admin reset signs them out everywhere and forces a new password.
  const reset = await admin.post(`/api/admin/users/${created.data.id}/password`, { password: 'reset-pass-1' });
  assert.equal(reset.status, 200);
  assert.equal((await mark.get('/api/auth/session')).status, 401);
  const back = await mark.post('/api/auth/signin', { email: 'mark@hlpi.test', password: 'reset-pass-1' });
  assert.equal(back.data.mustChangePassword, true);

  // Non-admins can't use the admin tools.
  assert.equal((await tech.post('/api/admin/users', { email: 'z@hlpi.test', password: 'zzzz-zzzz' })).status, 403);
  assert.equal((await tech.get('/api/admin/info')).status, 403);

  // Deactivated accounts are signed out straight away.
  await admin.patch(`/api/rows/profiles/${created.data.id}`, { active: false });
  assert.equal((await mark.get('/api/auth/session')).status, 401);
  const again = await mark.post('/api/auth/signin', { email: 'mark@hlpi.test', password: 'reset-pass-1' });
  assert.equal(again.status, 403);
});

test('live updates tell open apps which tables changed', async () => {
  const received = new Promise((resolve, reject) => {
    const req = http.get(`${base}/api/events`, { headers: { Cookie: op.cookie } }, res => {
      assert.equal(res.statusCode, 200);
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', chunk => {
        buf += chunk;
        if (buf.includes(': connected')) {
          buf = buf.slice(buf.indexOf(': connected') + 11);
          admin.post('/api/rows/sites', { code: 'SEC', name: 'Second DC' }).catch(reject);
        }
        const m = /event: change\ndata: (.*)\n\n/.exec(buf);
        if (m) {
          req.destroy();
          resolve(JSON.parse(m[1]));
        }
      });
    });
    req.on('error', () => {});
    setTimeout(() => reject(new Error('no event')), 5000);
  });
  const msg = await received;
  assert.deepEqual(msg.tables, ['sites']);
  const anonymous = await fetch(`${base}/api/events`);
  assert.equal(anonymous.status, 401);
});

test('sample data, backups and clearing data', async () => {
  const loaded = await admin.post('/api/admin/demo', {});
  assert.equal(loaded.status, 200);
  assert.equal(loaded.data.loaded, true);
  assert.equal((await admin.post('/api/admin/demo', {})).data.loaded, false);

  const db = app.db;
  const status = code => db.get('select status from assets where code = ?', code).status;
  assert.equal(status('RT-04'), 'Out of Service');
  assert.equal(status('EPT-03'), 'Needs Attention');
  assert.equal(status('DL-03'), 'Needs Attention');
  assert.equal(db.get("select count(*) n from assets where site_id = (select id from sites where code = 'PLD')").n, 62);
  assert.ok(db.get("select count(*) n from work_orders where pm_schedule_id is not null").n > 0, 'due PMs were generated');
  assert.equal(db.get("select count(*) n from work_orders where title like 'Pre-use check failed%'").n, 2);
  assert.equal(db.get("select qty_on_hand from parts where part_no = 'LED-T8'").qty_on_hand, 22);
  assert.equal(db.get('select count(*) n from (select code from work_orders group by code having count(*) > 1)').n, 0);
  const summary = await tech.get(`/api/rows/wo_summary${q({ limit: 5 })}`);
  assert.equal(summary.data.length, 5);

  const info = await admin.get('/api/admin/info');
  assert.equal(info.data.hasDemoData, true);
  assert.ok(info.data.urls[0].startsWith('http://localhost:'));

  const file = await request('GET', '/api/admin/backup', { headers: { Cookie: admin.cookie } });
  assert.equal(file.status, 200);
  assert.match(file.headers['content-disposition'], /hlpi-cmms-backup-\d{4}-\d{2}-\d{2}\.db/);
  assert.equal(file.body.subarray(0, 15).toString(), 'SQLite format 3');

  const noConfirm = await admin.post('/api/admin/clear', {});
  assert.equal(noConfirm.status, 400);
  const cleared = await admin.post('/api/admin/clear', { confirm: 'DELETE' });
  assert.equal(cleared.status, 200);
  assert.equal(db.get('select count(*) n from assets').n, 0);
  assert.equal(db.get('select count(*) n from sites').n, 0);
  assert.ok(db.get('select count(*) n from profiles').n >= 4);
  assert.ok(db.get('select count(*) n from checklist_templates').n >= 6);
  assert.ok(app.backups.list().length >= 1, 'clearing makes a backup first');
});

test('the web app is served with the right caching', async () => {
  const home = await fetch(`${base}/`);
  assert.equal(home.status, 200);
  assert.equal(home.headers.get('cache-control'), 'no-cache');
  assert.match(await home.text(), /HLPI/);
  const asset = await fetch(`${base}/assets/app-123.js`);
  assert.match(asset.headers.get('cache-control'), /immutable/);
  assert.match(asset.headers.get('content-type'), /javascript/);
  assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404);
  // Nothing outside the app folder is ever served.
  writeFileSync(path.join(dir, 'secret.txt'), 'top secret');
  for (const p of ['/..%2fsecret.txt', '/../secret.txt', '/%2e%2e/secret.txt', '/assets/..%2f..%2fsecret.txt', '/..%5csecret.txt']) {
    const res = await request('GET', p);
    assert.ok(!res.body.toString().includes('top secret'), p);
  }
});
