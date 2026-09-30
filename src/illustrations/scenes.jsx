import { useId, useMemo } from 'react';
import { C, camera, mix, pts, rng, tone } from './kit';
import MheArt from './Mhe';

// Warehouse scenes drawn in one-point perspective (see camera() in kit.js).
// They are decorative: every scene is aria-hidden and scales with
// preserveAspectRatio="xMidYMid slice" to fill whatever box it sits in.

const W = 1200, H = 1000;

function useIds(...names) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  return Object.fromEntries(names.map(n => [n, `${n}${uid}`]));
}

function Frost({ count = 70, seed = 3, area = [W, H] }) {
  const flakes = useMemo(() => {
    const r = rng(seed);
    return Array.from({ length: count }, () => ({
      x: r() * area[0], y: r() * area[1], r: 0.8 + r() * 1.8, o: 0.3 + r() * 0.5,
      d: 9 + r() * 9, delay: -r() * 18
    }));
  }, [count, seed, area]);
  return (
    <g className="scene-frost">
      {flakes.map((f, i) => (
        <circle key={i} cx={f.x} cy={f.y} r={f.r} fill="#fff" opacity={f.o}
                style={{ animationDuration: `${f.d}s`, animationDelay: `${f.delay}s` }} />
      ))}
    </g>
  );
}

// A pallet face on a rack face plane (X constant), from za to zb, base height y0.
function palletFace(p, X, za, zb, y0, h, colour, tint, z, r) {
  const out = [];
  const q = c => p.quad(c);
  out.push({ points: q([[X, y0, za], [X, y0, zb], [X, y0 + 0.14, zb], [X, y0 + 0.14, za]]), fill: tint(C.wood, z) });
  const bw = (zb - za) * 0.16;
  [za + bw * 0.7, (za + zb) / 2 - bw / 2, zb - bw * 1.7].forEach(b =>
    out.push({ points: q([[X, y0 + 0.02, b], [X, y0 + 0.02, b + bw], [X, y0 + 0.1, b + bw], [X, y0 + 0.1, b]]), fill: tint(C.woodDark, z) }));
  const top = y0 + 0.14 + h;
  out.push({ points: q([[X, y0 + 0.14, za], [X, y0 + 0.14, zb], [X, top, zb], [X, top, za]]), fill: tint(colour, z) });
  const seam = tint(tone(colour, -0.28), z);
  const mid = y0 + 0.14 + h / 2;
  out.push({ points: q([[X, mid - 0.015, za], [X, mid - 0.015, zb], [X, mid + 0.015, zb], [X, mid + 0.015, za]]), fill: seam });
  const zm = (za + zb) / 2;
  out.push({ points: q([[X, y0 + 0.14, zm - 0.012], [X, y0 + 0.14, zm + 0.012], [X, top, zm + 0.012], [X, top, zm - 0.012]]), fill: seam });
  // barcode label and a shrink-wrap highlight
  if (r() > 0.25) {
    const lz = za + (zb - za) * 0.18;
    out.push({ points: q([[X, mid - 0.34, lz], [X, mid - 0.34, lz + 0.22], [X, mid - 0.14, lz + 0.22], [X, mid - 0.14, lz]]), fill: tint('#f3f6f8', z) });
  }
  out.push({ points: q([[X, top - 0.05, za], [X, top - 0.05, zm], [X, mid + 0.2, za]]), fill: '#ffffff', opacity: 0.1 });
  return out;
}

