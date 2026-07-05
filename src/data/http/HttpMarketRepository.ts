import type { MarketRecord } from "../../domain/MarketRecord";
import type { Condition } from "../../domain/Condition";
import type { MarketRepository, NewMarketInput } from "../MarketRepository";
import { ApiError, apiRequest } from "./httpClient";

// API の NewMarketInput（openapi.yaml）。書誌・flags は catalogId 参照の Catalog から
// サーバが導出するため送らず、出品固有情報だけを送る。
interface MarketApiInput {
  catalogId: string;
  seller: string;
  condition: Condition;
  history: number[];
}

const toApiInput = (input: NewMarketInput): MarketApiInput => ({
  catalogId: input.catalogId,
  seller: input.seller,
  condition: input.condition,
  history: input.history,
});

// 編集系 API 実装（openapi.yaml /market）。
// GET /market（list）/ POST /market（create）/ PUT /market/{id}（update）に対応。
// GET /market/{id} は API に無いため get は list から解決する。
// 削除（DELETE /market/{id}）は今回スコープ外のため remove は明示的に未対応エラーを投げる。
export class HttpMarketRepository implements MarketRepository {
  async list(): Promise<MarketRecord[]> {
    return apiRequest<MarketRecord[]>("/market");
  }

  async get(id: string): Promise<MarketRecord | null> {
    const all = await this.list();
    return all.find((r) => r.id === id) ?? null;
  }

  async create(input: NewMarketInput): Promise<MarketRecord> {
    return apiRequest<MarketRecord>("/market", {
      method: "POST",
      body: toApiInput(input),
    });
  }

  async update(
    id: string,
    patch: Partial<NewMarketInput>,
  ): Promise<MarketRecord> {
    // PUT /market/{id} は catalogId / condition / history を必須で全置換する。
    // フォームは常に全項目を送るが、型上は Partial のためここで担保する。
    if (!patch.catalogId || !patch.condition || !patch.history) {
      throw new ApiError(
        400,
        "更新には catalogId / condition / history が必要です。",
      );
    }
    return apiRequest<MarketRecord>(`/market/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: toApiInput(patch as NewMarketInput),
    });
  }

  async remove(id: string): Promise<void> {
    throw new ApiError(501, `相場レコードの削除は現在未対応です（${id}）。`);
  }
}
