import type { MarketRecord } from "../../domain/MarketRecord";
import type { MarketRepository } from "../MarketRepository";
import { deriveMarketValues } from "../../lib/marketDerive";
import { marketSeed } from "../seed/markets.seed";
import { readOrSeed, writeArray } from "./jsonStore";

const STORAGE_KEY = "editor:markets";

// localStorage 実装（指示書 §7）。create / update では保存前に price / change を
// 必ず再導出する（§8）。listedAt は create 時に既存最大 +1 で採番する（§9-2）。
export class LocalMarketRepository implements MarketRepository {
  private read(): MarketRecord[] {
    return readOrSeed(STORAGE_KEY, marketSeed);
  }

  private write(items: MarketRecord[]): void {
    writeArray(STORAGE_KEY, items);
  }

  // 既存 id（mk{n}）から次の連番を採番する。空なら mk0。
  private nextId(items: MarketRecord[]): string {
    let max = -1;
    for (const r of items) {
      const m = /^mk(\d+)$/.exec(r.id);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `mk${max + 1}`;
  }

  // 新着ソート用 listedAt を既存最大 +1 で採番する。空なら 0。
  private nextListedAt(items: MarketRecord[]): number {
    let max = -1;
    for (const r of items) max = Math.max(max, r.listedAt);
    return max + 1;
  }

  async list(): Promise<MarketRecord[]> {
    return this.read();
  }

  async get(id: string): Promise<MarketRecord | null> {
    return this.read().find((r) => r.id === id) ?? null;
  }

  async create(
    input: Omit<MarketRecord, "id" | "price" | "change" | "listedAt">,
  ): Promise<MarketRecord> {
    const items = this.read();
    // price / change を history から再導出（§8）。id / listedAt を採番。
    const created: MarketRecord = deriveMarketValues({
      ...input,
      id: this.nextId(items),
      listedAt: this.nextListedAt(items),
    });
    items.push(created);
    this.write(items);
    return created;
  }

  async update(
    id: string,
    patch: Partial<Omit<MarketRecord, "id">>,
  ): Promise<MarketRecord> {
    const items = this.read();
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`MarketRecord not found: ${id}`);
    // マージ後の history を基に price / change を再導出（§8）。
    const merged: MarketRecord = { ...items[idx], ...patch, id };
    const updated = deriveMarketValues(merged);
    items[idx] = updated;
    this.write(items);
    return updated;
  }

  async remove(id: string): Promise<void> {
    const items = this.read().filter((r) => r.id !== id);
    this.write(items);
  }
}
