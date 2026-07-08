import type { MarketSale } from "../../domain/MarketSale";
import type { MarketSummary } from "../../domain/MarketSummary";
import type { MarketRepository, NewMarketInput } from "../MarketRepository";
import { ApiError, apiRequest, apiRequestVoid } from "./httpClient";

// API の NewMarketInput（openapi.yaml）。書誌・flags は catalogId 参照の Catalog から
// サーバが合成するため送らず、成約固有情報（condition/price/soldAt/seller）だけを送る。
interface MarketApiInput {
  catalogId: string;
  condition: string;
  price: number;
  soldAt: string;
  seller: string;
}

const toApiInput = (input: NewMarketInput): MarketApiInput => ({
  catalogId: input.catalogId,
  condition: input.condition,
  price: input.price,
  soldAt: input.soldAt,
  seller: input.seller,
});

// 編集系 API 実装（openapi.yaml /market）。
// GET /market（成約ログ）/ GET /market/summary（相場サマリ）/
// POST /market（create）/ PUT /market/{id}（update）/ DELETE /market/{id}（remove）に対応。
// GET /market/{id} は API に無いため get は list から解決する。
export class HttpMarketRepository implements MarketRepository {
  async list(): Promise<MarketSale[]> {
    return apiRequest<MarketSale[]>("/market");
  }

  async get(id: string): Promise<MarketSale | null> {
    const all = await this.list();
    return all.find((r) => r.id === id) ?? null;
  }

  async summary(): Promise<MarketSummary[]> {
    return apiRequest<MarketSummary[]>("/market/summary");
  }

  async create(input: NewMarketInput): Promise<MarketSale> {
    return apiRequest<MarketSale>("/market", {
      method: "POST",
      body: toApiInput(input),
    });
  }

  async update(
    id: string,
    patch: Partial<NewMarketInput>,
  ): Promise<MarketSale> {
    // PUT /market/{id} は catalogId / price / soldAt を必須で全置換する。
    // condition は任意（鑑定記録・空文字可）なのでガードに含めない。
    // フォームは常に全項目を送るが、型上は Partial のためここで担保する。
    if (!patch.catalogId || patch.price === undefined || !patch.soldAt) {
      throw new ApiError(
        400,
        "更新には catalogId / price / soldAt が必要です。",
      );
    }
    return apiRequest<MarketSale>(`/market/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: toApiInput(patch as NewMarketInput),
    });
  }

  async remove(id: string): Promise<void> {
    // DELETE /market/{id} は成功時 204（本文なし）。
    await apiRequestVoid(`/market/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
}
