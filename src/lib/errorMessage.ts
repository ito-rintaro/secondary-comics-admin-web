// throw された unknown 値から、画面表示用のメッセージを取り出す。
// API 実装は ApiError（message にサーバの { message } を載せる）を投げるため、
// それ以外の例外も含めて安全に文字列化する。
export const errorMessage = (e: unknown): string => {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "不明なエラーが発生しました。";
};