// ------------------------------------------------------------------ freezer
function buildFreezer() {
  const p = camera({ vx: 600, vy: 430, f: 600, eye: 1.7 });
  const FOG = '#a9c9e7';
  const haze = z => Math.min(0.9, 1 - Math.exp(-(z - 1.4) / 17));
  const tint = (c, z) => mix(c, FOG, haze(z));
  const AISLE = 1.8, TOP = 10.3, CEIL = 11.8, BAY = 2.8, Z0 = 3.0, BAYS = 15, ZEND = Z0 + BAYS * BAY;
  const LEVELS = [0, 1.72, 3.44, 5.16, 6.88, 8.6];
  const r = rng(11);
  const cartons = () => {
    const k = r();
    if (k < 0.18) return C.white;
    if (k < 0.27) return C.crate;
    return C.kraft[Math.floor(r() * C.kraft.length)];
  };

  const racks = [];
  for (let i = BAYS - 1; i >= 0; i--) {
    const z1 = Z0 + i * BAY, z2 = z1 + BAY;
    for (const s of [-1, 1]) {
      const X = s * AISLE;
      const shapes = [];
      LEVELS.forEach((h, li) => {
        const base = li === 0 ? 0.02 : h + 0.14;
        [[z1 + 0.1, z1 + 1.33], [z1 + 1.47, z2 - 0.1]].forEach(([za, zb]) => {
          if (r() < (i < 2 ? 0 : 0.12)) {
            shapes.push({ points: p.quad([[X, base, za], [X, base, zb], [X, base + 1.45, zb], [X, base + 1.45, za]]), fill: tint('#0b131b', za) });
          } else {
            shapes.push(...palletFace(p, X - s * 0.04, za, zb, base, 1.15 + r() * 0.3, cartons(), tint, za, r));
          }
        });
        if (li > 0) {
          shapes.push({ points: p.quad([[X, h, z1], [X, h, z2], [X, h + 0.14, z2], [X, h + 0.14, z1]]), fill: tint(C.beam, z1) });
          shapes.push({ points: p.quad([[X, h, z1], [X, h, z2], [X, h + 0.03, z2], [X, h + 0.03, z1]]), fill: tint(C.beamDark, z1) });
          [z1 + 0.5, z1 + 1.9].forEach(lz => {
            if (p.s(lz) * 0.2 > 3) shapes.push({ points: p.quad([[X, h + 0.035, lz], [X, h + 0.035, lz + 0.22], [X, h + 0.12, lz + 0.22], [X, h + 0.12, lz]]), fill: tint('#f4f6f8', lz) });
          });
        }
      });
      [z1, ...(i === BAYS - 1 ? [z2] : [])].forEach(zu => {
        shapes.push({ points: p.quad([[X, 0, zu - 0.05], [X, 0, zu + 0.05], [X, TOP, zu + 0.05], [X, TOP, zu - 0.05]]), fill: tint(C.upright, zu) });
        shapes.push({ points: p.quad([[X, 0, zu - 0.05], [X, 0, zu - 0.01], [X, TOP, zu - 0.01], [X, TOP, zu - 0.05]]), fill: tint(tone(C.upright, 0.25), zu) });
        shapes.push({ points: p.quad([[X, 0, zu - 0.1], [X, 0, zu + 0.12], [X, 0.45, zu + 0.12], [X, 0.45, zu - 0.1]]), fill: tint(C.yellow, zu) });
      });
      racks.push(...shapes);
    }
  }

  const lights = [];
  const cones = [];
  for (let z = 3.2; z < ZEND; z += 5.4) {
    lights.push({ points: p.quad([[-0.09, CEIL - 0.35, z], [0.09, CEIL - 0.35, z], [0.09, CEIL - 0.35, z + 1.4], [-0.09, CEIL - 0.35, z + 1.4]]), glow: p(0, CEIL - 0.35, z + 0.7), s: p.s(z) });
    if (z > 8 && z < 32) cones.push(pts([p(-0.1, CEIL - 0.4, z + 0.7), p(0.1, CEIL - 0.4, z + 0.7), p(1.5, 0, z + 0.7), p(-1.5, 0, z + 0.7)]));
  }

  // Reach truck putting a pallet away, seen from behind.
  const tz = 9.6;
  const truck = [];
  const near = c => mix(c, FOG, 0.18);
  const face = (c, fill) => ({ points: p.quad(c), fill: near(fill) });
  truck.push(face([[-0.42, 0, tz + 1.8], [-0.33, 0, tz + 1.8], [-0.33, 7.8, tz + 1.8], [-0.42, 7.8, tz + 1.8]], C.steelDark));
  truck.push(face([[0.33, 0, tz + 1.8], [0.42, 0, tz + 1.8], [0.42, 7.8, tz + 1.8], [0.33, 7.8, tz + 1.8]], C.steelDark));
  truck.push(face([[-0.5, 0, tz + 1.6], [-0.4, 0, tz + 1.6], [-0.4, 6.9, tz + 1.6], [-0.5, 6.9, tz + 1.6]], C.steel));
  truck.push(face([[0.4, 0, tz + 1.6], [0.5, 0, tz + 1.6], [0.5, 6.9, tz + 1.6], [0.4, 6.9, tz + 1.6]], C.steel));
  truck.push(face([[-0.5, 6.8, tz + 1.6], [0.5, 6.8, tz + 1.6], [0.5, 6.92, tz + 1.6], [-0.5, 6.92, tz + 1.6]], C.steelDark));
  const lz = tz + 1.9;
  truck.push(face([[-0.62, 5.0, lz], [0.62, 5.0, lz], [0.62, 5.14, lz], [-0.62, 5.14, lz]], C.wood));
  truck.push(face([[-0.62, 5.14, lz], [0.62, 5.14, lz], [0.62, 6.45, lz], [-0.62, 6.45, lz]], C.kraft[2]));
  truck.push(face([[-0.62, 5.78, lz], [0.62, 5.78, lz], [0.62, 5.81, lz], [-0.62, 5.81, lz]], tone(C.kraft[2], -0.3)));
  truck.push(face([[-0.01, 5.14, lz], [0.01, 5.14, lz], [0.01, 6.45, lz], [-0.01, 6.45, lz]], tone(C.kraft[2], -0.3)));
  truck.push(face([[0.12, 5.3, lz], [0.36, 5.3, lz], [0.36, 5.5, lz], [0.12, 5.5, lz]], '#f3f6f8'));
  p.box({ x1: -0.62, x2: 0.62, y1: 2.25, y2: 2.32, z1: tz + 0.1, z2: tz + 1.6 }).forEach(f => truck.push({ points: f.points, fill: near(C.guard) }));
  [-0.6, 0.54].forEach(x => truck.push(face([[x, 1.15, tz + 0.1], [x + 0.06, 1.15, tz + 0.1], [x + 0.06, 2.3, tz + 0.1], [x, 2.3, tz + 0.1]], C.guard)));
  const head = p(0.12, 1.98, tz + 0.8);
  truck.push(face([[-0.1, 1.45, tz + 0.8], [0.34, 1.45, tz + 0.8], [0.34, 1.85, tz + 0.8], [-0.1, 1.85, tz + 0.8]], C.vest));
  p.box({ x1: -0.62, x2: 0.62, y1: 0.06, y2: 1.2, z1: tz, z2: tz + 1.5 }).forEach(f => truck.push({ points: f.points, fill: near(f.side === 'top' ? C.yellowLight : C.yellow) }));
  truck.push(face([[-0.62, 0.06, tz], [0.62, 0.06, tz], [0.62, 0.32, tz], [-0.62, 0.32, tz]], C.chassis));
  truck.push(face([[-0.36, 0.5, tz], [0.36, 0.5, tz], [0.36, 1.0, tz], [-0.36, 1.0, tz]], C.yellowShade));
  [-0.55, 0.49].forEach(x => truck.push(face([[x, 0.85, tz], [x + 0.06, 0.85, tz], [x + 0.06, 1.0, tz], [x, 1.0, tz]], C.red)));
  const hz = [];
  for (let k = 0; k < 8; k++) {
    const x = -0.62 + k * 0.155;
    hz.push({ points: p.quad([[x, 0.32, tz], [x + 0.08, 0.32, tz], [x + 0.14, 0.44, tz], [x + 0.06, 0.44, tz]]), fill: near('#151a1f') });
  }
  truck.push({ points: p.quad([[-0.62, 0.32, tz], [0.62, 0.32, tz], [0.62, 0.44, tz], [-0.62, 0.44, tz]]), fill: near(C.yellow) }, ...hz);

  const spot = { c: p(0, 0, 7.4), s: p.s(7.4) };
  const redZone = [-0.95, 0.95].map(x => p.quad([[x - 0.03, 0.005, 8.4], [x + 0.03, 0.005, 8.4], [x + 0.03, 0.005, 9.8], [x - 0.03, 0.005, 9.8]]));

  // Row-end frames of the two racks at the mouth of the aisle (plane Z = Z0).
  const ends = [];
  for (const s of [-1, 1]) {
    const a = s * AISLE, b = s * (AISLE + 1.25);
    const lo = Math.min(a, b), hi = Math.max(a, b);
    const q = (x1, x2, y1, y2) => p.quad([[x1, y1, Z0], [x2, y1, Z0], [x2, y2, Z0], [x1, y2, Z0]]);
    ends.push({ points: q(lo, hi, 0, TOP), fill: '#0e1822' });
    LEVELS.forEach((h, li) => {
      const base = li === 0 ? 0.02 : h + 0.14;
      const col = cartons();
      ends.push({ points: q(lo + 0.08, hi - 0.08, base, base + 0.14), fill: C.wood });
      ends.push({ points: q(lo + 0.1, hi - 0.1, base + 0.14, base + 1.35), fill: tone(col, -0.12) });
      ends.push({ points: q(lo + 0.1, hi - 0.1, base + 0.74, base + 0.77), fill: tone(col, -0.38) });
      if (li > 0) [lo, hi - 0.1].forEach(x => ends.push({ points: q(x, x + 0.1, h, h + 0.14), fill: C.beam }));
    });
    [lo, hi - 0.1].forEach(x => {
      ends.push({ points: q(x, x + 0.1, 0, TOP), fill: C.upright });
      ends.push({ points: q(x, x + 0.025, 0, TOP), fill: tone(C.upright, 0.3) });
    });
    for (let y = 0.6; y < TOP - 0.8; y += 1.2) {
      ends.push({ line: [p(lo + 0.1, y, Z0), p(hi - 0.1, y + 0.6, Z0)] });
      ends.push({ line: [p(hi - 0.1, y + 0.6, Z0), p(lo + 0.1, y + 1.2, Z0)] });
    }
    ends.push({ points: q(lo - 0.06, hi + 0.06, 0, 0.5), fill: C.yellow });
    for (let x = lo - 0.06; x < hi + 0.06; x += 0.22) ends.push({ points: p.quad([[x, 0.05, Z0 - 0.01], [x + 0.1, 0.05, Z0 - 0.01], [x + 0.2, 0.45, Z0 - 0.01], [x + 0.1, 0.45, Z0 - 0.01]]), fill: '#151a1f' });
  }

  return {
    p, AISLE, CEIL, ZEND, racks, lights, cones, truck, head, headR: p.s(tz + 0.8) * 0.12, ends,
    spot, redZone, FOG,
    wall: p.quad([[-AISLE - 4, 0, ZEND], [AISLE + 4, 0, ZEND], [AISLE + 4, CEIL, ZEND], [-AISLE - 4, CEIL, ZEND]]),
    door: p.quad([[-1.3, 0, ZEND - 0.01], [1.3, 0, ZEND - 0.01], [1.3, 4.1, ZEND - 0.01], [-1.3, 4.1, ZEND - 0.01]]),
    doorStrip: p.quad([[-1.3, 1.9, ZEND - 0.02], [1.3, 1.9, ZEND - 0.02], [1.3, 2.25, ZEND - 0.02], [-1.3, 2.25, ZEND - 0.02]]),
    exit: p.quad([[-0.4, 4.5, ZEND - 0.02], [0.4, 4.5, ZEND - 0.02], [0.4, 4.85, ZEND - 0.02], [-0.4, 4.85, ZEND - 0.02]]),
    lines: [-1.25, 1.2].map(x => p.quad([[x, 0, 1.4], [x + 0.08, 0, 1.4], [x + 0.08, 0, ZEND], [x, 0, ZEND]])),
    sheen: pts([p(-0.5, 0, 1.4), p(0.5, 0, 1.4), p(0.04, 0, ZEND), p(-0.04, 0, ZEND)]),
    pipe: p.quad([[0.9, CEIL - 0.6, 1.4], [0.9, CEIL - 0.6, ZEND], [0.9, CEIL - 0.5, ZEND], [0.9, CEIL - 0.5, 1.4]]),
    sign: { board: p.quad([[-0.95, 6.3, 8.4], [0.95, 6.3, 8.4], [0.95, 6.9, 8.4], [-0.95, 6.9, 8.4]]), c: p(0, 6.44, 8.4), s: p.s(8.4),
            chains: [[-0.8, 6.9], [0.8, 6.9]].map(([x, y]) => [p(x, y, 8.4), p(x, CEIL, 8.4)]) },
    temp: { board: p.quad([[-AISLE, 2.5, 8.6], [-AISLE + 1.3, 2.5, 8.6], [-AISLE + 1.3, 2.95, 8.6], [-AISLE, 2.95, 8.6]]), c: p(-AISLE + 0.65, 2.64, 8.6), s: p.s(8.6) }
  };
}

