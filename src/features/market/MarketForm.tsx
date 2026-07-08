import { useState } from "react";
import type { Catalog } from "../../domain/Catalog";
import type { Condition } from "../../domain/Condition";
import { CONDITIONS } from "../../domain/Condition";
import type { MarketSale } from "../../domain/MarketSale";
import type { NewMarketInput } from "../../data/MarketRepository";
import { validatePrice, validateSoldAt } from "../../lib/marketDerive";
import { flagLabels } from "../../lib/format";
import { errorMessage } from "../../lib/errorMessage";
import { Thumbnail } from "../common/Thumbnail";

// マーケット成約の作成 / 編集フォーム（指示書 §4）。
// 「相場は成約を積み重ねて自動算出される」ので、フォームは成約を 1 件ずつ足す運用。
// 書誌（title/author/publisher/volume/flags/imageUrl）は参照する Catalog から合成されるため
// カタログ選択を必須にし、フォームでは成約固有情報（condition / price / soldAt / seller）を編集する。
// price は単一の整数円、soldAt は日付ピッカー（YYYY-MM-DD）。
export type MarketFormValues = NewMarketInput;

export function MarketForm({
  editing,
  catalogs,
  onSubmit,
  onCancel,
}: {
  editing: MarketSale | null;
  catalogs: Catalog[];
  onSubmit: (values: MarketFormValues) => void | Promise<void>;
  onCancel: () => void;
}) {
  // 編集時は既存成約の catalogId をそのまま初期選択する（MarketSale は catalogId を持つ）。
  const [catalogId, setCatalogId] = useState<string>(editing?.catalogId ?? "");
  const [condition, setCondition] = useState<Condition>(
    editing?.condition ?? "A",
  );
  const [priceStr, setPriceStr] = useState<string>(
    editing ? String(editing.price) : "",
  );
  const [soldAt, setSoldAt] = useState<string>(editing?.soldAt ?? "");
  const [seller, setSeller] = useState(editing?.seller ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedCatalog = catalogs.find((c) => c.id === catalogId) ?? null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalog) {
      setError(
        "カタログを選択してください（書誌は選択したカタログから設定されます）。",
      );
      return;
    }
    const price = Number(priceStr);
    if (priceStr.trim() === "" || !validatePrice(price)) {
      setError("price は 0 以上の整数（円）で入力してください。");
      return;
    }
    if (!validateSoldAt(soldAt)) {
      setError("soldAt は実在する日付（YYYY-MM-DD）で入力してください。");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // 書誌 / flags は参照カタログから埋める（API はこれらを catalogId から合成する）。
      await onSubmit({
        catalogId: selectedCatalog.id,
        condition,
        price,
        soldAt,
        seller,
        title: selectedCatalog.title,
        author: selectedCatalog.author,
        publisher: selectedCatalog.publisher,
        volume: selectedCatalog.volume,
        flags: selectedCatalog.flags,
        imageUrl: selectedCatalog.imageUrl,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h2 className="form__title">
        {editing ? `成約レコード編集（${editing.id}）` : "成約レコード新規作成"}
      </h2>

      {/* カタログ選択（必須）。書誌はここから合成する。 */}
      <label className="field">
        <span className="field__label">
          カタログ <span className="req">必須</span>
        </span>
        <select
          className="field__input"
          value={catalogId}
          onChange={(e) => setCatalogId(e.target.value)}
        >
          <option value="">— カタログを選択 —</option>
          {catalogs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}｜{c.title}
            </option>
          ))}
        </select>
      </label>

      {/* 選択カタログの書誌（読み取り専用。サーバが合成する内容のプレビュー）。 */}
      {selectedCatalog && (
        <div className="catalog-preview">
          <Thumbnail
            imageUrl={selectedCatalog.imageUrl}
            alt={selectedCatalog.title}
          />
          <div className="catalog-preview__body">
            <div className="catalog-preview__title">{selectedCatalog.title}</div>
            <div className="catalog-preview__meta muted">
              {[
                selectedCatalog.author,
                selectedCatalog.publisher,
                selectedCatalog.volume,
              ]
                .filter(Boolean)
                .join(" / ")}
            </div>
            <div className="catalog-preview__flags">
              {flagLabels(selectedCatalog.flags).map((f) => (
                <span key={f} className="badge">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="field-row">
        <label className="field">
          <span className="field__label">
            price（成約価格・円） <span className="req">必須</span>
          </span>
          <input
            className="field__input"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            value={priceStr}
            onChange={(e) => setPriceStr(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">
            soldAt（成約日） <span className="req">必須</span>
          </span>
          <input
            className="field__input"
            type="date"
            value={soldAt}
            onChange={(e) => setSoldAt(e.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field__label">condition</span>
          <select
            className="field__input"
            value={condition}
            onChange={(e) => setCondition(e.target.value as Condition)}
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">seller（販売元 / ショップ名）</span>
          <input
            className="field__input"
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
          />
        </label>
      </div>

      <p className="field__hint muted">
        相場（現在価格・変化率・チャート）は登録された成約を集計して自動算出されます。
      </p>

      {error && <p className="form__error">{error}</p>}

      <div className="form__actions">
        <button
          type="button"
          className="btn"
          onClick={onCancel}
          disabled={submitting}
        >
          キャンセル
        </button>
        <button type="submit" className="btn btn--primary" disabled={submitting}>
          {submitting ? "送信中…" : editing ? "更新" : "作成"}
        </button>
      </div>
    </form>
  );
}
