import { useState } from "react";
import type { Catalog } from "../../domain/Catalog";
import type { Condition } from "../../domain/Condition";
import { CONDITIONS } from "../../domain/Condition";
import type { MarketRecord } from "../../domain/MarketRecord";
import {
  HISTORY_LENGTH,
  derivePrice,
  deriveChange,
  validateHistory,
} from "../../lib/marketDerive";
import { formatYen, formatChange } from "../../lib/format";

// マーケット相場の作成 / 編集フォーム（指示書 §9-2）。
// price / change は入力させず導出結果を表示（§8）。history は 12 点の 0 以上整数。
// listedAt は create 時にリポジトリが自動採番するためフォームでは扱わない。
export type MarketFormValues = Omit<
  MarketRecord,
  "id" | "price" | "change" | "listedAt"
>;

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
  onSubmit: (values: MarketFormValues) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(editing?.title ?? "");
  const [author, setAuthor] = useState(editing?.author ?? "");
  const [publisher, setPublisher] = useState(editing?.publisher ?? "");
  const [volume, setVolume] = useState(editing?.volume ?? "");
  const [seller, setSeller] = useState(editing?.seller ?? "");
  const [condition, setCondition] = useState<Condition>(
    editing?.condition ?? "A",
  );
  const [flags, setFlags] = useState<MarketRecord["flags"]>(
    editing?.flags ?? { firstEd: false, obi: false, special: false },
  );
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? "");
  const [historyStr, setHistoryStr] = useState<string[]>(
    editing ? toStrings(editing.history) : emptyHistory(),
  );
  const [error, setError] = useState<string | null>(null);

  const setFlag = (key: keyof MarketRecord["flags"], v: boolean) =>
    setFlags((prev) => ({ ...prev, [key]: v }));

  const setHistoryAt = (idx: number, v: string) =>
    setHistoryStr((prev) => prev.map((x, i) => (i === idx ? v : x)));

  // 現在の入力から history を数値化（無効値は NaN）。導出プレビューに使う。
  const parsedHistory = historyStr.map((s) => Number(s));
  const historyValid = validateHistory(parsedHistory).ok;
  const previewPrice = historyValid ? derivePrice(parsedHistory) : null;
  const previewChange = historyValid ? deriveChange(parsedHistory) : null;

  // 既存カタログを選んで書誌を prefill（§9-2 任意補助。catalogId は保存しない）。
  const applyCatalog = (id: string) => {
    const cat = catalogs.find((c) => c.id === id);
    if (!cat) return;
    setTitle(cat.title);
    setAuthor(cat.author);
    setPublisher(cat.publisher);
    setVolume(cat.volume);
    setImageUrl(cat.imageUrl);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim() === "") {
      setError("title は必須です。");
      return;
    }
    const v = validateHistory(parsedHistory);
    if (!v.ok) {
      setError(v.reason ?? "history が不正です。");
      return;
    }
    setError(null);
    onSubmit({
      title: title.trim(),
      author,
      publisher,
      volume,
      seller,
      condition,
      flags,
      history: parsedHistory,
      imageUrl,
    });
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h2 className="form__title">
        {editing ? `相場レコード編集（${editing.id}）` : "相場レコード新規作成"}
      </h2>

      {/* カタログ prefill（任意補助） */}
      <label className="field">
        <span className="field__label">
          カタログから書誌を prefill（任意 / catalogId は保存されません）
        </span>
        <select
          className="field__input"
          defaultValue=""
          onChange={(e) => {
            if (e.target.value) applyCatalog(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="">— カタログを選択 —</option>
          {catalogs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.id}｜{c.title}
            </option>
          ))}
        </select>
      </label>

      <label className="field">
        <span className="field__label">
          title <span className="req">必須</span>
        </span>
        <input
          className="field__input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field__label">author</span>
          <input
            className="field__input"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">publisher</span>
          <input
            className="field__input"
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field__label">volume</span>
          <input
            className="field__input"
            value={volume}
            onChange={(e) => setVolume(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">seller</span>
          <input
            className="field__input"
            value={seller}
            onChange={(e) => setSeller(e.target.value)}
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
          <span className="field__label">imageUrl（S3 オブジェクトキー）</span>
          <input
            className="field__input"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="xxxx.jpg（空でも可）"
          />
        </label>
      </div>

      <fieldset className="flags">
        <legend className="field__label">flags</legend>
        <label className="flag">
          <input
            type="checkbox"
            checked={flags.firstEd}
            onChange={(e) => setFlag("firstEd", e.target.checked)}
          />
          初版
        </label>
        <label className="flag">
          <input
            type="checkbox"
            checked={flags.obi}
            onChange={(e) => setFlag("obi", e.target.checked)}
          />
          帯
        </label>
        <label className="flag">
          <input
            type="checkbox"
            checked={flags.special}
            onChange={(e) => setFlag("special", e.target.checked)}
          />
          特装
        </label>
      </fieldset>

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
        <button type="button" className="btn" onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="btn btn--primary">
          {editing ? "更新" : "作成"}
        </button>
      </div>
    </form>
  );
}