let FREEZER;
export function FreezerAisle({ className }) {
  const g = FREEZER || (FREEZER = buildFreezer());
  const id = useIds('ceil', 'floor', 'haze', 'line', 'glow', 'cone');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id.ceil} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a131c" />
          <stop offset=".7" stopColor="#2c4863" />
          <stop offset="1" stopColor={g.FOG} />
        </linearGradient>
        <linearGradient id={id.floor} gradientUnits="userSpaceOnUse" x1="0" y1="430" x2="0" y2={H}>
          <stop offset="0" stopColor={g.FOG} />
          <stop offset=".25" stopColor="#6d8aa6" />
          <stop offset="1" stopColor="#1e2c3a" />
        </linearGradient>
        <linearGradient id={id.line} gradientUnits="userSpaceOnUse" x1="0" y1="430" x2="0" y2={H}>
          <stop offset="0" stopColor={g.FOG} />
          <stop offset=".35" stopColor="#d8c26a" />
          <stop offset="1" stopColor={C.yellow} />
        </linearGradient>
        <radialGradient id={id.haze} cx="600" cy="430" r="560" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#eef7ff" stopOpacity=".75" />
          <stop offset=".35" stopColor="#cfe3f6" stopOpacity=".28" />
          <stop offset="1" stopColor="#cfe3f6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id.glow}>
          <stop offset="0" stopColor="#ffffff" stopOpacity=".9" />
          <stop offset="1" stopColor="#dff0ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id.cone} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f2f9ff" stopOpacity=".12" />
          <stop offset="1" stopColor="#f2f9ff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={W} height="431" fill={`url(#${id.ceil})`} />
      <rect y="430" width={W} height={H - 430} fill={`url(#${id.floor})`} />
      <polygon points={g.wall} fill={mix('#dfe8f1', g.FOG, 0.6)} />
      <polygon points={g.door} fill={mix(C.crate, g.FOG, 0.55)} />
      <polygon points={g.doorStrip} fill={mix('#e8f2fb', g.FOG, 0.4)} />
      <polygon points={g.exit} fill={mix('#1f9d55', g.FOG, 0.3)} />
      <polygon points={g.sheen} fill="#fff" opacity=".12" />
      {g.lines.map((l, i) => <polygon key={i} points={l} fill={`url(#${id.line})`} />)}
      <polygon points={g.pipe} fill={mix('#c0392b', g.FOG, 0.35)} />
      {g.cones.map((c, i) => <polygon key={i} points={c} fill={`url(#${id.cone})`} />)}
      {g.racks.map((s, i) => <polygon key={i} points={s.points} fill={s.fill} opacity={s.opacity} />)}
      {g.lights.map((l, i) => (
        <g key={i}>
          <ellipse cx={l.glow[0]} cy={l.glow[1]} rx={l.s * 1.4} ry={l.s * 0.5} fill={`url(#${id.glow})`} />
          <polygon points={l.points} fill="#f7fbff" />
        </g>
      ))}
      <ellipse cx={g.spot.c[0]} cy={g.spot.c[1]} rx={g.spot.s * 0.8} ry={g.spot.s * 0.2} fill={C.blueSpot} opacity=".25" />
      <ellipse cx={g.spot.c[0]} cy={g.spot.c[1]} rx={g.spot.s * 0.38} ry={g.spot.s * 0.1} fill={C.blueSpot} opacity=".9" />
      <rect width={W} height={H} fill={`url(#${id.haze})`} />
      {g.redZone.map((z, i) => <polygon key={i} points={z} fill="#ff3b30" opacity=".75" />)}
      {g.truck.map((s, i) => <polygon key={i} points={s.points} fill={s.fill} />)}
      <circle cx={g.head[0]} cy={g.head[1]} r={g.headR} fill={mix(C.helmet, g.FOG, 0.15)} />
      {g.sign.chains.map(([a, b], i) => <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#7f93a6" strokeWidth="1.5" />)}
      <polygon points={g.sign.board} fill={C.yellow} />
      <text x={g.sign.c[0]} y={g.sign.c[1]} textAnchor="middle" className="scene-label" fontSize={g.sign.s * 0.46} fill="#111921">AISLE F07</text>
      <line x1={g.p(-g.AISLE, 2.72, 8.6)[0]} y1={g.p(-g.AISLE, 2.72, 8.6)[1]} x2={g.p(-g.AISLE + 0.2, 2.72, 8.6)[0]} y2={g.p(-g.AISLE + 0.2, 2.72, 8.6)[1]} stroke="#1d2a36" strokeWidth="3" />
      <polygon points={g.temp.board} fill="#0c1116" />
      <text x={g.temp.c[0]} y={g.temp.c[1]} textAnchor="middle" className="scene-led" fontSize={g.temp.s * 0.24} fill="#ff5a4d">−22.4°C</text>
      {g.ends.map((e, i) => e.line
        ? <line key={i} x1={e.line[0][0]} y1={e.line[0][1]} x2={e.line[1][0]} y2={e.line[1][1]} stroke={tone(C.upright, -0.1)} strokeWidth="5" />
        : <polygon key={i} points={e.points} fill={e.fill} />)}
      <Frost />
    </svg>
  );
}

