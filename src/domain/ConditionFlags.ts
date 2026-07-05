// 付帯状態フラグ。バックエンド domain/collection/ConditionFlags.ts / openapi.yaml と一致。
export interface ConditionFlags {
  firstEd: boolean; // 初版かどうか
  obi: boolean; // 帯付きかどうか
  special: boolean; // 特装・サイン等の特別仕様かどうか
}
