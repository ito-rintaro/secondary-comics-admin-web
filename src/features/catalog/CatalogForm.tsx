import { useState } from "react";
import type { Catalog } from "../../domain/Catalog";
import { errorMessage } from "../../lib/errorMessage";

// カタログの作成 / 編集フォーム（指示書 §9-1）。
// title 必須。その他は空文字許容。id は編集時に読み取り専用表示（作成時は未採番）。
export type CatalogFormValues = Omit<Catalog, "id">;

const emptyValues: CatalogFormValues = {
  title: "",
  author: "",
  publisher: "",
  volume: "",
  year: "",
  flags: { firstEd: false, obi: false, special: false },
  imageUrl: "",
};

export function CatalogForm({
  editing,
  onSubmit,
  onCancel,
}: {
  editing: Catalog | null;
  onSubmit: (values: CatalogFormValues) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<CatalogFormValues>(
    editing ? { ...editing } : emptyValues,
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof CatalogFormValues>(
    key: K,
    v: CatalogFormValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: v }));

  const setFlag = (key: keyof Catalog["flags"], v: boolean) =>
    setValues((prev) => ({ ...prev, flags: { ...prev.flags, [key]: v } }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (values.title.trim() === "") {
      setError("title は必須です。");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ ...values, title: values.title.trim() });
    } catch (err) {
      // API モードでの 400 / 401 / 403 などをフォーム上に表示する。
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h2 className="form__title">
        {editing ? `カタログ編集（${editing.id}）` : "カタログ新規作成"}
      </h2>

      {editing && (
        <label className="field">
          <span className="field__label">id</span>
          <input className="field__input" value={editing.id} readOnly disabled />
        </label>
      )}

      <label className="field">
        <span className="field__label">
          title <span className="req">必須</span>
        </span>
        <input
          className="field__input"
          value={values.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="作品名"
        />
      </label>

      <div className="field-row">
        <label className="field">
          <span className="field__label">author</span>
          <input
            className="field__input"
            value={values.author}
            onChange={(e) => set("author", e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">publisher</span>
          <input
            className="field__input"
            value={values.publisher}
            onChange={(e) => set("publisher", e.target.value)}
          />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span className="field__label">volume</span>
          <input
            className="field__input"
            value={values.volume}
            onChange={(e) => set("volume", e.target.value)}
            placeholder="全6巻 / 第1巻 など"
          />
        </label>
        <label className="field">
          <span className="field__label">year</span>
          <input
            className="field__input"
            value={values.year}
            onChange={(e) => set("year", e.target.value)}
            placeholder="1984"
          />
        </label>
      </div>

      <fieldset className="flags">
        <legend className="field__label">flags</legend>
        <label className="flag">
          <input
            type="checkbox"
            checked={values.flags.firstEd}
            onChange={(e) => setFlag("firstEd", e.target.checked)}
          />
          初版
        </label>
        <label className="flag">
          <input
            type="checkbox"
            checked={values.flags.obi}
            onChange={(e) => setFlag("obi", e.target.checked)}
          />
          帯
        </label>
        <label className="flag">
          <input
            type="checkbox"
            checked={values.flags.special}
            onChange={(e) => setFlag("special", e.target.checked)}
          />
          特装
        </label>
      </fieldset>

      <label className="field">
        <span className="field__label">imageUrl（S3 オブジェクトキー / ファイル名のみ）</span>
        <input
          className="field__input"
          value={values.imageUrl}
          onChange={(e) => set("imageUrl", e.target.value)}
          placeholder="xxxx.jpg（空でも可）"
        />
      </label>

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
