import type { CatalogRepository } from "../data/CatalogRepository";
import type { MarketRepository } from "../data/MarketRepository";
import { LocalCatalogRepository } from "../data/localStorage/LocalCatalogRepository";
import { LocalMarketRepository } from "../data/localStorage/LocalMarketRepository";

// 依存の組み立て（DI コンテナ）。
// 画面は interface（CatalogRepository / MarketRepository）にのみ依存し、
// 具体実装の選択はここ 1 箇所に閉じ込める（指示書 §7）。
//
// 将来 Lambda に編集系 API が生えたら、HttpCatalogRepository / HttpMarketRepository を
// 実装し、VITE_USE_API === 'true' のときそちらを返すように差し替える。
// ベース URL は既存 web と同名の VITE_API_BASE_URL を使う。

const useApi = import.meta.env.VITE_USE_API === "true";

const createCatalogRepository = (): CatalogRepository => {
  if (useApi) {
    // TODO: return new HttpCatalogRepository(import.meta.env.VITE_API_BASE_URL);
    throw new Error(
      "VITE_USE_API=true だが編集系 API 実装（HttpCatalogRepository）が未実装です。",
    );
  }
  return new LocalCatalogRepository();
};

const createMarketRepository = (): MarketRepository => {
  if (useApi) {
    // TODO: return new HttpMarketRepository(import.meta.env.VITE_API_BASE_URL);
    throw new Error(
      "VITE_USE_API=true だが編集系 API 実装（HttpMarketRepository）が未実装です。",
    );
  }
  return new LocalMarketRepository();
};

// アプリ全体で共有する単一インスタンス。
export const catalogRepository: CatalogRepository = createCatalogRepository();
export const marketRepository: MarketRepository = createMarketRepository();
