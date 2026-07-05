import type { CatalogRepository } from "../data/CatalogRepository";
import type { MarketRepository } from "../data/MarketRepository";
import type { ImageRepository } from "../data/ImageRepository";
import { LocalCatalogRepository } from "../data/localStorage/LocalCatalogRepository";
import { LocalMarketRepository } from "../data/localStorage/LocalMarketRepository";
import { LocalImageRepository } from "../data/localStorage/LocalImageRepository";
import { HttpCatalogRepository } from "../data/http/HttpCatalogRepository";
import { HttpMarketRepository } from "../data/http/HttpMarketRepository";
import { HttpImageRepository } from "../data/http/HttpImageRepository";

// 依存の組み立て（DI コンテナ）。
// 画面は interface（CatalogRepository / MarketRepository）にのみ依存し、
// 具体実装の選択はここ 1 箇所に閉じ込める（指示書 §7）。
//
// VITE_USE_API === 'true' のとき編集系 API（openapi.yaml）へ接続する HTTP 実装、
// それ以外は localStorage モック実装を使う。ベース URL は VITE_API_BASE_URL。
// 追加・編集（create / update）のみ API 対応。削除（remove）は今回スコープ外で、
// HTTP 実装では明示的に未対応エラーを投げる。

// アプリが実 API に接続しているか（画面の注記表示などに使う）。
export const usingApi = import.meta.env.VITE_USE_API === "true";

const createCatalogRepository = (): CatalogRepository =>
  usingApi ? new HttpCatalogRepository() : new LocalCatalogRepository();

const createMarketRepository = (): MarketRepository =>
  usingApi ? new HttpMarketRepository() : new LocalMarketRepository();

const createImageRepository = (): ImageRepository =>
  usingApi ? new HttpImageRepository() : new LocalImageRepository();

// アプリ全体で共有する単一インスタンス。
export const catalogRepository: CatalogRepository = createCatalogRepository();
export const marketRepository: MarketRepository = createMarketRepository();
export const imageRepository: ImageRepository = createImageRepository();
