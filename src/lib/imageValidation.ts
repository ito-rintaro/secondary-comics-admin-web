// 画像アップロードのクライアント検証（設計メモ §7.1 確定値）。
// 署名付き PUT では S3 側でサイズ/型を厳密強制できないため、送信前にここで担保する。
// 許可形式はバックエンドの allow-list と一致させること（SVG は XSS 対策で不可）。

export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB

export interface ImageValidation {
  ok: boolean;
  reason?: string;
}

/** File が許可 MIME かつサイズ上限内か検証する。 */
export const validateImageFile = (file: File): ImageValidation => {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "対応形式は JPEG / PNG / WebP のみです。" };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      reason: `ファイルサイズは 10MB 以下にしてください（現在 ${mb}MB）。`,
    };
  }
  return { ok: true };
};