// -------------------------------------------------------------- loading dock
function buildDock() {
  const p = camera({ vx: 470, vy: 440, f: 560, eye: 1.7 });
  const HAZE = '#b7aa9c';
  const haze = z => Math.min(0.85, 1 - Math.exp(-(z - 1.5) / 20));
  const tint = (c, z) => mix(c, HAZE, haze(z));
  const WALL = 4.2, CEIL = 9, ZEND = 44;
  const r = rng(5);
  const doors = [2.4, 6.9, 11.4, 15.9, 20.4, 24.9, 29.4, 33.9, 38.4];
  const open = [true, false, true, true, false, true, false, true, true];
  const wallParts = [], floorParts = [], beams = [];
  doors.slice().reverse().forEach((z, idx) => {
    const k = doors.length - 1 - idx;
    wallParts.push({ points: p.quad([[WALL, 0, z - 0.4], [WALL, 0, z + 3.4], [WALL, 3.65, z + 3.4], [WALL, 3.65, z - 0.4]]), fill: tint('#14181d', z) });
    if (open[k]) {
      wallParts.push({ points: p.quad([[WALL, 0.05, z], [WALL, 0.05, z + 3], [WALL, 3.15, z + 3], [WALL, 3.15, z]]), fill: 'sky', z });
      wallParts.push({ points: p.quad([[WALL, 2.55, z], [WALL, 2.55, z + 3], [WALL, 3.15, z + 3], [WALL, 3.15, z]]), fill: tint('#c7cfd6', z) });
      for (let y = 2.7; y < 3.1; y += 0.15) wallParts.push({ points: p.quad([[WALL, y, z], [WALL, y, z + 3], [WALL, y + 0.015, z + 3], [WALL, y + 0.015, z]]), fill: tint('#8f9aa5', z) });
      floorParts.push({ points: p.quad([[WALL, 0.004, z + 0.25], [WALL, 0.004, z + 2.75], [WALL - 2.1, 0.004, z + 2.75], [WALL - 2.1, 0.004, z + 0.25]]), fill: tint('#7e8994', z) });
      [z + 0.25, z + 2.62].forEach(zz => floorParts.push({ points: p.quad([[WALL, 0.006, zz], [WALL, 0.006, zz + 0.13], [WALL - 2.1, 0.006, zz + 0.13], [WALL - 2.1, 0.006, zz]]), fill: tint(C.yellow, z) }));
      if (z > 5) {
        floorParts.push({ points: pts([p(WALL, 0.01, z), p(WALL, 0.01, z + 3), p(-1.2, 0.01, z + 4.4), p(-1.2, 0.01, z + 0.7)]), fill: 'spill', z });
        beams.push(pts([p(WALL, 3.15, z), p(WALL, 3.15, z + 3), p(-1.2, 0, z + 4.4), p(-1.2, 0, z + 0.7)]));
      }
    } else {
      wallParts.push({ points: p.quad([[WALL, 0.05, z], [WALL, 0.05, z + 3], [WALL, 3.15, z + 3], [WALL, 3.15, z]]), fill: tint('#c3cbd3', z) });
      for (let y = 0.45; y < 3.1; y += 0.5) wallParts.push({ points: p.quad([[WALL, y, z], [WALL, y, z + 3], [WALL, y + 0.02, z + 3], [WALL, y + 0.02, z]]), fill: tint('#8f9aa5', z) });
      wallParts.push({ points: p.quad([[WALL, 1.9, z + 0.3], [WALL, 1.9, z + 2.7], [WALL, 2.15, z + 2.7], [WALL, 2.15, z + 0.3]]), fill: tint('#6f8aa3', z) });
    }
    wallParts.push({ points: p.quad([[WALL, 3.95, z + 1.1], [WALL, 3.95, z + 1.9], [WALL, 4.4, z + 1.9], [WALL, 4.4, z + 1.1]]), fill: tint(C.yellow, z) });
    [z - 0.35, z + 3.1].forEach(zz => wallParts.push({ points: p.quad([[WALL, 0.1, zz], [WALL, 0.1, zz + 0.25], [WALL, 0.55, zz + 0.25], [WALL, 0.55, zz]]), fill: tint('#0f1216', z) }));
  });
  const seams = [];
  for (let z = 1.6; z < ZEND; z += 2.25) seams.push(p.quad([[WALL, 3.7, z], [WALL, 3.7, z + 0.02], [WALL, CEIL, z + 0.02], [WALL, CEIL, z]]));

  // staging lanes and pallets
  const lanes = [];
  [-1.4, -3.1, -4.8, -6.5].forEach(x => lanes.push(p.quad([[x, 0.003, 3], [x + 0.07, 0.003, 3], [x + 0.07, 0.003, 32], [x, 0.003, 32]])));
  const pallets = [];
  const loads = [];
  [-2.25, -3.95, -5.65].forEach(cx => {
    for (let z = 5.2; z < 30; z += 1.45) {
      if (r() < 0.3) continue;
      const hgt = 1.0 + r() * 0.7;
      const k = r();
      const colour = k < 0.22 ? C.white : k < 0.38 ? C.crate : C.kraft[Math.floor(r() * C.kraft.length)];
      loads.push({ z, cx, hgt, colour });
    }
  });
  loads.sort((a, b) => b.z - a.z || a.cx - b.cx);
  loads.forEach(({ z, cx, hgt, colour }) => {
    const shadeOf = side => side === 'top' ? 0.16 : side === 'right' ? -0.22 : 0;
    p.box({ x1: cx - 0.6, x2: cx + 0.6, y1: 0, y2: 0.15, z1: z, z2: z + 1.2 }).forEach(f => pallets.push({ points: f.points, fill: tint(tone(C.wood, shadeOf(f.side)), z) }));
    p.box({ x1: cx - 0.58, x2: cx + 0.58, y1: 0.15, y2: 0.15 + hgt, z1: z + 0.02, z2: z + 1.18 }).forEach(f => {
      pallets.push({ points: f.points, fill: tint(tone(colour, shadeOf(f.side)), z) });
      if (f.side === 'front') {
        const rows = colour === C.crate ? 5 : 2;
        for (let j = 1; j < rows; j++) {
          const y = 0.15 + (hgt * j) / rows;
          pallets.push({ points: p.quad([[cx - 0.58, y - 0.012, z + 0.02], [cx + 0.58, y - 0.012, z + 0.02], [cx + 0.58, y + 0.012, z + 0.02], [cx - 0.58, y + 0.012, z + 0.02]]), fill: tint(tone(colour, -0.3), z) });
        }
        pallets.push({ points: p.quad([[cx - 0.58, 0.15 + hgt * 0.55, z + 0.02], [cx - 0.1, 0.15 + hgt, z + 0.02], [cx - 0.35, 0.15 + hgt, z + 0.02]]), fill: '#fff', opacity: 0.12 });
      }
    });
  });

  const lamps = [];
  for (let z = 3; z < ZEND; z += 6) [-3.2, 1.2].forEach(x => lamps.push({ c: p(x, CEIL - 0.6, z), s: p.s(z) }));

  const ept = { x: p(-1.1, 0, 7.4)[0], y: p(0, 0, 7.4)[1], k: p.s(7.4) * 0.02 };
  const fork = { x: p(0.6, 0, 17)[0], y: p(0, 0, 17)[1], k: p.s(17) * 0.02 };
  return {
    p, HAZE, wallParts, floorParts, beams, seams, lanes, pallets, lamps, ept, fork, tint,
    wall: p.quad([[WALL, 0, 1.2], [WALL, 0, ZEND], [WALL, CEIL, ZEND], [WALL, CEIL, 1.2]]),
    back: p.quad([[-12, 0, ZEND], [WALL, 0, ZEND], [WALL, CEIL, ZEND], [-12, CEIL, ZEND]]),
    trusses: Array.from({ length: 9 }, (_, i) => { const z = 3 + i * 5; return [p(-12, CEIL, z), p(WALL, CEIL, z)]; })
  };
}

