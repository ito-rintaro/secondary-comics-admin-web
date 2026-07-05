import type { ImageRepository } from "../ImageRepository";

// モック実装（VITE_USE_API=false）。S3 が無いため、選択画像を data: URL として読み込み
// そのまま imageUrl に使う。imageUrl.ts が data: を素通しするため表示・保存できる。
// 注意: data: URL は大きく、localStorage 保存でクォータ超過の恐れがある（dev 用の割り切り）。
export class LocalImageRepository implements ImageRepository {
  async upload(file: File): Promise<string> {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("画像の読み込みに失敗しました。"));
      reader.readAsDataURL(file);
    });
  }
}
