// Links that open the CMMS straight at one asset or place. They go on QR
// labels, so they stay short: the asset tag, or the location's id.

export const unitPath = asset => `/u/${encodeURIComponent(asset.code)}`;
export const placePath = location => `/p/${location.id}`;

// The address phones use to reach the server: the admin's setting in
// Settings → General, otherwise this page's own address, unless that only
// works on the server PC itself (localhost).
export function labelBase(settings, origin = window.location.origin) {
  if (settings?.label_base_url) return settings.label_base_url;
  let host = '';
  try {
    host = new URL(origin).hostname;
  } catch {
    return null;
  }
  return host === 'localhost' || host.startsWith('127.') || host === '[::1]' ? null : origin;
}

export const labelUrl = (base, path) => `${base}/#${path}`;

// Tags are stored upper case; accept any case from a typed or scanned link.
export function findAssetByCode(assets, code) {
  const wanted = String(code || '').trim().toUpperCase();
  return wanted ? assets.find(a => a.code.toUpperCase() === wanted) || null : null;
}
