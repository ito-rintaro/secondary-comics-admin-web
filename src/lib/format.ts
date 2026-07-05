// 表示用フォーマッタ。

/** 円表示（例: 35400 → "¥35,400"）。 */
export const formatYen = (n: number): string =>
  `¥${Math.round(n).toLocaleString("ja-JP")}`;

/** 変化率表示（例: 0.18 → "+18.0%"、-0.05 → "-5.0%"）。 */
export const formatChange = (change: number): string => {
  const pct = change * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
};

/** 付帯フラグを短いバッジ文字列にする（例: "初版 帯 特装"）。 */
export const flagLabels = (flags: {
  firstEd: boolean;
  obi: boolean;
  special: boolean;
}): string[] => {
  const out: string[] = [];
  if (flags.firstEd) out.push("初版");
  if (flags.obi) out.push("帯");
  if (flags.special) out.push("特装");
  return out;
};
