// A picture with a numbered outline around each barcode found in it.
import type { RawScan } from '../core/models';
import type { DecodeResult } from '../decoder/types';

/** The photo with a numbered outline around each barcode found. */
export function Preview({
  imageUrl,
  scans,
  size,
  alt = 'Your photo',
}: {
  imageUrl: string;
  alt?: string;
  scans: RawScan[];
  size: DecodeResult['size'];
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-slate-950">
      <img src={imageUrl} alt={alt} className="block h-auto w-full" />
      {size && scans.length > 0 && (
        <svg
          viewBox={`0 0 ${size.width} ${size.height}`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          {scans.map((scan, i) => {
            const points = scan.corners.map((p) => `${p.x},${p.y}`).join(' ');
            const label = scan.corners[0] ?? { x: 0, y: 0 };
            const stroke = Math.max(size.width, size.height) / 150;
            return (
              <g key={i}>
                <polygon
                  points={points}
                  fill="rgba(52, 211, 153, 0.15)"
                  stroke="#34d399"
                  strokeWidth={stroke}
                />
                {scans.length > 1 && (
                  <text
                    x={label.x}
                    y={label.y - stroke * 2}
                    fill="#34d399"
                    fontSize={stroke * 8}
                    fontWeight="bold"
                  >
                    {i + 1}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
