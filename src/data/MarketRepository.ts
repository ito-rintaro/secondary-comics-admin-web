import type { MarketRecord } from "../domain/MarketRecord";

// create / update の入力。
// price / change は導出値、listedAt / id はサーバ採番のため入力から除く（§8）。
// catalogId は「入力専用」フィールド。API（openapi.yaml の NewMarketInput）は
// 書誌（title/author/publisher/volume/flags/imageUrl）を catalogId 参照の Catalog から
// 導出するため必須。保存・返却型の MarketRecord には catalogId を持たせない
// （domain/MarketRecord.ts の制約）。localStorage 実装は catalogId を無視して
// フォームが埋めた書誌をそのまま保存する。
export type NewMarketInput = Omit<
  MarketRecord,
  "id" | "price" | "change" | "listedAt"
> & { catalogId: string };

// マーケット相場レコードのデータアクセス抽象（指示書 §7）。
// 画面コードはこの interface にのみ依存し、localStorage 実装と HTTP 実装を差し替える。
export interface MarketRepository {
  list(): Promise<MarketRecord[]>;
  get(id: string): Promise<MarketRecord | null>;
  create(input: NewMarketInput): Promise<MarketRecord>;
  update(id: string, patch: Partial<NewMarketInput>): Promise<MarketRecord>;
  remove(id: string): Promise<void>;
}
