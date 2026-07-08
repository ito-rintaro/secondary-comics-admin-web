import { useCallback, useEffect, useMemo, useState } from "react";
import type { Catalog } from "../../domain/Catalog";
import type { MarketSale } from "../../domain/MarketSale";
import type { MarketSummary } from "../../domain/MarketSummary";
import { catalogRepository, marketRepository } from "../../config/container";
import { formatYen, formatChange } from "../../lib/format";
import { errorMessage } from "../../lib/errorMessage";
import { Thumbnail } from "../common/Thumbnail";
import { Sparkline } from "../common/Sparkline";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { MarketForm, type MarketFormValues } from "./MarketForm";

type Mode =
  | { kind: "list" }
  | { kind: "create" }
  | { kind: "edit"; item: MarketSale };

// 相場サマリ（読み取り・チャート）／成約ログ（編集）の 2 ビューを 1 画面で切り替える。
type View = "summary" | "sales";

type SummarySort = "recent" | "priceDesc" | "changeDesc";
type SalesSort = "soldDesc" | "priceDesc";

// マーケット管理画面（指示書 §1）。
// 「相場サマリ」（GET /market/summary・catalog 単位の集計。price/change/history チャート）と
// 「成約ログ」（GET /market・成約 1 件ずつの CRUD）をトグルで切り替える。
// データアクセスは marketRepository（interface）経由のみ。検索・並べ替えはクライアント側。
export function MarketPage() {
  const [summaries, setSummaries] = useState<MarketSummary[]>([]);
  const [sales, setSales] = useState<MarketSale[]>([]);
  const [catalogs, setCatalogs] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("summary");
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [query, setQuery] = useState("");
  const [summarySort, setSummarySort] = useState<SummarySort>("recent");
  const [salesSort, setSalesSort] = useState<SalesSort>("soldDesc");
  const [deleting, setDeleting] = useState<MarketSale | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [sum, list, cats] = await Promise.all([
      marketRepository.summary(),
      marketRepository.list(),
      catalogRepository.list(),
    ]);
    setSummaries(sum);
    setSales(list);
    setCatalogs(cats);
    setLoading(false);
  }, []);

  // 初回ロード。setState は await 後（非同期）に行い、アンマウント後は無視する。
  useEffect(() => {
    let active = true;
    void (async () => {
      const [sum, list, cats] = await Promise.all([
        marketRepository.summary(),
        marketRepository.list(),
        catalogRepository.list(),
      ]);
      if (!active) return;
      setSummaries(sum);
      setSales(list);
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
    // API モードでは remove() が DELETE /market/{id} を叩く。失敗（403/404 等）は
    // ここで捕捉して画面バナーに表示する。
    try {
      await marketRepository.remove(deleting.id);
      setDeleting(null);
      setActionError(null);
      await reload();
    } catch (e) {
      setDeleting(null);
      setActionError(errorMessage(e));
    }
  };

  // 相場サマリの絞り込み + 並べ替え。
  const filteredSummaries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? summaries.filter((s) =>
          [s.title, s.author, s.publisher, s.volume, s.catalogId]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : summaries;
    const sorted = [...base];
    sorted.sort((a, b) => {
      switch (summarySort) {
        case "priceDesc":
          return b.price - a.price;
        case "changeDesc":
          return b.change - a.change;
        case "recent":
        default:
          // 直近成約日の新しい順（同日は price 降順）。
          return (
            b.lastSoldAt.localeCompare(a.lastSoldAt) || b.price - a.price
          );
      }
    });
    return sorted;
  }, [summaries, query, summarySort]);

  // 成約ログの絞り込み + 並べ替え。
  const filteredSales = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? sales.filter((r) =>
          [r.title, r.author, r.publisher, r.volume, r.seller, r.catalogId, r.id]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : sales;
    const sorted = [...base];
    sorted.sort((a, b) => {
      switch (salesSort) {
        case "priceDesc":
          return b.price - a.price;
        case "soldDesc":
        default:
          // 成約日の新しい順（同日は id 降順で安定させる）。
          return b.soldAt.localeCompare(a.soldAt) || b.id.localeCompare(a.id);
      }
    });
    return sorted;
  }, [sales, query, salesSort]);

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
      {/* ビュー切替（相場サマリ / 成約ログ） */}
      <div className="seg" role="tablist" aria-label="マーケット表示切替">
        <button
          type="button"
          role="tab"
          aria-selected={view === "summary"}
          className={view === "summary" ? "seg__btn seg__btn--active" : "seg__btn"}
          onClick={() => setView("summary")}
        >
          📈 相場サマリ
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "sales"}
          className={view === "sales" ? "seg__btn seg__btn--active" : "seg__btn"}
          onClick={() => setView("sales")}
        >
          🧾 成約ログ
        </button>
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder={
            view === "summary"
              ? "検索（title / author / catalogId …）"
              : "検索（title / seller / catalogId …）"
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {view === "summary" ? (
          <select
            className="sort"
            value={summarySort}
            onChange={(e) => setSummarySort(e.target.value as SummarySort)}
          >
            <option value="recent">直近成約が新しい順</option>
            <option value="priceDesc">価格が高い順</option>
            <option value="changeDesc">変化率が高い順</option>
          </select>
        ) : (
          <>
            <select
              className="sort"
              value={salesSort}
              onChange={(e) => setSalesSort(e.target.value as SalesSort)}
            >
              <option value="soldDesc">成約日が新しい順</option>
              <option value="priceDesc">価格が高い順</option>
            </select>
            <button
              type="button"
              className="btn btn--primary"
              onClick={() => {
                setActionError(null);
                setMode({ kind: "create" });
              }}
            >
              ＋ 成約を追加
            </button>
          </>
        )}
      </div>

      {actionError && <p className="form__error">{actionError}</p>}

      {loading ? (
        <p className="muted">読み込み中…</p>
      ) : view === "summary" ? (
        <SummaryTable rows={filteredSummaries} />
      ) : (
        <SalesTable
          rows={filteredSales}
          onEdit={(r) => {
            setActionError(null);
            setMode({ kind: "edit", item: r });
          }}
          onDelete={(r) => setDeleting(r)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        title="成約レコードを削除"
        message={
          deleting
            ? `「${deleting.title}」（${deleting.id} / ${deleting.soldAt}）を削除します。元に戻せません。`
            : ""
        }
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </section>
  );
}

// 相場サマリ表（読み取り専用。price/change/history チャートを表示）。
// seller / condition / listing id は catalog 単位のサマリには無いため列を持たない。
function SummaryTable({ rows }: { rows: MarketSummary[] }) {
  if (rows.length === 0) {
    return (
      <p className="muted">
        該当する相場サマリがありません（相場は成約が 1 件以上ある本のみ表示されます）。
      </p>
    );
  }
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th></th>
            <th>title</th>
            <th className="num">price</th>
            <th className="num">change</th>
            <th>推移</th>
            <th className="num">成約数</th>
            <th>直近成約</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.catalogId}>
              <td>
                <Thumbnail imageUrl={s.imageUrl} alt={s.title} />
              </td>
              <td>
                {s.title}
                <div className="mono">{s.catalogId}</div>
              </td>
              <td className="num">{formatYen(s.price)}</td>
              <td className={s.change >= 0 ? "num pos" : "num neg"}>
                {formatChange(s.change)}
              </td>
              <td>
                <Sparkline values={s.history} />
              </td>
              <td className="num">{s.sampleCount}</td>
              <td className="mono">{s.lastSoldAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 成約ログ表（編集可能。1 行＝1 成約）。
function SalesTable({
  rows,
  onEdit,
  onDelete,
}: {
  rows: MarketSale[];
  onEdit: (r: MarketSale) => void;
  onDelete: (r: MarketSale) => void;
}) {
  if (rows.length === 0) {
    return <p className="muted">該当する成約レコードがありません。</p>;
  }
  return (
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
            <th>soldAt</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
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
              <td className="mono">{r.soldAt}</td>
              <td className="row-actions">
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={() => onEdit(r)}
                >
                  編集
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  onClick={() => onDelete(r)}
                >
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
