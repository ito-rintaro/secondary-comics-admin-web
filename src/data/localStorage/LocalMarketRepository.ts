import type { MarketSale } from "../../domain/MarketSale";
import type { MarketSummary } from "../../domain/MarketSummary";
import type { MarketRepository, NewMarketInput } from "../MarketRepository";
import { deriveSummaries } from "../../lib/marketDerive";
import { marketSeed } from "../seed/markets.seed";
import { readOrSeed, writeArray } from "./jsonStore";

// 保存形が「出品 + history[12]」から「成約ログ（MarketSale）」へ変わったため、
// 旧キーの互換性のないデータを引きずらないようキーをバージョン更新する（:v2）。
// 旧 "editor:markets" のデータは読まれず、新キーはシード（成約ログ）で初期化される。
const STORAGE_KEY = "editor:markets:v2";

// localStorage 実装（指示書 §5）。成約ログ（MarketSale）を append-only に保存し、
// 相場サマリ（summary）は保存された成約ログから deriveSummaries で毎回導出する
// （サーバの GET /market/summary と同じ畳み込みをモックでも再現する）。
export class LocalMarketRepository implements MarketRepository {
  private read(): MarketSale[] {
    return readOrSeed(STORAGE_KEY, marketSeed);
  }

  private write(items: MarketSale[]): void {
    writeArray(STORAGE_KEY, items);
  }

  // 既存 id（mk{n}）から次の連番を採番する。空なら mk0。
  private nextId(items: MarketSale[]): string {
    let max = -1;
    for (const r of items) {
      const m = /^mk(\d+)$/.exec(r.id);
      if (m) max = Math.max(max, Number(m[1]));
    }
    return `mk${max + 1}`;
  }

  async list(): Promise<MarketSale[]> {
    return this.read();
  }

  async get(id: string): Promise<MarketSale | null> {
    return this.read().find((r) => r.id === id) ?? null;
  }

  async summary(): Promise<MarketSummary[]> {
    return deriveSummaries(this.read());
  }

  async create(input: NewMarketInput): Promise<MarketSale> {
    const items = this.read();
    // 書誌はフォームが選択カタログから埋めたものをそのまま保存する
    // （実 API ではサーバが catalogId から合成する）。
    const created: MarketSale = {
      id: this.nextId(items),
      title: input.title,
      author: input.author,
      publisher: input.publisher,
      volume: input.volume,
      flags: input.flags,
      imageUrl: input.imageUrl,
      catalogId: input.catalogId,
      condition: input.condition,
      price: input.price,
      soldAt: input.soldAt,
      seller: input.seller,
    };
    items.push(created);
    this.write(items);
    return created;
  }

  async update(
    id: string,
    patch: Partial<NewMarketInput>,
  ): Promise<MarketSale> {
    const items = this.read();
    const idx = items.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`MarketSale not found: ${id}`);
    // patch には書誌も成約固有情報も入りうる。id は据え置きでマージする。
    const merged: MarketSale = { ...items[idx], ...patch, id };
    items[idx] = merged;
    this.write(items);
    return merged;
  }

  async remove(id: string): Promise<void> {
    const items = this.read().filter((r) => r.id !== id);
    this.write(items);
  }
}
