type Point = { x: number; y: number; label?: string };

/** Lightweight orange line chart — no chart library dependency. */
export function SparkLine({
  points,
  height = 160,
  emptyLabel = 'No public series yet',
}: {
  points: Point[];
  height?: number;
  emptyLabel?: string;
}) {
  if (points.length < 2) {
    return (
      <div
        className="grid place-items-center rounded-lg border border-dashed border-strong bg-surface text-[0.82rem] text-hint"
        style={{ height }}
      >
        {emptyLabel}
      </div>
    );
  }

  const width = 640;
  const pad = 12;
  const ys = points.map((point) => point.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanY = Math.max(maxY - minY, 1);
  const stepX = (width - pad * 2) / (points.length - 1);

  const coords = points.map((point, index) => {
    const x = pad + index * stepX;
    const y = height - pad - ((point.y - minY) / spanY) * (height - pad * 2);
    return { x, y, label: point.label };
  });

  const line = coords.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`).join(' ');
  const area = `${line} L${coords[coords.length - 1].x},${height - pad} L${coords[0].x},${height - pad} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img">
      <defs>
        <linearGradient id="metricsFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ff6c2f" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ff6c2f" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#metricsFill)" />
      <path d={line} fill="none" stroke="#ff6c2f" strokeWidth="3" strokeLinejoin="round" />
      {coords.map((point, index) => (
        <circle key={index} cx={point.x} cy={point.y} r="3.5" fill="#111110" stroke="#ff6c2f" strokeWidth="2" />
      ))}
    </svg>
  );
}
