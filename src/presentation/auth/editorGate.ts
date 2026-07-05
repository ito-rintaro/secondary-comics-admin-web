import { fetchAuthSession, signOut } from "aws-amplify/auth";

// この編集ツールは Cognito の editor グループ所属ユーザーだけが利用できる。
// 未所属ユーザーはログイン後に締め出し、「権限なし」画面を表示する。
// ここは UX 制御であり、セキュリティの最終防衛線は編集 API 側の 403（サーバ）。
const EDITOR_GROUP = "editor";

/**
 * cognito:groups を配列に正規化して返す。
 * 基本は配列（例 ["editor"]）だが、環境により文字列で来る場合もあるため両形式を吸収する。
 */
export const readGroups = (payload: Record<string, unknown>): string[] => {
  const raw = payload["cognito:groups"];
  if (Array.isArray(raw)) {
    return raw.filter((g): g is string => typeof g === "string");
  }
  if (typeof raw === "string") {
    return raw
      .replace(/^\[|\]$/g, "")
      .split(/[,\s]+/)
      .filter(Boolean);
  }
  return [];
};

/** ログイン済みユーザーが editor グループに所属しているか判定する。 */
export const isEditor = async (): Promise<boolean> => {
  const session = await fetchAuthSession();
  const payload = session.tokens?.idToken?.payload ?? {};
  return readGroups(payload as Record<string, unknown>).includes(EDITOR_GROUP);
};

/**
 * editor 未所属なら signOut() して締め出す。
 * true のとき呼び出し側は本体を描画、false のとき「権限なし」画面を表示する。
 */
export const enforceEditorOrSignOut = async (): Promise<boolean> => {
  if (await isEditor()) return true;
  await signOut();
  return false;
};
