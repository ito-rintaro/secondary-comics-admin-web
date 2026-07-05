import { useCallback, useEffect, useMemo, useState } from "react";
import type { Catalog } from "../../domain/Catalog";
import { catalogRepository } from "../../config/container";
import { flagLabels } from "../../lib/format";
import { errorMessage } from "../../lib/errorMessage";
import { Thumbnail } from "../common/Thumbnail";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { CatalogForm, type CatalogFormValues } from "./CatalogForm";

type Mode = { kind: "list" } | { kind: "create" } | { kind: "edit"; item: Catalog };

// カタログ管理画面（指示書 §9-1）。一覧 / 新規 / 編集 / 削除。
// データアクセスは catalogRepository（interface）経由のみ。検索・並べ替えはクライアント側。
export function CatalogPage() {
  const [items, setItems] = useState<Catalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>({ kind: "list" });
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<Catalog | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const list = await catalogRepository.list();
    setItems(list);
    setLoading(false);
  }, []);

  // 初回ロード。setState は await 後（非同期）に行い、アンマウント後は無視する。
  useEffect(() => {
    let active = true;
    void (async () => {
      const list = await catalogRepository.list();
      if (!active) return;
      setItems(list);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (values: CatalogFormValues) => {
    if (mode.kind === "edit") {
      await catalogRepository.update(mode.item.id, values);
    } else {
      await catalogRepository.create(values);
    }
    setMode({ kind: "list" });
    await reload();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    // 削除は今回スコープ外。API モードでは remove() が未対応エラーを投げるため、
    // ここで捕捉して画面に表示する（決定：押したら「未対応」エラー表示）。
    try {
      await catalogRepository.remove(deleting.id);
      setDeleting(null);
      setActionError(null);
      await reload();
    } catch (e) {
      setDeleting(null);
      setActionError(errorMessage(e));
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? items.filter((c) =>
          [c.title, c.author, c.publisher, c.volume, c.year, c.id]
            .join(" ")
            .toLowerCase()
            .includes(q),
        )
      : items;
    return [...base].sort((a, b) => a.id.localeCompare(b.id));
  }, [items, query]);

  if (mode.kind !== "list") {
    return (
      <CatalogForm
        editing={mode.kind === "edit" ? mode.item : null}
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
          placeholder="検索（title / author / publisher …）"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => {
            setActionError(null);
            setMode({ kind: "create" });
          }}
        >
          ＋ 新規カタログ
        </button>
      </div>

      {actionError && <p className="form__error">{actionError}</p>}

      {loading ? (
        <p className="muted">読み込み中…</p>
      ) : filtered.length === 0 ? (
        <p className="muted">該当するカタログがありません。</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th></th>
                <th>id</th>
                <th>title</th>
                <th>author</th>
                <th>publisher</th>
                <th>volume</th>
                <th>year</th>
                <th>flags</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Thumbnail imageUrl={c.imageUrl} alt={c.title} />
                  </td>
                  <td className="mono">{c.id}</td>
                  <td>{c.title}</td>
                  <td>{c.author}</td>
                  <td>{c.publisher}</td>
                  <td>{c.volume}</td>
                  <td>{c.year}</td>
                  <td>
                    {flagLabels(c.flags).map((f) => (
                      <span key={f} className="badge">
                        {f}
                      </span>
                    ))}
                  </td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="btn btn--sm"
                      onClick={() => {
                        setActionError(null);
                        setMode({ kind: "edit", item: c });
                      }}
                    >
                      編集
                    </button>
                    <button
                      type="button"
                      className="btn btn--sm btn--danger"
                      onClick={() => setDeleting(c)}
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
        title="カタログを削除"
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
