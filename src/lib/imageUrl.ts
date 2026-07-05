/**
 * コレクション/マーケット画像の表示用 src を解決する（Presentation の関心事）。
 *
 * 既存 web の src/presentation/imageSrc.ts をそのまま写経したもの。挙動を一致させること。
 * imageUrl には S3 オブジェクトキー（ファイル名のみ。例: "xxx.jpg"）が入る。
 * 実体は CloudFront 配下の images/ に置かれるため、ドメイン + "/images/" を前置する。
 *  - 空文字 … 画像なし。'' を返し、呼び出し側がプレースホルダを表示する。
 *  - 絶対URL（http/https）や dataURL … そのまま使う（既存データ互換）。
 *  - それ以外（キー）… CloudFront の images/ 配下に解決する。
 *
 * 配信元は VITE_IMAGE_BASE_URL（CloudFront ドメイン。末尾スラッシュ無し）。
 */
const BASE_URL =
  (import.meta.env.VITE_IMAGE_BASE_URL ?? '').replace(/\/+$/, '') + '/images';

const isAbsolute = (s: string): boolean => /^(https?:|data:)/i.test(s);

/** imageUrl を表示できる URL に変換する。画像が無ければ '' を返す。 */
export const resolveImageSrc = (imageUrl: string | undefined): string => {
  const value = imageUrl?.trim() ?? '';
  if (!value) return '';
  if (isAbsolute(value)) return value;
  return `${BASE_URL}/${value.replace(/^\/+/, '')}`;
};
