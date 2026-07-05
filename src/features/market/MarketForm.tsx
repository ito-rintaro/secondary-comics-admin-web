import { useState } from "react";
import type { Catalog } from "../../domain/Catalog";
import type { Condition } from "../../domain/Condition";
import { CONDITIONS } from "../../domain/Condition";
import type { MarketRecord } from "../../domain/MarketRecord";
import type { NewMarketInput } from "../../data/MarketRepository";
import {
  HISTORY_LENGTH,
  derivePrice,
  deriveChange,
  validateHistory,
} from "../../lib/marketDerive";
import { formatYen, formatChange, flagLabels } from "../../lib/format";
import { errorMessage } from "../../lib/errorMessage";
import { Thumbnail } from "../common/Thumbnail";

// マーケット相場の作成 / 編集フォーム（指示書 §9-2 / API 準拠）。
// 書誌（title/author/publisher/volume/flags/imageUrl）は参照する Catalog から導出するため
// カタログ選択を必須にし、フォームでは出品固有情報（seller / condition / history）だけ編集する。
// price / change は history から導出して表示（§8）。listedAt は create 時にサーバ採番。
// 編集時：既存レコードは catalogId を保持しないため、カタログは選び直す必要がある。
export type MarketFormValues = NewMarketInput;

const emptyHistory = (): string[] => Array<string>(HISTORY_LENGTH).fill("");

function toStrings(history: number[]): string[] {
  const base = history.map((n) => String(n));
  // 12 要素に満たなければ空欄で埋める（壊れたデータからの編集も可能に）。
  while (base.length < HISTORY_LENGTH) base.push("");
  return base.slice(0, HISTORY_LENGTH);
}

export function MarketForm({
  editing,
  catalogs,
  onSubmit,
  onCancel,
}: {
  editing: MarketRecord | null;
  catalogs: Catalog[];
  onSubmit: (values: MarketFormValues) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [catalogId, setCatalogId] = useState<string>("");
  const [seller, setSeller] = useState(editing?.seller ?? "");
  const [condition, setCondition] = useState<Condition>(
    editing?.condition ?? "A",
  );
  const [historyStr, setHistoryStr] = useState<string[]>(
    editing ? toStrings(editing.history) : emptyHistory(),
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedCatalog = catalogs.find((c) => c.id === catalogId) ?? null;

  const setHistoryAt = (idx: number, v: string) =>
    setHistoryStr((prev) => prev.map((x, i) => (i === idx ? v : x)));

  // 現在の入力から history を数値化（無効値は NaN）。導出プレビューに使う。
  const parsedHistory = historyStr.map((s) => Number(s));
  const historyValid = validateHistory(parsedHistory).ok;
  const previewPrice = historyValid ? derivePrice(parsedHistory) : null;
  const previewChange = historyValid ? deriveChange(parsedHistory) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCatalog) {
      setError(
        "カタログを選択してください（書誌は選択したカタログから設定されます）。",
      );
      return;
    }
    const v = validateHistory(parsedHistory);
    if (!v.ok) {
      setError(v.reason ?? "history が不正です。");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      // 書誌 / flags は参照カタログから埋める（API はこれらを catalogId から導出する）。
      await onSubmit({
        catalogId: selectedCatalog.id,
        title: selectedCatalog.title,
        author: selectedCatalog.author,
        publisher: selectedCatalog.publisher,
        volume: selectedCatalog.volume,
        seller,
        condition,
        flags: selectedCatalog.flags,
        history: parsedHistory,
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
        {editing ? `相場レコード編集（${editing.id}）` : "相場レコード新規作成"}
      </h2>

      {/* カタログ選択（必須）。書誌はここから導出する。 */}
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
        {editing && (
          <span className="field__hint muted">
            既存レコードはカタログ参照を保持しないため、選び直してください。
          </span>
        )}
      </label>

      {/* 選択カタログの書誌（読み取り専用。サーバが導出する内容のプレビュー）。 */}
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
          <span className="field__label">seller（出品者 / ショップ名）</span>
          <input
            className="field__input"
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
          />
        </label>
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
      </div>

      <fieldset className="history">
        <legend className="field__label">
          history（直近 12 ヶ月・0 以上の整数・末尾が現在価格）
        </legend>
        <div className="history__grid">
          {historyStr.map((v, i) => (
            <input
              key={i}
              className="history__cell"
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={v}
              aria-label={`${i + 1} ヶ月目`}
              onChange={(e) => setHistoryAt(i, e.target.value)}
            />
          ))}
        </div>
      </fieldset>

      {/* 導出結果（入力させない） */}
      <div className="derived">
        <div className="derived__item">
          <span className="derived__label">price（導出）</span>
          <span className="derived__value">
            {previewPrice === null ? "—" : formatYen(previewPrice)}
          </span>
        </div>
        <div className="derived__item">
          <span className="derived__label">change（導出）</span>
          <span
            className={
              previewChange === null
                ? "derived__value"
                : previewChange >= 0
                  ? "derived__value pos"
                  : "derived__value neg"
            }
          >
            {previewChange === null ? "—" : formatChange(previewChange)}
          </span>
        </div>
      </div>

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
