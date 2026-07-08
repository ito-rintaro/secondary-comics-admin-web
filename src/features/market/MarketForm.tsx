import { useState } from "react";
import type { Catalog } from "../../domain/Catalog";
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

// GBA ランクの入力制限は「入力画面だけ」の制約（保存・API の型は string のまま）。
// 空文字は許可（未鑑定）。入力があれば 0〜10.0・小数第 1 位まで（0.1 刻み）の数値のみ許容する。
// 分類が将来変わっても型は据え置きで、このフォームの検証だけ差し替えれば済むようにしている。
const validateGbaRank = (value: string): boolean => {
  const t = value.trim();
  if (t === "") return true;
  if (!/^\d{1,2}(?:\.\d)?$/.test(t)) return false; // 整数部 1〜2 桁 + 任意で小数第 1 位
  const n = Number(t);
  return n >= 0 && n <= 10;
};

// seller は自由文字列（型は string のまま・空文字可）だが、入力画面では主要な販売元を
// 選択肢から選べるようにする。プリセット以外（既存データの個別ショップ名など）や未確定分は
// 「その他」の自由入力欄で受ける。分類が将来変わっても型は据え置きで済む。
const SELLER_OTHER = "その他";
const SELLER_PRESETS = ["メルカリ", "ヤフオク", "ebay"] as const;

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
  const [condition, setCondition] = useState<string>(editing?.condition ?? "");
  const [priceStr, setPriceStr] = useState<string>(
    editing ? String(editing.price) : "",
  );
  const [soldAt, setSoldAt] = useState<string>(editing?.soldAt ?? "");
  // seller はプリセット選択 + 「その他」の自由入力に分解して持つ。
  // 既存値がプリセットならその選択、そうでなければ「その他」+ 自由入力に振り分ける
  // （空文字も「その他」の空欄として扱い、空文字可を維持する）。
  const initialSeller = editing?.seller ?? "";
  const initialIsPreset = (SELLER_PRESETS as readonly string[]).includes(
    initialSeller,
  );
  const [sellerChoice, setSellerChoice] = useState<string>(
    initialIsPreset ? initialSeller : SELLER_OTHER,
  );
  const [customSeller, setCustomSeller] = useState<string>(
    initialIsPreset ? "" : initialSeller,
  );
  const seller =
    sellerChoice === SELLER_OTHER ? customSeller.trim() : sellerChoice;
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
    if (!validateGbaRank(condition)) {
      setError("condition は GBA ランク（0〜10.0・0.1 刻み）で入力してください。");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // 書誌 / flags は参照カタログから埋める（API はこれらを catalogId から合成する）。
      await onSubmit({
        catalogId: selectedCatalog.id,
        condition: condition.trim(),
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
          <span className="field__label">condition（GBA ランク・0〜10.0）</span>
          <input
            className="field__input"
            type="number"
            min={0}
            max={10}
            step={0.1}
            inputMode="decimal"
            value={condition}
            placeholder="例: 9.5（0〜10.0・0.1 刻み。未鑑定なら空欄可）"
            onChange={(e) => setCondition(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">seller（販売元 / ショップ名）</span>
          <select
            className="field__input"
            value={sellerChoice}
            onChange={(e) => setSellerChoice(e.target.value)}
          >
            {SELLER_PRESETS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value={SELLER_OTHER}>{SELLER_OTHER}</option>
          </select>
          {sellerChoice === SELLER_OTHER && (
            <input
              className="field__input field__sub"
              value={customSeller}
              placeholder="販売元名（任意・空欄可）"
              onChange={(e) => setCustomSeller(e.target.value)}
            />
          )}
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
