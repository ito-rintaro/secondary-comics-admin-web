import type { ConditionFlags } from "../domain/ConditionFlags";
import type { MarketSale } from "../domain/MarketSale";
import type { MarketSummary } from "../domain/MarketSummary";

// create / update の入力＝成約 1 件（指示書 §4）。
// API（openapi.yaml の NewMarketInput）へ送るのは catalogId / condition / price /
// soldAt / seller の 5 項目のみ。id はサーバ採番のため含めない。
// 書誌（title/author/publisher/volume/flags/imageUrl）はサーバが catalogId 参照の
// Catalog から合成するため API へは送らないが、モック（localStorage）は Catalog を
// 参照しないため、フォームがカタログから埋めた書誌をここに載せて保存に使う。
// → HttpMarketRepository はこれらを捨て、LocalMarketRepository はそのまま保存する。
export interface NewMarketInput {
  // API へ送る成約固有情報
  catalogId: string;
  condition: string; // 鑑定記録（自由文字列。分類未確定のため型で縛らない。空文字可）
  price: number; // 成約価格（円・0 以上の整数）
  soldAt: string; // 成約日（"YYYY-MM-DD"）
  seller: string; // 販売元 / ショップ名（空文字可）
  // モック保存用の書誌（フォームが選択カタログから埋める。API へは送らない）
  title: string;
  author: string;
  publisher: string;
  volume: string;
  flags: ConditionFlags;
  imageUrl: string;
}

// マーケットのデータアクセス抽象（指示書 §1）。成約ログ（MarketSale）の CRUD と、
// catalog 単位に集計した相場サマリ（MarketSummary）の読み取りを提供する。
// 画面コードはこの interface にのみ依存し、localStorage 実装と HTTP 実装を差し替える。
export interface MarketRepository {
  // 成約ログ（GET /market）
  list(): Promise<MarketSale[]>;
  get(id: string): Promise<MarketSale | null>;
  // 相場サマリ（GET /market/summary）。相場一覧カード・チャートの供給源。
  summary(): Promise<MarketSummary[]>;
  // 成約の登録 / 更新 / 削除（editor）
  create(input: NewMarketInput): Promise<MarketSale>;
  update(id: string, patch: Partial<NewMarketInput>): Promise<MarketSale>;
  remove(id: string): Promise<void>;
}
