import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

// A QR code drawn as SVG. It is generated in the browser, so labels can be
// printed without internet access. Level Q survives about a quarter of the
// code being scratched or dirty, which suits stickers on equipment.
export default function QrCode({ text, level = 'Q', margin = 4, className, title }) {
  const { size, d } = useMemo(() => {
    const qr = qrcode(0, level);
    qr.addData(text, 'Byte');
    qr.make();
    const n = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!qr.isDark(r, c)) continue;
        let run = 1;
        while (c + run < n && qr.isDark(r, c + run)) run++;
        path += `M${c + margin} ${r + margin}h${run}v1h-${run}z`;
        c += run - 1;
      }
    }
    return { size: n + margin * 2, d: path };
  }, [text, level, margin]);
  return (
    <svg className={className} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={title || `QR code: ${text}`} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
