import type { ConditionFlags } from "./ConditionFlags";

// 書誌マスタ 1 件。Collection / MarketRecord が参照する hub。
// バックエンド domain/catalog/Catalog.ts / openapi.yaml と一致させること（増減・改名禁止）。
export interface Catalog {
  id: string; // カタログ識別子（"cat-001" 形式）
  title: string; // 作品名
  author: string; // 著者
  publisher: string; // 出版社 / レーベル
  volume: string; // 巻数（"全6巻" "第1巻" 等の自由文字列）
  year: string; // 発行年（文字列）
  flags: ConditionFlags; // 付帯状態フラグ（初版 / 帯 / 特装）
  imageUrl: string; // 画像の S3 オブジェクトキー（ファイル名のみ。空文字可）
}
