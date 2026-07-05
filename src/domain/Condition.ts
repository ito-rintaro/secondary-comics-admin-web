// 状態ランク。バックエンド domain/collection/Condition.ts / openapi.yaml と一致。
// S=新品・美品 / A=良い / B=並 / C=傷み・難あり
export type Condition = "S" | "A" | "B" | "C";

// 表示・選択用の全ランク（UI のセレクトで使う）。
export const CONDITIONS: readonly Condition[] = ["S", "A", "B", "C"];
