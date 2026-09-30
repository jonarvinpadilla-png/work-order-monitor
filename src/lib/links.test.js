import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findAssetByCode, labelBase, labelUrl, placePath, unitPath } from './links.js';

test('QR links use the tag for assets and the id for places', () => {
  assert.equal(unitPath({ code: 'RT-04' }), '/u/RT-04');
  assert.equal(unitPath({ code: 'DOCK 3/A' }), '/u/DOCK%203%2FA');
  assert.equal(placePath({ id: '20000000-0000-0000-0000-000000000001' }), '/p/20000000-0000-0000-0000-000000000001');
  assert.equal(labelUrl('http://192.168.1.20:8080', '/u/RT-04'), 'http://192.168.1.20:8080/#/u/RT-04');
});

test('labels use the admin setting, else this address unless it is localhost', () => {
  assert.equal(labelBase({ label_base_url: 'http://10.0.0.5:8080' }, 'http://localhost:8080'), 'http://10.0.0.5:8080');
  assert.equal(labelBase({}, 'http://192.168.1.20:8080'), 'http://192.168.1.20:8080');
  assert.equal(labelBase({}, 'http://localhost:8080'), null);
  assert.equal(labelBase({}, 'http://127.0.0.1:8080'), null);
  assert.equal(labelBase({}, 'http://[::1]:8080'), null);
});

test('scanned tags match in any case', () => {
  const assets = [{ id: 'a', code: 'RT-04' }, { id: 'b', code: 'DL-03' }];
  assert.equal(findAssetByCode(assets, 'rt-04').id, 'a');
  assert.equal(findAssetByCode(assets, ' DL-03 ').id, 'b');
  assert.equal(findAssetByCode(assets, 'RT-99'), null);
  assert.equal(findAssetByCode(assets, ''), null);
});
