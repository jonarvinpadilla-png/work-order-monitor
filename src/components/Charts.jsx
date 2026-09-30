import { useState } from 'react';

// Bar with 4px rounding on the data end only; the baseline end stays square.
function columnPath(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function niceMax(v) {
  if (v <= 4) return 4;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

// Grouped weekly columns: one colour per series, legend above, the latest
// period labelled directly, hover shows the whole period.
export function ColumnChart({ data, series, xLabel, height = 220, ariaLabel }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = height, pad = { l: 30, r: 8, t: 18, b: 26 };
  const innerW = W - pad.l - pad.r, innerH = H - pad.t - pad.b;
  const max = niceMax(Math.max(1, ...data.flatMap(d => series.map(s => d[s.key]))));
  const band = innerW / data.length;
  const gap = 2;
  const barW = Math.min(14, (band * 0.7 - gap * (series.length - 1)) / series.length);
  const groupW = barW * series.length + gap * (series.length - 1);
  const y = v => pad.t + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const last = data.length - 1;
  return (
    <div className="chart">
      <div className="legend">
        {series.map(s => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel}>
        {ticks.map(t => (
          <g key={t} className="axis">
            <line className={t === 0 ? 'baseline' : 'gridline'} x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} />
            <text x={pad.l - 6} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const gx = pad.l + band * i + (band - groupW) / 2;
          return (
            <g key={i}>
              {series.map((s, k) => {
                const v = d[s.key];
                const x = gx + k * (barW + gap);
                return (
                  <g key={s.key}>
                    <path className="mark" d={columnPath(x, y(v), barW, pad.t + innerH - y(v))} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.45} />
                    {i === last && v > 0 && <text className="val" x={x + barW / 2} y={y(v) - 5} textAnchor="middle">{v}</text>}
                  </g>
                );
              })}
              {(i % 2 === last % 2) && (
                <text className="lbl" x={pad.l + band * i + band / 2} y={H - 6} textAnchor="middle">{xLabel(d)}</text>
              )}
              <rect className="hit" x={pad.l + band * i} y={pad.t} width={band} height={innerH}
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="chart-tip" style={{ left: `${((pad.l + band * hover + band / 2) / W) * 100}%`, top: `${(pad.t / H) * 100 + 8}%` }}>
          <div>Week of {xLabel(data[hover])}</div>
          {series.map(s => <div key={s.key}>{s.label}: <b>{data[hover][s.key]}</b></div>)}
        </div>
      )}
    </div>
  );
}

// Horizontal bars for ranking one measure (single hue, value at the bar end).
export function BarList({ rows, format = v => v, empty = 'No data yet.', color }) {
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...rows.map(r => r.value));
  if (!rows.length || rows.every(r => !r.value)) return <p className="mute" style={{ margin: '8px 0' }}>{empty}</p>;
  return (
    <div className="barlist">
      {rows.map((r, i) => (
        <div key={r.key ?? r.label} className="barlist-row" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
             title={r.tip}>
          <span className="lbl">{r.label}</span>
          <span className="track">
            <span className="bar" style={{ display: 'block', width: `${(r.value / max) * 100}%`, background: color, opacity: hover === null || hover === i ? 1 : 0.5 }} />
          </span>
          <span className="v">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function MeterBar({ pct }) {
  return (
    <div className="meter-track" role="meter" aria-valuenow={pct ?? 0} aria-valuemin={0} aria-valuemax={100}>
      <div className="meter-fill" style={{ width: `${Math.max(0, Math.min(100, pct ?? 0))}%` }} />
    </div>
  );
}