let DOCK;
export function LoadingDock({ className }) {
  const g = DOCK || (DOCK = buildDock());
  const id = useIds('ceil', 'floor', 'sky', 'spill', 'beam', 'lamp', 'haze');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id.ceil} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#141b22" />
          <stop offset=".75" stopColor="#4a4f57" />
          <stop offset="1" stopColor={g.HAZE} />
        </linearGradient>
        <linearGradient id={id.floor} gradientUnits="userSpaceOnUse" x1="0" y1="440" x2="0" y2={H}>
          <stop offset="0" stopColor={g.HAZE} />
          <stop offset=".3" stopColor="#6b6a6a" />
          <stop offset="1" stopColor="#262a2f" />
        </linearGradient>
        <linearGradient id={id.sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe2b8" />
          <stop offset=".55" stopColor="#ffab63" />
          <stop offset=".72" stopColor="#e2834a" />
          <stop offset=".74" stopColor="#4d4147" />
          <stop offset="1" stopColor="#2c2a2e" />
        </linearGradient>
        <linearGradient id={id.spill} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor="#ffb86e" stopOpacity=".42" />
          <stop offset="1" stopColor="#ffb86e" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id.beam} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd29a" stopOpacity=".16" />
          <stop offset="1" stopColor="#ffd29a" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={id.lamp}>
          <stop offset="0" stopColor="#fff6e6" stopOpacity=".95" />
          <stop offset="1" stopColor="#fff6e6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={id.haze} cx="470" cy="440" r="520" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffe9cf" stopOpacity=".55" />
          <stop offset="1" stopColor="#ffe9cf" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height="441" fill={`url(#${id.ceil})`} />
      <rect y="440" width={W} height={H - 440} fill={`url(#${id.floor})`} />
      <polygon points={g.back} fill={mix('#6d7782', g.HAZE, 0.55)} />
      {g.trusses.map(([a, b], i) => <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#39414a" strokeWidth={Math.max(1, 6 - i * 0.6)} />)}
      <polygon points={g.wall} fill={g.tint('#6f7a86', 6)} />
      {g.seams.map((s, i) => <polygon key={i} points={s} fill="#59636e" />)}
      {g.lanes.map((l, i) => <polygon key={i} points={l} fill={mix(C.yellow, g.HAZE, 0.25)} />)}
      {g.floorParts.map((s, i) => <polygon key={i} points={s.points} fill={s.fill === 'spill' ? `url(#${id.spill})` : s.fill} />)}
      {g.wallParts.map((s, i) => <polygon key={i} points={s.points} fill={s.fill === 'sky' ? `url(#${id.sky})` : s.fill} />)}
      {g.beams.map((b, i) => <polygon key={i} points={b} fill={`url(#${id.beam})`} />)}
      <MheArt type="Counterbalance Forklift (Electric)" load x={g.fork.x} y={g.fork.y - 134 * g.fork.k} width={240 * g.fork.k} height={150 * g.fork.k} />
      {g.pallets.map((s, i) => <polygon key={i} points={s.points} fill={s.fill} opacity={s.opacity} />)}
      <MheArt type="Electric Pallet Truck" load operator flip x={g.ept.x} y={g.ept.y - 134 * g.ept.k} width={240 * g.ept.k} height={150 * g.ept.k} />
      {g.lamps.map((l, i) => (
        <g key={i}>
          <ellipse cx={l.c[0]} cy={l.c[1]} rx={l.s * 1.1} ry={l.s * 0.55} fill={`url(#${id.lamp})`} />
          <ellipse cx={l.c[0]} cy={l.c[1]} rx={l.s * 0.3} ry={l.s * 0.1} fill="#fffaf0" />
        </g>
      ))}
      <rect width={W} height={H} fill={`url(#${id.haze})`} />
    </svg>
  );
}

