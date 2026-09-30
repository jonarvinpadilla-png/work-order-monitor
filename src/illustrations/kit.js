// Shared helpers for the hand-built SVG illustrations: a fixed equipment
// palette, a seeded random generator, colour mixing for depth haze, and a
// one-point perspective camera so warehouse scenes are geometrically correct.

export const C = {
  yellow: '#f5b800', yellowLight: '#ffd24d', yellowShade: '#d69f00', yellowDeep: '#a37900',
  chassis: '#27313b', chassisLight: '#3b4753', guard: '#2e3842',
  steel: '#8b97a4', steelLight: '#c5ced7', steelDark: '#58636f',
  tire: '#14181d', hub: '#b3bdc7',
  fork: '#39434e',
  seat: '#1b2229',
  wood: '#a9743f', woodDark: '#6f4a28',
  kraft: ['#b88a58', '#a97d4d', '#c9a06b', '#9b7148', '#bf9460'],
  white: '#dde5ec', crate: '#2f6db3', crateDark: '#234f82',
  upright: '#3d74b0', beam: '#ee861b', beamDark: '#b9620f',
  blueSpot: '#4a92ff', red: '#d8342c', green: '#2fbf5b', amber: '#ffb020',
  vest: '#ff8a1e', skin: '#c68b5e', helmet: '#f5b800'
};

export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a, b, t) {
  const x = hex(a), y = hex(b);
  const k = Math.max(0, Math.min(1, t));
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('');
}

export const pts = list => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

// One-point perspective. World units are metres: X right, Y up from the
// floor, Z away from the viewer. Returns screen [x, y].
export function camera({ vx, vy, f, eye }) {
  const p = (X, Y, Z) => [vx + (X * f) / Z, vy + ((eye - Y) * f) / Z];
  p.s = Z => f / Z; // pixels per metre at depth Z
  p.quad = corners => pts(corners.map(c => p(...c)));
  // Visible faces of an axis-aligned box, back to front.
  p.box = ({ x1, x2, y1, y2, z1, z2 }) => {
    const faces = [];
    if (x2 < 0) faces.push({ side: 'right', points: p.quad([[x2, y1, z1], [x2, y1, z2], [x2, y2, z2], [x2, y2, z1]]) });
    if (x1 > 0) faces.push({ side: 'left', points: p.quad([[x1, y1, z1], [x1, y1, z2], [x1, y2, z2], [x1, y2, z1]]) });
    if (y2 < eye) faces.push({ side: 'top', points: p.quad([[x1, y2, z1], [x2, y2, z1], [x2, y2, z2], [x1, y2, z2]]) });
    faces.push({ side: 'front', points: p.quad([[x1, y1, z1], [x2, y1, z1], [x2, y2, z1], [x1, y2, z1]]) });
    return faces;
  };
  return p;
}

export const shade = { top: 0.14, left: -0.18, right: -0.18, front: 0 };

// Lighten (t > 0) or darken (t < 0) a colour.
export function tone(c, t) {
  return t >= 0 ? mix(c, '#ffffff', t) : mix(c, '#000000', -t);
}
