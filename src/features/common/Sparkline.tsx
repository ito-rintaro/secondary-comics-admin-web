// 価格推移スパークライン（指示書 §9-2 任意）。history を正規化した折れ線 SVG を描く。
export function Sparkline({
  values,
  width = 96,
  height = 28,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return <span className="sparkline--empty">—</span>;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1; // 全て同値なら平坦線
  const stepX = width / (values.length - 1);
  const pad = 2;
  const usableH = height - pad * 2;

  const points = values
    .map((v, i) => {
      const x = i * stepX;
      const y = pad + usableH - ((v - min) / span) * usableH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const rising = values[values.length - 1] >= values[0];

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="価格推移"
    >
      <polyline
        points={points}
        fill="none"
        stroke={rising ? "var(--pos)" : "var(--neg)"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
