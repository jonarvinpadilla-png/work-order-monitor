import { useId } from 'react';
import { C } from './kit';

// Side-view drawings of material handling equipment, facing right, drawn to
// a common scale (1 unit ≈ 2 cm) on a 240 × 150 canvas with the floor at y = 134.

function Wheel({ cx, cy, r }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={C.tire} />
      <circle cx={cx} cy={cy} r={r * 0.62} fill={C.chassisLight} />
      <circle cx={cx} cy={cy} r={r * 0.36} fill={C.hub} />
      <circle cx={cx - r * 0.12} cy={cy - r * 0.14} r={r * 0.12} fill="#fff" opacity=".55" />
    </g>
  );
}

const Shadow = ({ cx, rx }) => <ellipse cx={cx} cy={134} rx={rx} ry={3.6} fill="#000" opacity=".2" />;

function BlueSpot({ cx }) {
  return (
    <g>
      <ellipse cx={cx} cy={134} rx={16} ry={3.4} fill={C.blueSpot} opacity=".22" />
      <ellipse cx={cx} cy={134} rx={9} ry={2} fill={C.blueSpot} opacity=".85" />
    </g>
  );
}

function Operator({ x, y, standing }) {
  // x, y = top of the helmet
  return (
    <g>
      <path d={`M${x - 5} ${y + 5} a5 5 0 0 1 10 0 z`} fill={C.helmet} />
      <rect x={x - 6} y={y + 4.2} width="12" height="1.6" rx=".8" fill={C.yellowShade} />
      <circle cx={x} cy={y + 8} r="3.8" fill={C.skin} />
      <path d={`M${x - 6} ${y + 13} q6 -3 12 0 v${standing ? 16 : 13} h-12 z`} fill={C.vest} />
      <rect x={x - 6} y={y + 20} width="12" height="1.8" fill="#e9eef2" opacity=".9" />
      {standing
        ? <path d={`M${x - 4} ${y + 29} v14 M${x + 3} ${y + 29} v14`} stroke="#2b3440" strokeWidth="4" strokeLinecap="round" />
        : <path d={`M${x - 4} ${y + 26} h9 v8`} stroke="#2b3440" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
    </g>
  );
}

// A loaded pallet: wooden pallet with stacked cartons under shrink-wrap.
function Load({ x, y, w, h = 38, ids }) {
  const deck = 7;
  const top = y - deck - h;
  const cols = 3, rows = 2;
  const cw = w / cols, ch = h / rows;
  return (
    <g>
      <rect x={x} y={y - deck} width={w} height="2.4" fill={C.wood} />
      {[0, 0.5, 1].map(k => <rect key={k} x={x + k * (w - 6)} y={y - deck + 2.4} width="6" height="3" fill={C.woodDark} />)}
      <rect x={x} y={y - 1.8} width={w} height="1.8" fill={C.wood} />
      {Array.from({ length: rows * cols }, (_, i) => {
        const cx = x + (i % cols) * cw, cy = top + Math.floor(i / cols) * ch;
        return (
          <g key={i}>
            <rect x={cx + 0.4} y={cy + 0.4} width={cw - 0.8} height={ch - 0.8} fill={C.kraft[i % C.kraft.length]} />
            <rect x={cx + 0.4} y={cy + ch / 2 - 0.8} width={cw - 0.8} height="1.6" fill="#8c6a43" opacity=".55" />
          </g>
        );
      })}
      <rect x={x + w * 0.38} y={top + h * 0.58} width={w * 0.24} height={h * 0.2} fill="#f4f6f8" />
      {[0, 1, 2, 3, 4, 5].map(k => <rect key={k} x={x + w * 0.4 + k * w * 0.034} y={top + h * 0.62} width={w * 0.012} height={h * 0.1} fill="#222" />)}
      <rect x={x} y={top} width={w} height={h} fill={`url(#${ids.wrap})`} />
    </g>
  );
}

function Defs({ ids }) {
  return (
    <defs>
      <linearGradient id={ids.body} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={C.yellowLight} />
        <stop offset=".35" stopColor={C.yellow} />
        <stop offset="1" stopColor={C.yellowShade} />
      </linearGradient>
      <linearGradient id={ids.mast} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={C.steelLight} />
        <stop offset=".45" stopColor={C.steel} />
        <stop offset="1" stopColor={C.steelDark} />
      </linearGradient>
      <linearGradient id={ids.wrap} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity=".32" />
        <stop offset=".3" stopColor="#fff" stopOpacity=".05" />
        <stop offset=".55" stopColor="#fff" stopOpacity=".22" />
        <stop offset="1" stopColor="#fff" stopOpacity=".04" />
      </linearGradient>
      <pattern id={ids.hz} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="6" height="6" fill={C.yellow} />
        <rect width="3" height="6" fill="#151a1f" />
      </pattern>
    </defs>
  );
}

function Mast({ x, top, ids, bottom = 130 }) {
  return (
    <g>
      <rect x={x} y={top} width="8" height={bottom - top} fill={`url(#${ids.mast})`} />
      <rect x={x + 8} y={top + 4} width="5" height={bottom - top - 4} fill={C.steelDark} />
      <rect x={x} y={top} width="13" height="3" fill={C.steelDark} />
      <rect x={x} y={(top + bottom) / 2} width="13" height="2.5" fill={C.steelDark} />
      <rect x={x + 2.5} y={top + 26} width="3" height={bottom - top - 30} fill={C.steelLight} opacity=".7" />
      <line x1={x + 11.5} y1={top + 5} x2={x + 11.5} y2={bottom - 20} stroke="#171c21" strokeWidth="1.3" strokeDasharray="2 1.2" />
    </g>
  );
}

function Forks({ x, y, len, ids, backrest = true }) {
  return (
    <g>
      {backrest && (
        <g stroke={C.chassis} strokeWidth="1.4" fill="none">
          <rect x={x - 2} y={y - 44} width="6" height="22" />
          <line x1={x + 1} y1={y - 44} x2={x + 1} y2={y - 22} />
        </g>
      )}
      <rect x={x - 2} y={y - 24} width="6" height="26" fill={C.chassis} />
      <path d={`M${x} ${y - 1} H${x + len} l3 3 H${x} Z`} fill={C.fork} />
    </g>
  );
}

function ReachTruck({ ids, load, operator, spot, tall }) {
  const mastTop = tall ? 0 : 6;
  return (
    <g>
      <Shadow cx={112} rx={88} />
      {spot && <BlueSpot cx={206} />}
      <rect x="104" y="124" width="78" height="8" rx="2" fill={C.chassis} />
      <rect x="104" y="124" width="78" height="1.6" fill={C.chassisLight} />
      <Wheel cx={174} cy={129} r={5} />
      <Mast x={106} top={mastTop} ids={ids} />
      <path d="M119 98 l7 -6 l-7 -6" stroke={C.chassis} strokeWidth="2.6" fill="none" />
      <Forks x={124} y={114} len={60} ids={ids} />
      {load && <Load x={126} y={113} w={58} ids={ids} />}
      <path d="M38 131 V86 Q38 76 48 76 H104 V131 Z" fill={`url(#${ids.body})`} />
      <rect x="82" y="76" width="22" height="32" fill={C.chassisLight} />
      <rect x="38" y="116" width="66" height="15" fill={C.chassis} />
      <rect x="46" y="84" width="30" height="26" rx="2" fill={C.yellowShade} opacity=".5" />
      {[0, 1, 2, 3].map(k => <rect key={k} x="50" y={89 + k * 5} width="22" height="1.6" rx=".8" fill={C.yellowDeep} opacity=".55" />)}
      <rect x="38" y="104" width="4.5" height="12" fill={`url(#${ids.hz})`} />
      <rect x="38.5" y="88" width="2.6" height="6" rx="1" fill={C.red} />
      <Wheel cx={58} cy={126} r={8} />
      <rect x="84" y="106" width="20" height="4" fill={C.chassis} />
      <path d="M86 94 h15 v5 h-15z" fill={C.seat} />
      <rect x="83" y="78" width="5" height="21" rx="2" fill={C.seat} />
      <rect x="96" y="84" width="8" height="5" rx="1" fill={C.chassis} />
      <line x1="100" y1="84" x2="102" y2="78" stroke={C.seat} strokeWidth="2" strokeLinecap="round" />
      {operator && <Operator x={93} y={60} />}
      <rect x="64" y="24" width="4" height="54" fill={C.guard} />
      <rect x="99" y="24" width="4" height="54" fill={C.guard} />
      <rect x="60" y="21" width="47" height="4.5" rx="1" fill={C.guard} />
      <rect x="74" y="15" width="6" height="6" rx="2" fill={C.amber} />
      <circle cx="66" cy="30" r="2.4" fill={C.blueSpot} />
    </g>
  );
}

function Forklift({ ids, load, operator, spot, fuel }) {
  return (
    <g>
      <Shadow cx={118} rx={98} />
      {spot && <BlueSpot cx={16} />}
      <Mast x={140} top={12} ids={ids} />
      <line x1="130" y1="100" x2="142" y2="94" stroke={C.steel} strokeWidth="3.4" strokeLinecap="round" />
      <Forks x={157} y={127} len={56} ids={ids} />
      {load && <Load x={160} y={126} w={56} ids={ids} />}
      {fuel === 'diesel' && <rect x="58" y="12" width="4" height="64" fill={C.steelDark} />}
      <path d="M28 128 V92 Q28 74 46 74 H122 L136 90 V128 Z" fill={`url(#${ids.body})`} />
      <path d="M28 128 V100 Q28 88 40 87 H52 V128 Z" fill={C.yellowShade} />
      <rect x="28" y="114" width="108" height="14" fill={C.chassis} />
      <rect x="28" y="100" width="4.5" height="14" fill={`url(#${ids.hz})`} />
      <rect x="28.5" y="92" width="2.6" height="6" rx="1" fill={C.red} />
      <path d="M104 117 A18 18 0 0 1 140 117" stroke={C.chassis} strokeWidth="4" fill="none" />
      <Wheel cx={122} cy={121} r={13} />
      <Wheel cx={50} cy={124} r={10} />
      <path d="M70 70 h22 v5 h-22z" fill={C.seat} />
      <rect x="66" y="50" width="6" height="24" rx="2" fill={C.seat} />
      {operator && <Operator x={80} y={40} />}
      <line x1="106" y1="74" x2="110" y2="61" stroke={C.chassis} strokeWidth="3" strokeLinecap="round" />
      <rect x="103" y="58.4" width="15" height="3.4" rx="1.7" transform="rotate(-58 110.5 60.1)" fill={C.seat} />
      <rect x="60" y="30" width="4" height="46" fill={C.guard} />
      <polygon points="126,30 130,30 136,76 132,76" fill={C.guard} />
      <rect x="56" y="26" width="78" height="4.5" rx="1" fill={C.guard} />
      <rect x="126" y="33" width="5" height="4" rx="1" fill="#fff4c2" />
      <rect x="70" y="20" width="6" height="6" rx="2" fill={C.amber} />
      {fuel === 'diesel' && <rect x="56" y="10" width="8" height="4" rx="1" fill={C.steelDark} />}
      {fuel === 'lpg' && (
        <g>
          <path d="M40 66 v8 M60 66 v8" stroke={C.steelDark} strokeWidth="2.5" />
          <rect x="24" y="50" width="46" height="17" rx="8.5" fill="#dfe4e9" stroke="#98a3ae" strokeWidth="1" />
          <rect x="32" y="50" width="3" height="17" fill="#c3cad1" />
          <rect x="58" y="50" width="3" height="17" fill="#c3cad1" />
          <rect x="68" y="54" width="6" height="8" rx="1" fill={C.steelDark} />
          <path d="M74 58 q8 0 8 12" stroke="#1b2026" strokeWidth="1.6" fill="none" />
        </g>
      )}
    </g>
  );
}

function Tiller({ baseX, baseY }) {
  const tx = baseX - 24, ty = baseY - 34;
  return (
    <g>
      <line x1={baseX} y1={baseY} x2={tx} y2={ty} stroke={C.chassis} strokeWidth="5" strokeLinecap="round" />
      <line x1={baseX - 3} y1={baseY + 2} x2={tx + 2} y2={ty + 6} stroke={C.steelDark} strokeWidth="1.4" />
      <g transform={`rotate(-38 ${tx} ${ty})`}>
        <rect x={tx - 12} y={ty - 5} width="24" height="10" rx="4" fill={C.chassis} />
        <rect x={tx - 10} y={ty - 7} width="5" height="4" rx="1.5" fill={C.yellow} />
        <rect x={tx + 5} y={ty - 7} width="5" height="4" rx="1.5" fill={C.yellow} />
        <circle cx={tx - 13} cy={ty} r="2.4" fill={C.red} />
      </g>
    </g>
  );
}

function PalletTruck({ ids, load, operator }) {
  return (
    <g>
      <Shadow cx={98} rx={70} />
      <path d="M94 124 H152 Q158 124 158 128 V131 H94 Z" fill={C.fork} />
      <Wheel cx={150} cy={130} r={4} />
      <rect x="92" y="94" width="6" height="32" fill={C.chassis} />
      {load && <Load x={98} y={124} w={58} ids={ids} />}
      <rect x="34" y="124" width="20" height="4" rx="1" fill={C.chassis} />
      <path d="M52 131 V80 Q52 70 62 70 H96 V131 Z" fill={`url(#${ids.body})`} />
      <rect x="54" y="70" width="40" height="5" rx="1" fill={C.yellowShade} />
      <rect x="52" y="118" width="46" height="13" fill={C.chassis} />
      <rect x="60" y="80" width="26" height="16" rx="2" fill={C.yellowShade} opacity=".5" />
      <rect x="80" y="64" width="10" height="5" rx="1" fill={C.chassis} />
      <rect x="82" y="65.5" width="6" height="2" fill={C.green} />
      <Wheel cx={70} cy={126} r={8} />
      <Wheel cx={92} cy={130} r={4} />
      <Tiller baseX={64} baseY={72} />
      {operator && <Operator x={38} y={80} standing />}
    </g>
  );
}

function Stacker({ ids, load }) {
  return (
    <g>
      <Shadow cx={100} rx={70} />
      <rect x="104" y="124" width="58" height="7" rx="2" fill={C.chassis} />
      <Wheel cx={156} cy={130} r={4} />
      <Mast x={94} top={18} ids={ids} />
      <Forks x={112} y={104} len={52} ids={ids} />
      {load && <Load x={114} y={103} w={52} ids={ids} />}
      <path d="M50 131 V82 Q50 72 60 72 H94 V131 Z" fill={`url(#${ids.body})`} />
      <rect x="50" y="118" width="46" height="13" fill={C.chassis} />
      <rect x="58" y="82" width="26" height="18" rx="2" fill={C.yellowShade} opacity=".5" />
      <rect x="78" y="66" width="10" height="5" rx="1" fill={C.chassis} />
      <Wheel cx={68} cy={126} r={8} />
      <Tiller baseX={62} baseY={74} />
    </g>
  );
}

function OrderPicker({ ids, operator = true }) {
  return (
    <g>
      <Shadow cx={106} rx={78} />
      <BlueSpot cx={194} />
      <rect x="114" y="124" width="64" height="7" rx="2" fill={C.chassis} />
      <Wheel cx={172} cy={130} r={4} />
      <Mast x={104} top={4} ids={ids} />
      <path d="M118 70 H178 l2 3 H118 Z" fill={C.fork} />
      <rect x="116" y="64" width="44" height="6" fill={C.chassis} />
      <rect x="114" y="13" width="48" height="3.5" rx="1" fill={C.guard} />
      {[118, 154].map(x => <rect key={x} x={x} y="16" width="3" height="48" fill={C.yellowShade} />)}
      <rect x="118" y="30" width="39" height="3" fill={C.yellowShade} />
      <rect x="118" y="46" width="39" height="2.4" fill={C.yellowShade} />
      <rect x="146" y="36" width="10" height="8" rx="1" fill={C.chassis} />
      <circle cx="153" cy="38.5" r="1.4" fill={C.red} />
      {operator && <Operator x={134} y={20} standing />}
      {operator && <path d="M136 36 q10 -14 20 -20" stroke="#e0342c" strokeWidth="1" fill="none" />}
      <path d="M34 131 V94 Q34 86 42 86 H104 V131 Z" fill={`url(#${ids.body})`} />
      <rect x="34" y="118" width="70" height="13" fill={C.chassis} />
      <rect x="34" y="104" width="4.5" height="14" fill={`url(#${ids.hz})`} />
      <rect x="44" y="92" width="32" height="20" rx="2" fill={C.yellowShade} opacity=".5" />
      <Wheel cx={56} cy={126} r={8} />
      <rect x="84" y="80" width="6" height="6" rx="2" fill={C.amber} />
    </g>
  );
}

function ScissorLift({ ids, operator }) {
  const X = (a, b) => <path d={`M68 ${a} L172 ${b} M172 ${a} L68 ${b}`} stroke={C.steel} strokeWidth="5" strokeLinecap="round" />;
  return (
    <g>
      <Shadow cx={120} rx={70} />
      <rect x="60" y="112" width="120" height="16" rx="2" fill={C.chassis} />
      <rect x="62" y="107" width="116" height="7" rx="1" fill={`url(#${ids.body})`} />
      <rect x="70" y="127" width="100" height="2.4" fill={C.steelDark} />
      <Wheel cx={78} cy={127} r={7} />
      <Wheel cx={162} cy={127} r={7} />
      {X(107, 79)}
      {X(79, 51)}
      {[[120, 93], [120, 65], [68, 79], [172, 79]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="2.6" fill={C.steelDark} />)}
      <rect x="56" y="45" width="128" height="6" fill={`url(#${ids.body})`} />
      <rect x="184" y="46" width="18" height="4" fill={C.yellowShade} />
      <rect x="56" y="39" width="128" height="6" fill={C.yellowShade} />
      {[58, 118, 180].map(x => <rect key={x} x={x} y="12" width="3" height="28" fill={C.yellowShade} />)}
      <rect x="58" y="12" width="125" height="3" fill={C.yellowShade} />
      <rect x="58" y="26" width="125" height="2.4" fill={C.yellowShade} />
      <rect x="164" y="16" width="12" height="10" rx="1" fill={C.chassis} />
      <circle cx="170" cy="19.5" r="2" fill={C.red} />
      {operator && <Operator x={138} y={-4} standing />}
    </g>
  );
}

function BoomLift({ ids }) {
  return (
    <g>
      <Shadow cx={96} rx={62} />
      <rect x="40" y="104" width="112" height="20" rx="3" fill={C.chassis} />
      <rect x="44" y="96" width="62" height="11" rx="2" fill={`url(#${ids.body})`} />
      <Wheel cx={62} cy={124} r={10} />
      <Wheel cx={132} cy={124} r={10} />
      <rect x="58" y="84" width="16" height="16" rx="2" fill={C.yellowShade} />
      <rect x="70" y="84" width="40" height="14" rx="2" fill={`url(#${ids.body})`} />
      <line x1="98" y1="88" x2="186" y2="30" stroke={C.yellowShade} strokeWidth="9" strokeLinecap="round" />
      <line x1="100" y1="86" x2="170" y2="40" stroke={C.steel} strokeWidth="3" />
      <line x1="186" y1="30" x2="198" y2="26" stroke={C.steelDark} strokeWidth="4" />
      <rect x="190" y="24" width="40" height="4" fill={C.chassis} />
      <rect x="192" y="8" width="2.6" height="17" fill={C.yellowShade} />
      <rect x="226" y="8" width="2.6" height="17" fill={C.yellowShade} />
      <rect x="192" y="8" width="37" height="2.6" fill={C.yellowShade} />
      <rect x="192" y="16" width="37" height="2" fill={C.yellowShade} />
    </g>
  );
}

function PalletJack({ ids, load }) {
  return (
    <g>
      <Shadow cx={112} rx={72} />
      <path d="M66 122 H176 Q182 122 182 126 V130 H66 Z" fill={`url(#${ids.body})`} />
      <Wheel cx={174} cy={130} r={4} />
      <rect x="66" y="104" width="6" height="20" fill={C.chassis} />
      {load && <Load x={72} y={122} w={104} h={34} ids={ids} />}
      <rect x="56" y="88" width="9" height="14" fill={C.steel} />
      <rect x="52" y="98" width="17" height="26" rx="3" fill={`url(#${ids.body})`} />
      <Wheel cx={60} cy={127} r={7} />
      <line x1="58" y1="92" x2="36" y2="36" stroke={C.chassis} strokeWidth="4" strokeLinecap="round" />
      <path d="M34 34 q-8 -10 2 -14 q12 -4 10 10" stroke={C.chassis} strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <line x1="42" y1="30" x2="46" y2="38" stroke={C.red} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function TowTractor({ ids, operator }) {
  return (
    <g>
      <Shadow cx={86} rx={62} />
      <rect x="28" y="112" width="14" height="4" rx="1" fill={C.steel} />
      <circle cx="31" cy="114" r="2.4" fill={C.steelDark} />
      <path d="M40 128 V88 Q40 78 50 78 H114 L130 98 V128 Z" fill={`url(#${ids.body})`} />
      <rect x="40" y="114" width="90" height="14" fill={C.chassis} />
      <rect x="40" y="100" width="4.5" height="14" fill={`url(#${ids.hz})`} />
      <Wheel cx={62} cy={124} r={10} />
      <Wheel cx={112} cy={124} r={10} />
      <path d="M62 74 h20 v5 h-20z" fill={C.seat} />
      <rect x="58" y="56" width="6" height="22" rx="2" fill={C.seat} />
      {operator && <Operator x={72} y={46} />}
      <line x1="102" y1="78" x2="106" y2="65" stroke={C.chassis} strokeWidth="3" strokeLinecap="round" />
      <rect x="99" y="62.4" width="15" height="3.4" rx="1.7" transform="rotate(-58 106.5 64.1)" fill={C.seat} />
      <rect x="120" y="92" width="6" height="4" rx="1" fill="#fff4c2" />
    </g>
  );
}

function Battery() {
  return (
    <g>
      <Shadow cx={120} rx={78} />
      <rect x="50" y="62" width="140" height="68" rx="3" fill="#3a4550" />
      <rect x="50" y="62" width="140" height="6" fill="#4e5b68" />
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i}>
          <rect x={56 + i * 13} y="55" width="9" height="7" rx="1" fill="#262d34" />
          <circle cx={60.5 + i * 13} cy="54.5" r="2" fill={i % 2 ? C.yellow : '#e3e8ec'} />
        </g>
      ))}
      <path d="M58 60 h122" stroke={C.red} strokeWidth="1.4" strokeDasharray="6 7" />
      <circle cx="60" cy="74" r="3.4" stroke="#8f9aa5" strokeWidth="2" fill="none" />
      <circle cx="180" cy="74" r="3.4" stroke="#8f9aa5" strokeWidth="2" fill="none" />
      <rect x="72" y="84" width="64" height="30" rx="2" fill="#e5eaee" />
      <rect x="72" y="84" width="64" height="6" rx="2" fill={C.crate} />
      {[96, 102, 108].map(y => <rect key={y} x="78" y={y} width={y === 108 ? 30 : 50} height="2" fill="#9aa5b0" />)}
      <path d="M182 56 C 200 34, 218 56, 214 86" stroke="#111" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="204" y="84" width="20" height="15" rx="2" fill="#8d98a3" />
      <rect x="208" y="99" width="12" height="4" rx="1" fill="#6a757f" />
    </g>
  );
}

