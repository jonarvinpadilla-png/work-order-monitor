// Talks to the CMMS server that ships with the app (server/). The screens
// use the same small helpers as before: db.select / insert / update /
// remove / rpc. The server checks every permission and business rule and
// answers with messages that can be shown to the user as they are.

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

const OFFLINE = 'Could not reach the CMMS server. Check that the server PC is on and that you are connected to the site network.';

// Called when the server says the session has ended (signed out elsewhere,
// password reset or account deactivated).
const signedOutListeners = new Set();
export function onSignedOut(fn) {
  signedOutListeners.add(fn);
  return () => signedOutListeners.delete(fn);
}

export async function request(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError(OFFLINE, 0);
  }
  let data = null;
  if ((res.headers.get('content-type') || '').includes('application/json')) data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) signedOutListeners.forEach(fn => fn());
    if (res.status === 502 || res.status === 503 || res.status === 504) throw new ApiError(OFFLINE, res.status);
    throw new ApiError(data?.error || `The server answered ${res.status}.`, res.status);
  }
  return data;
}

// A chainable query like the one the screens were written against:
// db.select('wo_tasks', q => q.eq('work_order_id', id).order('seq')).
class Query {
  constructor(table) {
    this.table = table;
    this.spec = { eq: {}, gte: {}, order: [] };
  }
  eq(col, value) { this.spec.eq[col] = value; return this; }
  gte(col, value) { this.spec.gte[col] = value; return this; }
  order(col, { ascending = true, nullsFirst } = {}) {
    this.spec.order.push([col, ascending ? 'asc' : 'desc', nullsFirst === undefined ? undefined : nullsFirst ? 'first' : 'last']);
    return this;
  }
  limit(n) { this.spec.limit = n; return this; }
  then(resolve, reject) {
    return request('GET', `/rows/${this.table}?q=${encodeURIComponent(JSON.stringify(this.spec))}`).then(resolve, reject);
  }
}

export const db = {
  select: (table, build = q => q) => Promise.resolve(build(new Query(table))),
  insert: (table, row) => request('POST', `/rows/${table}`, row),
  insertMany: (table, rows) => request('POST', `/rows/${table}`, rows),
  update: (table, id, patch) => request('PATCH', `/rows/${table}/${encodeURIComponent(id)}`, patch),
  remove: (table, id) => request('DELETE', `/rows/${table}/${encodeURIComponent(id)}`),
  rpc: (fn, args = {}) => request('POST', `/rpc/${fn}`, args)
};

// A whole table (or the recent part of it) for the in-memory datasets.
export function fetchAll(def) {
  const q = new Query(def.table);
  if (def.order) q.order(def.order, { ascending: !def.desc, nullsFirst: false });
  q.order(def.key || 'id');
  if (def.sinceDays) q.gte(def.sinceCol || 'created_at', new Date(Date.now() - def.sinceDays * 86400000).toISOString());
  return Promise.resolve(q);
}

// Account and server administration.
export const auth = {
  setup: () => request('GET', '/setup'),
  session: () => request('GET', '/auth/session'),
  signIn: (email, password) => request('POST', '/auth/signin', { email, password }),
  signUp: fields => request('POST', '/auth/signup', fields),
  signOut: () => request('POST', '/auth/signout', {}),
  changePassword: (current_password, new_password) => request('POST', '/auth/password', { current_password, new_password })
};

export const admin = {
  info: () => request('GET', '/admin/info'),
  createUser: fields => request('POST', '/admin/users', fields),
  resetPassword: (userId, password) => request('POST', `/admin/users/${userId}/password`, { password }),
  backupNow: () => request('POST', '/admin/backup', {}),
  loadDemo: () => request('POST', '/admin/demo', {}),
  clearData: confirm => request('POST', '/admin/clear', { confirm }),
  backupUrl: '/api/admin/backup'
};
