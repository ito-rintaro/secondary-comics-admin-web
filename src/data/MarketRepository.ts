import type { MarketRecord } from "../domain/MarketRecord";

// マーケット相場レコードのデータアクセス抽象（指示書 §7）。
// price / change は導出値のため create の入力からは除く（§8）。
// listedAt は create 時にリポジトリが自動採番（既存最大 +1）する。
export interface MarketRepository {
  list(): Promise<MarketRecord[]>;
  get(id: string): Promise<MarketRecord | null>;
  create(
    input: Omit<MarketRecord, "id" | "price" | "change" | "listedAt">,
  ): Promise<MarketRecord>;
  update(
    id: string,
    patch: Partial<Omit<MarketRecord, "id">>,
  ): Promise<MarketRecord>;
  remove(id: string): Promise<void>;
}
