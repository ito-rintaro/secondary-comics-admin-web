import type { Catalog } from "../../domain/Catalog";
import type { CatalogRepository } from "../CatalogRepository";
import { apiRequest, apiRequestVoid } from "./httpClient";

// 編集系 API 実装（openapi.yaml /catalogs）。
// GET /catalogs（list）/ POST /catalogs（create）/ PUT /catalogs/{id}（update）/
// DELETE /catalogs/{id}（remove）に対応。
// GET /catalogs/{id} は API に無いため get は list から解決する。
export class HttpCatalogRepository implements CatalogRepository {
  async list(): Promise<Catalog[]> {
    return apiRequest<Catalog[]>("/catalogs");
  }

  async get(id: string): Promise<Catalog | null> {
    const all = await this.list();
    return all.find((c) => c.id === id) ?? null;
  }

  async create(input: Omit<Catalog, "id">): Promise<Catalog> {
    // NewCatalogInput は Omit<Catalog, "id"> と同形（title 必須・他は既定値補完）。
    return apiRequest<Catalog>("/catalogs", { method: "POST", body: input });
  }

  async update(
    id: string,
    patch: Partial<Omit<Catalog, "id">>,
  ): Promise<Catalog> {
    // PUT /catalogs/{id} は全項目置換。フォームは常に全項目を送る。
    return apiRequest<Catalog>(`/catalogs/${encodeURIComponent(id)}`, {
      method: "PUT",
      body: patch,
    });
  }

  async remove(id: string): Promise<void> {
    // DELETE /catalogs/{id} は成功時 204（本文なし）。
    await apiRequestVoid(`/catalogs/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }
}