function Charger() {
  return (
    <g>
      <rect x="66" y="12" width="108" height="5" fill={C.steelDark} />
      <rect x="72" y="16" width="96" height="94" rx="4" fill="#e3e8ed" stroke="#b5bfc9" />
      <rect x="80" y="24" width="80" height="42" rx="3" fill="#cfd6dd" />
      <rect x="88" y="30" width="44" height="20" rx="2" fill="#0f151b" />
      <text x="92" y="44.5" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700" fill={C.green}>80%</text>
      {[0, 1, 2, 3].map(k => <rect key={k} x={92 + k * 9} y="53" width="7" height="6" rx="1" fill={k < 3 ? C.green : '#3b4753'} />)}
      <circle cx="144" cy="34" r="3" fill={C.green} />
      <circle cx="144" cy="44" r="3" fill="#8f6a1c" />
      <circle cx="144" cy="54" r="3" fill="#6d2a27" />
      {Array.from({ length: 7 }, (_, k) => <rect key={k} x="84" y={74 + k * 4.4} width="72" height="1.8" rx=".9" fill="#aeb8c2" />)}
      <path d="M150 110 C 150 130, 184 134, 198 122" stroke="#111" strokeWidth="5" fill="none" strokeLinecap="round" />
      <rect x="194" y="108" width="20" height="15" rx="2" fill="#8d98a3" />
      <ellipse cx="206" cy="134" rx="16" ry="2.4" fill="#000" opacity=".16" />
    </g>
  );
}

