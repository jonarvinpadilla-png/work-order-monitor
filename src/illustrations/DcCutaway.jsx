import { useId, useMemo } from 'react';
import { C, rng } from './kit';
import MheArt from './Mhe';

// Side cutaway of a cold-chain distribution centre: office, dry (ambient),
// chiller and freezer storage, and the dock. Colours come from --cut-* CSS
// variables so the scene switches between day (light theme) and night (dark).
// `counts` puts a live open-job badge on each zone.

const VW = 1600, VH = 420, GROUND = 318, SKY = 60; // SKY: extra headroom above the drawing for the page title
const ZONES = [
  { key: 'office', label: 'OFFICE', x1: 162, x2: 330 },
  { key: 'dry', label: 'DRY · AMBIENT', x1: 338, x2: 790 },
  { key: 'chiller', label: 'CHILLER · 0–4 °C', x1: 798, x2: 1060, tint: 0.1 },
  { key: 'freezer', label: 'FREEZER · ≤ −18 °C', x1: 1068, x2: 1300, tint: 0.2 },
  { key: 'docks', label: 'DOCKS', x1: 1308, x2: 1458 }
];
const roofY = x => (x < 810 ? 152 - ((x - 140) * 26) / 670 : 126 + ((x - 810) * 26) / 670);

function Racks({ x1, x2, seed }) {
  const r = rng(seed);
  const bay = 62;
  const levels = [GROUND - 2, 280, 242, 204];
  const shapes = [];
  for (let x = x1; x + bay <= x2 + 1; x += bay) {
    levels.forEach((y, li) => {
      [x + 4, x + 33].forEach(px => {
        if (r() < 0.14) return;
        const k = r();
        const col = k < 0.2 ? C.white : k < 0.3 ? C.crate : C.kraft[Math.floor(r() * C.kraft.length)];
        const h = 26 + r() * 6;
        shapes.push(<rect key={`p${x}${li}${px}`} x={px} y={y - 4 - h} width="25" height={h} fill={col} />);
        shapes.push(<rect key={`s${x}${li}${px}`} x={px} y={y - 4 - h / 2} width="25" height="1" fill="#000" opacity=".18" />);
        shapes.push(<rect key={`w${x}${li}${px}`} x={px} y={y - 4} width="25" height="4" fill={C.wood} />);
      });
      if (li > 0) shapes.push(<rect key={`b${x}${li}`} x={x} y={y} width={bay} height="4" fill={C.beam} />);
    });
    shapes.push(<rect key={`u${x}`} x={x - 1.5} y="196" width="3" height={GROUND - 196} fill={C.upright} />);
  }
  shapes.push(<rect key="ulast" x={x1 + Math.floor((x2 - x1) / bay) * bay - 1.5} y="196" width="3" height={GROUND - 196} fill={C.upright} />);
  return <g>{shapes}</g>;
}

function Badge({ x, count }) {
  if (!count) return null;
  const w = count > 9 ? 88 : 78;
  return (
    <g transform={`translate(${x - w / 2} 195)`}>
      <rect width={w} height="24" rx="12" fill="var(--cut-badge)" />
      <circle cx="13" cy="12" r="5" fill={C.yellow} />
      <text x="24" y="17" className="cut-badge-text">{count} open</text>
    </g>
  );
}

