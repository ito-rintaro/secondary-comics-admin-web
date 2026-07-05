import type { ImageRepository } from "../ImageRepository";
import { ApiError, apiRequest } from "./httpClient";

// POST /uploads のレスポンス（openapi.yaml UploadTicket）。
interface UploadTicket {
  key: string; // 保存すべき imageUrl（images/ を除いたファイル名）
  uploadUrl: string; // ここに画像バイトを PUT する
  expiresIn: number; // 有効秒数
}

// 画像アップロード実装（設計メモ 署名付き PUT 方式）。
// 1. POST /uploads で署名付き PUT URL を取得（editor 認証は httpClient が付与）。
// 2. uploadUrl へ画像を直接 PUT（署名付き URL のため認証ヘッダは付けない）。
//    Content-Type は署名時に申告した contentType と一致させる。
// 3. 保存すべき key を返す（呼び出し側が imageUrl に入れる）。
export class HttpImageRepository implements ImageRepository {
  async upload(file: File): Promise<string> {
    const contentType = file.type;

    const ticket = await apiRequest<UploadTicket>("/uploads", {
      method: "POST",
      body: { contentType },
    });

    const res = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
    });
    if (!res.ok) {
      throw new ApiError(
        res.status,
        `画像のアップロードに失敗しました（S3 ${res.status}）。`,
      );
    }

    return ticket.key;
  }
}