const ART = {
  'Reach Truck': ReachTruck,
  'VNA Truck': props => <ReachTruck {...props} tall />,
  'Counterbalance Forklift (Electric)': Forklift,
  'Counterbalance Forklift (LPG)': props => <Forklift {...props} fuel="lpg" />,
  'Counterbalance Forklift (Diesel)': props => <Forklift {...props} fuel="diesel" />,
  'Electric Pallet Truck': PalletTruck,
  'Electric Stacker': Stacker,
  'Order Picker': OrderPicker,
  'Tow Tractor': TowTractor,
  'Manual Pallet Jack': PalletJack,
  'Scissor Lift': ScissorLift,
  'Boom Lift': BoomLift,
  'Traction Battery': Battery,
  'Battery Charger': Charger
};

export const hasMheArt = type => !!ART[type];

// <MheArt type="Reach Truck" load operator /> — decorative by default.
// Pass x/y/width/height to place it inside another SVG.
export default function MheArt({ type, load = false, operator = false, spot = true, flip = false, className, label, ...place }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const ids = { body: `b${uid}`, mast: `m${uid}`, wrap: `w${uid}`, hz: `h${uid}` };
  const Art = ART[type] || Forklift;
  return (
    <svg viewBox="0 0 240 150" className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}
         overflow="visible" {...place}>
      <Defs ids={ids} />
      <g transform={flip ? 'translate(240 0) scale(-1 1)' : undefined}>
        <Art ids={ids} load={load} operator={operator} spot={spot} />
      </g>
    </svg>
  );
}