// ---------------------------------------------------------- charging room
function buildCharging() {
  const p = camera({ vx: 600, vy: 420, f: 600, eye: 1.55 });
  const ZB = 6.2, CEIL = 4.4, SIDE = 5.3;
  const chargers = [-3.3, -1.1, 1.1, 3.3].map((cx, i) => {
    const faces = p.box({ x1: cx - 0.42, x2: cx + 0.42, y1: 1.35, y2: 2.35, z1: ZB - 0.36, z2: ZB });
    const z = ZB - 0.36;
    return {
      cx, faces,
      panel: p.quad([[cx - 0.34, 1.62, z - 0.001], [cx + 0.34, 1.62, z - 0.001], [cx + 0.34, 2.27, z - 0.001], [cx - 0.34, 2.27, z - 0.001]]),
      display: p.quad([[cx - 0.28, 1.97, z - 0.002], [cx + 0.06, 1.97, z - 0.002], [cx + 0.06, 2.2, z - 0.002], [cx - 0.28, 2.2, z - 0.002]]),
      text: p(cx - 0.11, 2.03, z), s: p.s(z),
      leds: [2.16, 2.07, 1.98].map(y => p(cx + 0.22, y, z)),
      vents: [1.45, 1.5, 1.55].map(y => p.quad([[cx - 0.3, y, z - 0.002], [cx + 0.3, y, z - 0.002], [cx + 0.3, y + 0.015, z - 0.002], [cx - 0.3, y + 0.015, z - 0.002]])),
      pct: ['FULL', '86%', '54%', '100%'][i], ok: i !== 2,
      cable: [p(cx + 0.25, 1.35, ZB - 0.2), p(cx + 0.36, 0.98, 4.35)],
      conduit: p.quad([[cx - 0.05, 2.35, ZB - 0.02], [cx + 0.05, 2.35, ZB - 0.02], [cx + 0.05, CEIL, ZB - 0.02], [cx - 0.05, CEIL, ZB - 0.02]])
    };
  });
  const batteries = [-3.3, -1.1, 1.1, 3.3].map(cx => {
    const stand = p.box({ x1: cx - 0.55, x2: cx + 0.55, y1: 0, y2: 0.3, z1: 4.1, z2: 5.1 });
    const body = p.box({ x1: cx - 0.52, x2: cx + 0.52, y1: 0.3, y2: 0.95, z1: 4.12, z2: 5.08 });
    const caps = [];
    for (let a = 0; a < 6; a++) for (let b = 0; b < 3; b++) {
      const x = cx - 0.44 + a * 0.16, z = 4.22 + b * 0.28;
      caps.push({ points: p.quad([[x, 0.951, z], [x + 0.11, 0.951, z], [x + 0.11, 0.951, z + 0.18], [x, 0.951, z + 0.18]]), plug: p(x + 0.055, 0.96, z + 0.09), r: p.s(z) * 0.028, c: (a + b) % 3 === 0 ? C.yellow : '#e3e8ec' });
    }
    return { stand, body, caps, label: p.quad([[cx - 0.36, 0.52, 4.119], [cx - 0.02, 0.52, 4.119], [cx - 0.02, 0.72, 4.119], [cx - 0.36, 0.72, 4.119]]), stripe: p.quad([[cx - 0.36, 0.68, 4.118], [cx - 0.02, 0.68, 4.118], [cx - 0.02, 0.72, 4.118], [cx - 0.36, 0.72, 4.118]]), conn: p.quad([[cx + 0.28, 0.8, 4.1], [cx + 0.46, 0.8, 4.1], [cx + 0.46, 1.0, 4.1], [cx + 0.28, 1.0, 4.1]]) };
  });
  const stripe = [];
  for (let k = 0; k < 20; k++) {
    const x = -4.4 + k * 0.44;
    stripe.push({ points: p.quad([[x, 0.003, 3.55], [x + 0.44, 0.003, 3.55], [x + 0.44, 0.003, 3.8], [x, 0.003, 3.8]]), fill: k % 2 ? '#15191e' : C.yellow });
  }
  const s = p.s(ZB);
  return {
    p, chargers, batteries, stripe, s,
    back: p.quad([[-SIDE, 0, ZB], [SIDE, 0, ZB], [SIDE, CEIL, ZB], [-SIDE, CEIL, ZB]]),
    dado: p.quad([[-SIDE, 0, ZB - 0.001], [SIDE, 0, ZB - 0.001], [SIDE, 1.0, ZB - 0.001], [-SIDE, 1.0, ZB - 0.001]]),
    left: p.quad([[-SIDE, 0, 1.5], [-SIDE, 0, ZB], [-SIDE, CEIL, ZB], [-SIDE, CEIL, 1.5]]),
    right: p.quad([[SIDE, 0, 1.5], [SIDE, 0, ZB], [SIDE, CEIL, ZB], [SIDE, CEIL, 1.5]]),
    ceiling: p.quad([[-SIDE, CEIL, 1.5], [SIDE, CEIL, 1.5], [SIDE, CEIL, ZB], [-SIDE, CEIL, ZB]]),
    floor: p.quad([[-SIDE, 0, 1.2], [SIDE, 0, 1.2], [SIDE, 0, ZB], [-SIDE, 0, ZB]]),
    bay: p.quad([[-4.4, 0.002, 3.55], [4.4, 0.002, 3.55], [4.4, 0.002, ZB], [-4.4, 0.002, ZB]]),
    sign: { board: p.quad([[-1.6, 3.2, ZB - 0.01], [1.6, 3.2, ZB - 0.01], [1.6, 3.8, ZB - 0.01], [-1.6, 3.8, ZB - 0.01]]), c: p(0, 3.42, ZB), c2: p(0, 3.26, ZB) },
    panels: [-3, 0, 3].map(x => p.quad([[x - 0.9, CEIL - 0.01, 2.6], [x + 0.9, CEIL - 0.01, 2.6], [x + 0.9, CEIL - 0.01, 3.2], [x - 0.9, CEIL - 0.01, 3.2]])),
    eyewash: { sign: p.quad([[-4.95, 2.2, ZB - 0.01], [-4.25, 2.2, ZB - 0.01], [-4.25, 2.8, ZB - 0.01], [-4.95, 2.8, ZB - 0.01]]), c: p(-4.6, 2.5, ZB), bowl: p.box({ x1: -4.85, x2: -4.35, y1: 1.0, y2: 1.12, z1: ZB - 0.35, z2: ZB }), pipe: p.quad([[-4.63, 0, ZB - 0.02], [-4.57, 0, ZB - 0.02], [-4.57, 1.0, ZB - 0.02], [-4.63, 1.0, ZB - 0.02]]) },
    warn: [p(2.3, 3.8, ZB), p(2.02, 3.3, ZB), p(2.58, 3.3, ZB)],
    fan: { c: p(4.3, 3.55, ZB), r: s * 0.4 },
    drum: p.box({ x1: 3.9, x2: 4.55, y1: 0, y2: 0.92, z1: 2.9, z2: 3.55 }),
    drumLid: p.box({ x1: 3.87, x2: 4.58, y1: 0.92, y2: 0.98, z1: 2.87, z2: 3.58 }),
    drumText: p(4.225, 0.55, 2.9), drumS: p.s(2.9),
    ext: p.box({ x1: 4.7, x2: 4.92, y1: 0.95, y2: 1.55, z1: ZB - 0.22, z2: ZB })
  };
}

