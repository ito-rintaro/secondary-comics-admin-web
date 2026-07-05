import type { Condition } from "./Condition";
import type { ConditionFlags } from "./ConditionFlags";

// マーケット相場レコード 1 件（全ユーザー共通＝グローバル）。
// バックエンド domain/market/MarketRecord.ts / openapi.yaml と一致させること。
// 現行定義に合わせ catalogId は持たない（保存する型に勝手に足さないこと）。
export interface MarketRecord {
  id: string; // レコード識別子（"mk0" 形式）
  title: string; // 作品名
  author: string; // 著者
  publisher: string; // 出版社 / レーベル
  volume: string; // 巻数
  seller: string; // 出品者 / ショップ名
  condition: Condition; // 状態ランク
  flags: ConditionFlags; // 付帯状態フラグ
  history: number[]; // 直近 12 ヶ月の価格推移（円）。要素数 12・末尾が現在価格
  price: number; // 現在価格（円）。history の末尾と一致
  change: number; // 期間変化率 (末尾 - 先頭) / 先頭。0.18 なら +18%
  listedAt: number; // 新着ソート用の連番（大きいほど新しい）
  imageUrl: string; // 画像の S3 オブジェクトキー（ファイル名のみ。空文字可）
}
