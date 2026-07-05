import { useState } from "react";
import { resolveImageSrc } from "../../lib/imageUrl";

// imageUrl（S3 オブジェクトキー）からサムネイルを表示する。
// 空文字・解決失敗・読み込みエラー時はプレースホルダを出す（画像未配置でも壊れない）。
export function Thumbnail({
  imageUrl,
  alt,
  size = 48,
}: {
  imageUrl: string;
  alt: string;
  size?: number;
}) {
  const [errored, setErrored] = useState(false);
  const src = resolveImageSrc(imageUrl);

  if (!src || errored) {
    return (
      <span
        className="thumb thumb--placeholder"
        style={{ width: size, height: size }}
        aria-label="画像なし"
        title="画像なし"
      >
        📚
      </span>
    );
  }

  return (
    <img
      className="thumb"
      style={{ width: size, height: size }}
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
}