let CHARGING;
export function ChargingRoom({ className }) {
  const g = CHARGING || (CHARGING = buildCharging());
  const id = useIds('floor', 'light');
  const faceFill = (side, base) => side === 'left' || side === 'right' ? tone(base, -0.2) : side === 'top' ? tone(base, 0.12) : base;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id.floor} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7d8a95" />
          <stop offset="1" stopColor="#2b333b" />
        </linearGradient>
        <radialGradient id={id.light} cx="600" cy="220" r="700" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f2fbff" stopOpacity=".35" />
          <stop offset="1" stopColor="#f2fbff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="#2b333b" />
      <polygon points={g.ceiling} fill="#8a96a1" />
      {g.panels.map((pn, i) => <polygon key={i} points={pn} fill="#f4fbff" />)}
      <polygon points={g.left} fill="#9aa6b1" />
      <polygon points={g.right} fill="#9aa6b1" />
      <polygon points={g.floor} fill={`url(#${id.floor})`} />
      <polygon points={g.back} fill="#c3ccd4" />
      <polygon points={g.dado} fill="#7f8c98" />
      <polygon points={g.bay} fill="#434d56" />
      {g.stripe.map((s, i) => <polygon key={i} points={s.points} fill={s.fill} />)}
      <polygon points={g.eyewash.sign} fill="#159447" />
      <g transform={`translate(${g.eyewash.c[0]} ${g.eyewash.c[1]}) scale(${g.s / 100})`} fill="#fff">
        <path d="M-18 6 q18 -18 36 0 q-18 18 -36 0z" />
        <circle cx="0" cy="6" r="6" fill="#159447" />
        <path d="M-10 -20 q2 8 -4 12 M0 -24 v12 M10 -20 q-2 8 4 12" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
      <polygon points={g.eyewash.pipe} fill="#8c98a3" />
      {g.eyewash.bowl.map((f, i) => <polygon key={i} points={f.points} fill={faceFill(f.side, '#b8c2cb')} />)}
      {g.chargers.map(ch => <polygon key={'c' + ch.cx} points={ch.conduit} fill="#8e99a4" />)}
      <polygon points={g.sign.board} fill="#f4f6f8" stroke="#1c2a36" strokeWidth={g.s * 0.02} />
      <text x={g.sign.c[0]} y={g.sign.c[1]} textAnchor="middle" className="scene-label" fontSize={g.s * 0.22} fill="#111921">BATTERY CHARGING AREA</text>
      <text x={g.sign.c2[0]} y={g.sign.c2[1] + g.s * 0.02} textAnchor="middle" className="scene-label" fontSize={g.s * 0.13} fill="#c0262b">NO SMOKING · NO NAKED FLAMES · WEAR PPE</text>
      <polygon points={pts(g.warn)} fill={C.yellow} stroke="#111921" strokeWidth={g.s * 0.03} strokeLinejoin="round" />
      <text x={g.warn[0][0]} y={g.warn[1][1] - g.s * 0.05} textAnchor="middle" className="scene-label" fontSize={g.s * 0.28} fill="#111921">!</text>
      <g transform={`translate(${g.fan.c[0]} ${g.fan.c[1]})`}>
        <circle r={g.fan.r} fill="#4f5a64" />
        <circle r={g.fan.r * 0.92} fill="#2b333b" />
        <g className="scene-spin">
          {[0, 72, 144, 216, 288].map(a => <path key={a} transform={`rotate(${a})`} d={`M0 0 q${g.fan.r * 0.5} ${-g.fan.r * 0.2} ${g.fan.r * 0.85} ${g.fan.r * 0.1} q${-g.fan.r * 0.35} ${g.fan.r * 0.3} ${-g.fan.r * 0.85} ${-g.fan.r * 0.1}z`} fill="#a9b4be" />)}
        </g>
        <circle r={g.fan.r * 0.12} fill="#d4dbe1" />
        {[-0.6, -0.2, 0.2, 0.6].map(k => <line key={k} x1={-g.fan.r * 0.9} x2={g.fan.r * 0.9} y1={k * g.fan.r} y2={k * g.fan.r} stroke="#6f7b86" strokeWidth="1.2" opacity=".7" />)}
      </g>
      {g.ext.map((f, i) => <polygon key={i} points={f.points} fill={faceFill(f.side, C.red)} />)}
      {g.chargers.map(ch => (
        <g key={ch.cx}>
          {ch.faces.map((f, i) => <polygon key={i} points={f.points} fill={faceFill(f.side, '#e2e7ec')} />)}
          <polygon points={ch.panel} fill="#cdd5dc" />
          <polygon points={ch.display} fill="#0e1419" />
          <text x={ch.text[0]} y={ch.text[1]} textAnchor="middle" className="scene-led" fontSize={ch.s * 0.12} fill={ch.ok ? C.green : C.amber}>{ch.pct}</text>
          {ch.leds.map((l, i) => <circle key={i} cx={l[0]} cy={l[1]} r={ch.s * 0.025} fill={i === 0 ? (ch.ok ? C.green : '#2b4b33') : i === 1 ? (ch.ok ? '#6b5320' : C.amber) : '#5d2724'} />)}
          {ch.vents.map((v, i) => <polygon key={i} points={v} fill="#aab5bf" />)}
        </g>
      ))}
      {g.batteries.map((b, bi) => (
        <g key={bi}>
          {b.stand.map((f, i) => <polygon key={i} points={f.points} fill={faceFill(f.side, '#4c5661')} />)}
          {b.body.map((f, i) => <polygon key={i} points={f.points} fill={faceFill(f.side, '#38424c')} />)}
          {b.caps.map((c, i) => (
            <g key={i}>
              <polygon points={c.points} fill="#232a31" />
              <circle cx={c.plug[0]} cy={c.plug[1]} r={c.r} fill={c.c} />
            </g>
          ))}
          <polygon points={b.label} fill="#e2e7eb" />
          <polygon points={b.stripe} fill={C.crate} />
          <polygon points={b.conn} fill="#8d98a3" />
        </g>
      ))}
      {g.chargers.map(ch => {
        const [a, b] = ch.cable;
        return <path key={ch.cx} d={`M${a[0]} ${a[1]} C ${a[0]} ${a[1] + 120}, ${b[0] + 30} ${b[1] - 90}, ${b[0]} ${b[1]}`} stroke="#0d1013" strokeWidth={ch.s * 0.045} fill="none" strokeLinecap="round" />;
      })}
      {g.drum.map((f, i) => <polygon key={i} points={f.points} fill={faceFill(f.side, C.yellow)} />)}
      {g.drumLid.map((f, i) => <polygon key={i} points={f.points} fill={faceFill(f.side, '#20262c')} />)}
      <text x={g.drumText[0]} y={g.drumText[1]} textAnchor="middle" className="scene-label" fontSize={g.drumS * 0.13} fill="#111921">SPILL KIT</text>
      <rect width={W} height={H} fill={`url(#${id.light})`} />
    </svg>
  );
}
