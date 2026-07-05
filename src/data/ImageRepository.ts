// 画像アップロードのデータアクセス抽象。
// upload は「保存すべき imageUrl」を返す:
//   - HTTP 実装 … S3 に PUT した後の キー（images/ を除いたファイル名）
//   - localStorage 実装 … 選択画像の data: URL（mock。バックエンド無しで動かすため）
// いずれも imageUrl.ts が解決できる値（キー or data:/http(s):）を返す。
export interface ImageRepository {
  upload(file: File): Promise<string>;
}
