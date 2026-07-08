import type { ConditionFlags } from "./ConditionFlags";

// catalog 単位の相場サマリ。成約ログ（MarketSale）を集計した読み取りモデルで、
// 相場一覧カード・価格チャートの供給源になる（GET /market/summary）。
// バックエンド / openapi.yaml の MarketSummary と一致させること（増減・改名禁止）。
// price / change / history は導出値（成約ログの畳み込み結果）。
// 成約が 1 件以上ある catalog のみ返る（成約 0 件の catalog は含まれない）点に注意。
export interface MarketSummary {
  catalogId: string; // 集計単位＝参照する Catalog の id
  title: string; // 作品名（Catalog 由来）
  author: string; // 著者（Catalog 由来）
  publisher: string; // 出版社 / レーベル（Catalog 由来）
  volume: string; // 巻数（Catalog 由来）
  flags: ConditionFlags; // 付帯状態フラグ（Catalog 由来）
  imageUrl: string; // 画像の S3 オブジェクトキー（Catalog 由来。空文字可）
  price: number; // 現在価格（円）＝ history 末尾（直近月バケット）
  change: number; // 期間変化率 (末尾 - 先頭) / 先頭。0.18 なら +18%
  history: number[]; // 月次に畳んだ擬似価格系列（円）。要素数 12・末尾＝当月
  sampleCount: number; // 集計に使った成約点数（相場の信頼度の目安）
  lastSoldAt: string; // 直近成約日（"YYYY-MM-DD"）
}
