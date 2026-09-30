import { useEffect, useState } from 'react';

// Hash-based routing (#/work-orders/123) so the app works on any static host
// without rewrite rules on the server. Anything that does not start
// with "#/" is treated as home.
function read() {
  const raw = window.location.hash.startsWith('#/') ? window.location.hash.slice(1) : '/';
  const [path, qs = ''] = raw.split('?');
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { path, segments, query: new URLSearchParams(qs) };
}

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => { setRoute(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(to) {
  window.location.hash = to;
}

export function href(to) {
  return '#' + to;
}
