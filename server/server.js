import http from 'node:http';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { Database } from './db.js';
import { Store } from './rules.js';
import { Accounts } from './auth.js';
import { Backups } from './backup.js';
import { Events, createApp } from './app.js';

// Opens the database in dataDir and starts the web server. Used by
// index.js (the program people run) and by the tests.
export function startServer({ dataDir, distDir, port = 8080, host, version = '', allowedHosts = [], remoteSetup = false }) {
  mkdirSync(dataDir, { recursive: true });
  rmSync(path.join(dataDir, 'tmp'), { recursive: true, force: true });
  const db = new Database(path.join(dataDir, 'cmms.db'));

  let events = null;
  const store = new Store(db, { onChange: tables => events?.publish(tables) });
  const accounts = new Accounts(store);
  events = new Events(accounts);
  const backups = new Backups(db, path.join(dataDir, 'backups'), { timezone: () => store.timezone() });

  const server = http.createServer();
  server.keepAliveTimeout = 65000;

  return new Promise((resolve, reject) => {
    server.once('error', e => {
      events.close();
      db.close();
      reject(e);
    });
    server.listen(port, host, () => {
      const actualPort = server.address().port;
      server.on('request', createApp({
        store, accounts, events, backups, distDir, dataDir, port: actualPort, version, allowedHosts, remoteSetup
      }));
      resolve({
        server, db, store, accounts, events, backups, port: actualPort,
        close() {
          events.close();
          server.closeAllConnections?.();
          return new Promise(done => server.close(() => { db.close(); done(); }));
        }
      });
    });
  });
}
