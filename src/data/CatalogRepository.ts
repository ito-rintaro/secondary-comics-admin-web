import type { Catalog } from "../domain/Catalog";

// カタログ書誌マスタのデータアクセス抽象（指示書 §7）。
// 画面コードはこの interface にのみ依存する。localStorage 実装 → 将来の fetch 実装へ
// 1 実装の交換だけで切り替えられるよう、全メソッドは Promise を返す。
export interface CatalogRepository {
  list(): Promise<Catalog[]>;
  get(id: string): Promise<Catalog | null>;
  create(input: Omit<Catalog, "id">): Promise<Catalog>; // id はリポジトリが採番
  update(id: string, patch: Partial<Omit<Catalog, "id">>): Promise<Catalog>;
  remove(id: string): Promise<void>;
}
