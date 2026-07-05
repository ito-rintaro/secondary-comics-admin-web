import { useEffect, useRef, useState } from "react";
import type { Catalog } from "../../domain/Catalog";
import { errorMessage } from "../../lib/errorMessage";
import { validateImageFile } from "../../lib/imageValidation";
import { imageRepository } from "../../config/container";
import { Thumbnail } from "../common/Thumbnail";

// カタログの作成 / 編集フォーム（指示書 §9-1）。
// title 必須。その他は空文字許容。id は編集時に読み取り専用表示（作成時は未採番）。
// 画像はアップロード専用（設計メモ §7.1）。imageUrl のキー手入力欄は撤去し、
// ファイル選択 →「アップロード」ボタンで確定 → クリアで空に戻す。
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

  // 画像アップロード用のローカル状態。
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // 未アップロードの objectURL
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // objectURL は差し替え・アンマウント時に解放する。
  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const set = <K extends keyof CatalogFormValues>(
    key: K,
    v: CatalogFormValues[K],
  ) => setValues((prev) => ({ ...prev, [key]: v }));

  const setFlag = (key: keyof Catalog["flags"], v: boolean) =>
    setValues((prev) => ({ ...prev, flags: { ...prev.flags, [key]: v } }));

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    const v = validateImageFile(file);
    if (!v.ok) {
      setUploadError(v.reason ?? "画像が不正です。");
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }
    setUploadError(null);
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setUploadError(null);
    try {
      const key = await imageRepository.upload(selectedFile);
      set("imageUrl", key);
      // 確定後は未アップロードプレビューを破棄し、以降は imageUrl を表示。
      setSelectedFile(null);
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setUploadError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const handleClearImage = () => {
    set("imageUrl", "");
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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

  const hasImage = previewUrl !== null || values.imageUrl !== "";

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

      {/* 画像（アップロード専用） */}
      <div className="field">
        <span className="field__label">画像</span>
        <div className="image-upload">
          <div className="image-upload__preview">
            {previewUrl ? (
              <img
                className="thumb thumb--lg"
                src={previewUrl}
                alt="プレビュー"
              />
            ) : (
              <Thumbnail
                imageUrl={values.imageUrl}
                alt={values.title || "カタログ画像"}
                size={72}
              />
            )}
          </div>
          <div className="image-upload__controls">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <div className="image-upload__actions">
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={handleUpload}
                disabled={!selectedFile || uploading}
              >
                {uploading ? "アップロード中…" : "アップロード"}
              </button>
              {hasImage && (
                <button
                  type="button"
                  className="btn btn--sm"
                  onClick={handleClearImage}
                  disabled={uploading}
                >
                  画像をクリア
                </button>
              )}
            </div>
            <span className="field__hint muted">
              JPEG / PNG / WebP・最大 10MB。選択後「アップロード」で確定します。
            </span>
            {selectedFile && (
              <span className="field__hint muted">
                未アップロード: {selectedFile.name}
              </span>
            )}
            {uploadError && <span className="form__error">{uploadError}</span>}
          </div>
        </div>
      </div>

      {error && <p className="form__error">{error}</p>}

      <div className="form__actions">
        <button
          type="button"
          className="btn"
          onClick={onCancel}
          disabled={submitting || uploading}
        >
          キャンセル
        </button>
        <button
          type="submit"
          className="btn btn--primary"
          disabled={submitting || uploading}
        >
          {submitting ? "送信中…" : editing ? "更新" : "作成"}
        </button>
      </div>
    </form>
  );
}
