import type { Condition } from "./Condition";
import type { ConditionFlags } from "./ConditionFlags";

// マーケットの成約レコード 1 件（1 件 1 価格の append-only な取引ログ）。
// 全ユーザー共通＝グローバル。バックエンド domain/market/MarketSale.ts /
// openapi.yaml の MarketSale と一致させること（増減・改名禁止）。
// 書誌（title/author/publisher/volume/flags/imageUrl）はサーバが catalogId 参照の
// Catalog から合成する。相場（現在価格・変化率・チャート系列）はこの成約ログを
// 集計した MarketSummary（GET /market/summary）側で導出する。
export interface MarketSale {
  id: string; // レコード識別子（"mk0" 形式。システム生成）
  title: string; // 作品名（Catalog 由来）
  author: string; // 著者（Catalog 由来）
  publisher: string; // 出版社 / レーベル（Catalog 由来）
  volume: string; // 巻数（Catalog 由来）
  flags: ConditionFlags; // 付帯状態フラグ（Catalog 由来）
  imageUrl: string; // 画像の S3 オブジェクトキー（Catalog 由来。ファイル名のみ。空文字可）
  catalogId: string; // 参照する Catalog の id（集計単位）
  condition: Condition; // 状態ランク
  price: number; // 成約価格（円）＝単一
  soldAt: string; // 成約日（"YYYY-MM-DD"）。集計・チャートの時間軸
  seller: string; // 販売元 / ショップ名（空文字可）
}