export default function DcCutaway({ className, counts = {} }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const sky = `sky${uid}`, glow = `glow${uid}`;
  const stars = useMemo(() => {
    const r = rng(21);
    return Array.from({ length: 40 }, () => [r() * VW, r() * 110, 0.6 + r() * 1.2]);
  }, []);
  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMaxYMax slice" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--cut-sky-1)' }} />
          <stop offset="1" style={{ stopColor: 'var(--cut-sky-2)' }} />
        </linearGradient>
        <radialGradient id={glow}>
          <stop offset="0" style={{ stopColor: 'var(--cut-lamp)' }} stopOpacity=".9" />
          <stop offset="1" style={{ stopColor: 'var(--cut-lamp)' }} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width={VW} height={SKY + 1} style={{ fill: 'var(--cut-sky-1)' }} />
      <g transform={`translate(0 ${SKY})`}>
      <rect width={VW} height={GROUND} fill={`url(#${sky})`} />
      <g style={{ opacity: 'var(--cut-stars)' }}>
        {stars.map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#fff" />)}
      </g>
      <circle cx="1530" cy="62" r="24" style={{ fill: 'var(--cut-sun)' }} />
      <path d="M0 300 Q120 262 260 286 T560 280 T900 290 T1250 276 T1600 288 V318 H0 Z" style={{ fill: 'var(--cut-far)' }} />

      {/* genset container and yard lighting */}
      <rect x="44" y="270" width="92" height="48" rx="2" style={{ fill: 'var(--cut-genset)' }} />
      {[0, 1, 2, 3, 4, 5].map(k => <rect key={k} x={54 + k * 12} y="280" width="6" height="28" fill="#000" opacity=".18" />)}
      <rect x="120" y="244" width="6" height="28" fill="#56616c" />
      <rect x="117" y="241" width="12" height="4" fill="#3b444d" />
      <rect x="20" y="210" width="3" height="108" fill="#56616c" />
      <rect x="14" y="206" width="16" height="5" rx="2" fill="#56616c" />
      <ellipse cx="22" cy="214" rx="12" ry="6" style={{ fill: 'var(--cut-lamp)', opacity: 'var(--cut-lamp-on)' }} />

      {/* building shell */}
      <rect x="150" y="152" width="1320" height={GROUND - 152} style={{ fill: 'var(--cut-cut)' }} />
      <rect x="162" y="160" width="1296" height={GROUND - 160} style={{ fill: 'var(--cut-interior)' }} />
      <polygon points={`140,152 810,126 1480,152 1480,160 140,160`} style={{ fill: 'var(--cut-roof)' }} />

      {/* roof plant: refrigeration condensing units and vents */}
      {[[890, 70], [990, 54], [1120, 70], [1210, 70]].map(([x, w]) => {
        const y = roofY(x + w / 2);
        return (
          <g key={x}>
            <rect x={x + 6} y={y - 4} width="4" height="6" fill="#56616c" />
            <rect x={x + w - 10} y={y - 4} width="4" height="6" fill="#56616c" />
            <rect x={x} y={y - 28} width={w} height="24" rx="2" fill="#c9d1d8" stroke="#8d98a3" />
            {Array.from({ length: Math.floor(w / 26) }, (_, k) => (
              <g key={k}>
                <circle cx={x + 14 + k * 26} cy={y - 16} r="9" fill="#5a6570" />
                <circle cx={x + 14 + k * 26} cy={y - 16} r="3" fill="#aab4be" />
              </g>
            ))}
          </g>
        );
      })}
      {[420, 620].map(x => <rect key={x} x={x} y={roofY(x) - 14} width="10" height="14" fill="#7d8893" />)}

      {/* zones */}
      {ZONES.filter(z => z.tint).map(z => (
        <rect key={z.key} x={z.x1} y="160" width={z.x2 - z.x1} height={GROUND - 160} fill="#5aa4e6" opacity={z.tint} />
      ))}
      {[330, 790, 1060, 1300].map(x => (
        <g key={x}>
          <rect x={x} y="160" width="8" height={GROUND - 160} style={{ fill: 'var(--cut-panel)' }} />
          <rect x={x + 3.5} y="160" width="1" height={GROUND - 160} fill="#000" opacity=".12" />
        </g>
      ))}

      {/* office: two floors with windows and a stair */}
      <rect x="162" y="236" width="168" height="6" fill="#8d98a3" />
      {[172, 214, 256, 298].map(x => (
        <g key={x}>
          <rect x={x} y="176" width="26" height="40" rx="1" style={{ fill: 'var(--cut-window)' }} />
          <rect x={x} y="254" width="26" height="40" rx="1" style={{ fill: 'var(--cut-window)' }} />
        </g>
      ))}
      <path d="M176 318 L240 242" stroke="#8d98a3" strokeWidth="4" />
      {[186, 262].map(x => (
        <g key={x}>
          <rect x={x} y="224" width="34" height="3" fill="#6d7883" />
          <rect x={x + 10} y="210" width="14" height="10" rx="1" fill="#26303a" />
          <rect x={x} y="302" width="34" height="3" fill="#6d7883" />
          <rect x={x + 10} y="288" width="14" height="10" rx="1" fill="#26303a" />
        </g>
      ))}

      {/* storage */}
      <Racks x1={352} x2={770} seed={4} />
      <Racks x1={814} x2={1044} seed={8} />
      <Racks x1={1084} x2={1286} seed={12} />
      <g opacity=".7">
        {Array.from({ length: 18 }, (_, i) => <circle key={i} cx={1080 + ((i * 53) % 210)} cy={170 + ((i * 37) % 140)} r="1.4" fill="#fff" />)}
      </g>

      {/* docks: doors in the back wall, staged pallets, canopy outside */}
      {[1318, 1390].map((x, i) => (
        <g key={x}>
          <rect x={x - 4} y="236" width="64" height="82" fill="#1a1f25" />
          <rect x={x} y="240" width="56" height="78" style={{ fill: i === 0 ? 'var(--cut-yard)' : 'var(--cut-door)' }} />
          {i === 0
            ? <rect x={x} y="240" width="56" height="22" style={{ fill: 'var(--cut-door)' }} />
            : [252, 266, 280, 294, 308].map(y => <rect key={y} x={x} y={y} width="56" height="1.4" fill="#000" opacity=".2" />)}
          <rect x={x + 18} y="222" width="20" height="9" rx="1" fill={C.yellow} />
        </g>
      ))}
      <rect x="1470" y="226" width="96" height="6" style={{ fill: 'var(--cut-roof)' }} />
      <line x1="1560" y1="232" x2="1560" y2={GROUND} stroke="#56616c" strokeWidth="3" />
      {[1474, 1474].map((x, i) => <rect key={i} x={x} y={286 + i * 14} width="8" height="12" rx="1" fill="#15191e" />)}

      {/* high-bay lights */}
      {[240, 420, 560, 700, 880, 980, 1150, 1240, 1380].map(x => (
        <g key={x}>
          <ellipse cx={x} cy="178" rx="26" ry="14" fill={`url(#${glow})`} style={{ opacity: 'var(--cut-lamp-on)' }} />
          <rect x={x - 7} y="166" width="14" height="4" rx="2" fill="#7d8893" />
        </g>
      ))}

      {/* equipment at work */}
      <MheArt type="Reach Truck" load operator x="508" y={GROUND - 112} width="180" height="112" />
      <MheArt type="Reach Truck" operator flip x="880" y={GROUND - 112} width="180" height="112" />
      <MheArt type="Reach Truck" load operator x="1100" y={GROUND - 112} width="180" height="112" />
      <MheArt type="Electric Pallet Truck" load operator flip x="1320" y={GROUND - 76} width="122" height="76" />

      {/* zone signs and live job counts */}
      {ZONES.map(z => {
        const cx = (z.x1 + z.x2) / 2;
        const w = z.label.length * 8.6 + 22;
        return (
          <g key={z.key}>
            <line x1={cx - w / 2 + 8} y1="160" x2={cx - w / 2 + 8} y2="166" stroke="#56616c" />
            <line x1={cx + w / 2 - 8} y1="160" x2={cx + w / 2 - 8} y2="166" stroke="#56616c" />
            <rect x={cx - w / 2} y="165" width={w} height="24" rx="2" style={{ fill: 'var(--cut-sign)' }} />
            <text x={cx} y="182" textAnchor="middle" className="cut-sign-text">{z.label}</text>
            <Badge x={cx} count={counts[z.key]} />
          </g>
        );
      })}

      {/* yard */}
      <rect y={GROUND} width={VW} height={VH - GROUND} style={{ fill: 'var(--cut-ground)' }} />
      <rect y={GROUND} width={VW} height="3" style={{ fill: 'var(--cut-curb)' }} />
      {[1500, 1540, 1580].map(x => <rect key={x} x={x} y={GROUND + 18} width="26" height="3" fill={C.yellow} opacity=".8" />)}
      </g>
    </svg>
  );
}

export const DC_ZONES = ZONES.map(z => ({ key: z.key, label: z.label }));
