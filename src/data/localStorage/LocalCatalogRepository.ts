import type { Catalog } from "../../domain/Catalog";
import type { CatalogRepository } from "../CatalogRepository";
import { catalogSeed } from "../seed/catalogs.seed";
import { readOrSeed, writeArray } from "./jsonStore";

const STORAGE_KEY = "editor:catalogs";

// localStorage 実装（指示書 §7）。全メソッドは Promise を返し、将来の fetch 実装と
// 同一シグネチャにする。初回アクセス時に未初期化ならシードを投入する。
export class LocalCatalogRepository implements CatalogRepository {
  private read(): Catalog[] {
    return readOrSeed(STORAGE_KEY, catalogSeed);
  }

  private write(items: Catalog[]): void {
    writeArray(STORAGE_KEY, items);
  }

  // 既存 id（cat-XXX）から次の連番を採番する。空なら cat-001。
  private nextId(items: Catalog[]): string {
    let max = 0;
    for (const c of items) {
      const m = /^cat-(\d+)$/.exec(c.id);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `cat-${String(max + 1).padStart(3, "0")}`;
  }

  async list(): Promise<Catalog[]> {
    return this.read();
  }

  async get(id: string): Promise<Catalog | null> {
    return this.read().find((c) => c.id === id) ?? null;
  }

  async create(input: Omit<Catalog, "id">): Promise<Catalog> {
    const items = this.read();
    const created: Catalog = { ...input, id: this.nextId(items) };
    items.push(created);
    this.write(items);
    return created;
  }

  async update(
    id: string,
    patch: Partial<Omit<Catalog, "id">>,
  ): Promise<Catalog> {
    const items = this.read();
    const idx = items.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error(`Catalog not found: ${id}`);
    const updated: Catalog = { ...items[idx], ...patch, id };
    items[idx] = updated;
    this.write(items);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const items = this.read().filter((c) => c.id !== id);
    this.write(items);
  }
}
