// MarketRecord の導出ルール（指示書 §8）。シード生成 / create / update から共用する。
// price / change は入力させず、必ずここで history から導出する。

export const HISTORY_LENGTH = 12;

// history のバリデーション結果。ok=false のとき reason に理由（フォーム表示用）。
export interface HistoryValidation {
  ok: boolean;
  reason?: string;
}

/** history がちょうど 12 要素・各要素が 0 以上の整数か検証する。 */
export const validateHistory = (history: number[]): HistoryValidation => {
  if (!Array.isArray(history)) {
    return { ok: false, reason: "history は配列である必要があります" };
  }
  if (history.length !== HISTORY_LENGTH) {
    return {
      ok: false,
      reason: `history はちょうど ${HISTORY_LENGTH} 要素である必要があります（現在 ${history.length} 要素）`,
    };
  }
  for (const v of history) {
    if (!Number.isInteger(v) || v < 0) {
      return { ok: false, reason: "history の各要素は 0 以上の整数である必要があります" };
    }
  }
  return { ok: true };
};

/** price = history 末尾。history が空なら 0。 */
export const derivePrice = (history: number[]): number =>
  history.length > 0 ? history[history.length - 1] : 0;

/** change = (末尾 - 先頭) / 先頭。先頭が 0（または空）のときは 0。 */
export const deriveChange = (history: number[]): number => {
  if (history.length === 0) return 0;
  const first = history[0];
  const last = history[history.length - 1];
  if (first === 0) return 0;
  return (last - first) / first;
};

/**
 * history を基に price / change を再導出して差し込む。
 * create / update / シード生成で、保存直前に必ず通す。
 */
export const deriveMarketValues = <T extends { history: number[] }>(
  record: T,
): T & { price: number; change: number } => ({
  ...record,
  price: derivePrice(record.history),
  change: deriveChange(record.history),
});
