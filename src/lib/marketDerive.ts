import type { MarketSale } from "../domain/MarketSale";
import type { MarketSummary } from "../domain/MarketSummary";

// 成約ログ（MarketSale）から相場サマリ（MarketSummary）を導出するルール（指示書 §5-6）。
// サーバ（GET /market/summary）が行う集計を、モックモードでも同じ畳み込みで再現する。
// 実 API では HttpMarketRepository が /market/summary をそのまま呼ぶため、こちらは使わない。

export const HISTORY_LENGTH = 12;

// "YYYY-MM-DD" を年 / 月(0-11) / 日 に分解する。書式不正なら null。
function parseYmd(
  s: string,
): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

// 年月を単調増加する連番（year*12 + month）に落とす。月バケットの位置決めに使う。
const monthIndex = (y: number, m: number): number => y * 12 + m;

/** price（成約価格）が 0 以上の整数か検証する。 */
export const validatePrice = (price: number): boolean =>
  Number.isInteger(price) && price >= 0;

/** soldAt が "YYYY-MM-DD" 書式かつ実在する暦日か検証する（未来日は許容）。 */
export const validateSoldAt = (soldAt: string): boolean => {
  const p = parseYmd(soldAt);
  if (!p) return false;
  const d = new Date(p.y, p.m, p.d);
  return (
    d.getFullYear() === p.y && d.getMonth() === p.m && d.getDate() === p.d
  );
};

// 月次平均系列（欠損は null）を折れ線用に埋める。
// 1) 前方フィル：欠損は直前月の値をキャリー。
// 2) バックフィル：最初の非空値より前の欠損は、その最初の非空値で埋める。
// 3) 全欠損（窓内に成約なし）は fallback（直近成約価格）で全埋めする。
function fillHistory(avg: (number | null)[], fallback: number): number[] {
  const out = avg.slice();
  let prev: number | null = null;
  for (let i = 0; i < out.length; i++) {
    if (out[i] === null) out[i] = prev;
    else prev = out[i];
  }
  const firstNonNull = out.find((v) => v !== null) ?? null;
  const fillVal = firstNonNull ?? fallback;
  return out.map((v) => (v === null ? fillVal : v)) as number[];
}

/**
 * 成約ログを catalog 単位に集計して MarketSummary[] を導出する（指示書 §6 の畳み込み）。
 * - 直近 12 ヶ月（now を含む月が末尾）の月バケットに成約価格を振り分け、月内は平均。
 * - 窓より古い成約は先頭バケットへ、未来日の成約は末尾バケットへクランプする。
 * - history は前方フィル＋バックフィルで 12 要素を成立させる。
 * - price = history 末尾、change = (末尾 - 先頭)/先頭、sampleCount = 成約点数、
 *   lastSoldAt = 直近成約日。書誌は直近成約（＝最新の soldAt）から採る。
 * 成約 0 件の catalog は結果に含まれない（サーバ仕様と同じ）。
 */
export function deriveSummaries(
  sales: MarketSale[],
  now: Date = new Date(),
): MarketSummary[] {
  const nowIdx = monthIndex(now.getFullYear(), now.getMonth());
  const startIdx = nowIdx - (HISTORY_LENGTH - 1); // 先頭バケットの月インデックス

  // catalogId ごとにグルーピング（挿入順を保つ）。
  const groups = new Map<string, MarketSale[]>();
  for (const s of sales) {
    const arr = groups.get(s.catalogId);
    if (arr) arr.push(s);
    else groups.set(s.catalogId, [s]);
  }

  const summaries: MarketSummary[] = [];
  for (const [catalogId, group] of groups) {
    const buckets: number[][] = Array.from(
      { length: HISTORY_LENGTH },
      () => [],
    );
    // 書誌の採用元＝直近成約（soldAt が最大。同日なら後勝ち）。
    let latest = group[0];
    for (const s of group) {
      if (s.soldAt >= latest.soldAt) latest = s;
      const p = parseYmd(s.soldAt);
      if (!p) continue;
      let offset = monthIndex(p.y, p.m) - startIdx;
      if (offset < 0) offset = 0; // 窓より古い → 先頭バケットへ
      if (offset > HISTORY_LENGTH - 1) offset = HISTORY_LENGTH - 1; // 未来 → 末尾バケットへ
      buckets[offset].push(s.price);
    }

    const avg: (number | null)[] = buckets.map((b) =>
      b.length
        ? Math.round(b.reduce((a, x) => a + x, 0) / b.length)
        : null,
    );
    const history = fillHistory(avg, latest.price);
    const price = history[history.length - 1];
    const first = history[0];
    const change = first === 0 ? 0 : (price - first) / first;

    summaries.push({
      catalogId,
      title: latest.title,
      author: latest.author,
      publisher: latest.publisher,
      volume: latest.volume,
      flags: latest.flags,
      imageUrl: latest.imageUrl,
      price,
      change,
      history,
      sampleCount: group.length,
      lastSoldAt: latest.soldAt,
    });
  }
  return summaries;
}
