import { useCallback, useEffect, useMemo, useState } from "react";
import type { Catalog } from "../../domain/Catalog";
import type { MarketRecord } from "../../domain/MarketRecord";
import { catalogRepository, marketRepository } from "../../config/container";
import { formatYen, formatChange } from "../../lib/format";
import { Thumbnail } from "../common/Thumbnail";
import { Sparkline } from "../common/Sparkline";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { MarketForm, type MarketFormValues } from "./MarketForm";

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; item: MarketRecord };

type SortKey = "new" | "priceDesc" | "changeDesc";

// マーケット相場管理画面（指示書 §9-2）。一覧 / 新規 / 編集 / 削除。
// データアクセスは marketRepository（interface）経由のみ。検索・並べ替えはクライアント側。
export function MarketPage() {
  const [items, setItems] = useState<MarketRecord[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("new");
  const [deleting, setDeleting] = useState<MarketRecord | null>(null);

  const reload = useCallback(async () => {
    const [list, cats] = await Promise.all([
      marketRepository.list(),
      catalogRepository.list(),
    ]);
    setItems(list);
    setCatalogs(cats);
    setLoading(false);
  }, []);

  // 初回ロード。setState は await 後（非同期）に行い、アンマウント後は無視する。
  useEffect(() => {
    let active = true;
    void (async () => {
      const [list, cats] = await Promise.all([
        marketRepository.list(),
        catalogRepository.list(),
      ]);
      if (!active) return;
      setItems(list);
      setCatalogs(cats);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (values: MarketFormValues) => {
    if (mode.kind === "edit") {
      await marketRepository.update(mode.item.id, values);
    } else {
      await marketRepository.create(values);
    }
    setMode({ kind: "list" });
    await reload();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    await marketRepository.remove(deleting.id);
    setDeleting(null);
    await reload();
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter((r) =>
          [r.title, r.author, r.publisher, r.volume, r.seller, r.id]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : items;
    const sorted = [...base];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "priceDesc":
          return b.price - a.price;
        case "changeDesc":
          return b.change - a.change;
        case "new":
        default:
          return b.listedAt - a.listedAt;
      }
    });
    return sorted;
  }, [items, query, sortKey]);

  if (mode.kind !== "list") {
    return (
      <MarketForm
        editing={mode.kind === "edit" ? mode.item : null}
        catalogs={catalogs}
        onSubmit={handleSubmit}
        onCancel={() => setMode({ kind: "list" })}
      />
    );
  }

  return (
    <section>
      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="検索（title / seller / author …）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="sort"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="new">新着順</option>
          <option value="priceDesc">価格が高い順</option>
          <option value="changeDesc">変化率が高い順</option>
        </select>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => setMode({ kind: "create" })}
        >
          ＋ 新規レコード
        </button>
      </div>

      {loading ? (
        <p className="muted">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="muted">該当する相場レコードがありません。</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>id</th>
                <th>title</th>
                <th>seller</th>
                <th>condition</th>
                <th className="num">price</th>
                <th className="num">change</th>
                <th>推移</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Thumbnail imageUrl={r.imageUrl} alt={r.title} />
                  </td>
                  <td className="mono">{r.id}</td>
                  <td>{r.title}</td>
                  <td>{r.seller}</td>
                  <td>
                    <span className="badge">{r.condition}</span>
                  </td>
                  <td className="num">{formatYen(r.price)}</td>
                  <td className={r.change >= 0 ? "num pos" : "num neg"}>
                    {formatChange(r.change)}
                  </td>
                  <td>
                    <Sparkline values={r.history} />
                  </td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => setMode({ kind: "edit", item: r })}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      onClick={() => setDeleting(r)}
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="相場レコードを削除"
        message={
          deleting
            ? `「${deleting.title}」（${deleting.id}）を削除します。元に戻せません。`
            : ""
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}
