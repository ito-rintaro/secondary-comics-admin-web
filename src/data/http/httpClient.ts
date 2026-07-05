import { fetchAuthSession } from "aws-amplify/auth";

// 編集系 API（docs/openapi.yaml）への薄い HTTP クライアント。
// - ベース URL は VITE_API_BASE_URL。末尾スラッシュは無視して path と結合する。
//   API Gateway のステージを URL に含める構成なら VITE_API_BASE_URL 側に含めること。
// - 認証は Cognito の ID トークンを Authorization: Bearer で送る
//   （editor グループ判定に使う cognito:groups は ID トークンに載るため）。
// - 2xx 以外はレスポンス body の { message } を拾って ApiError を投げる。

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const baseUrl = (): string => {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (!raw) {
    throw new ApiError(0, "VITE_API_BASE_URL が未設定です。");
  }
  return raw.replace(/\/+$/, "");
};

// Cognito の ID トークンを Authorization ヘッダに載せる。未ログインなら 401 相当。
const authHeader = async (): Promise<Record<string, string>> => {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  if (!token) {
    throw new ApiError(401, "ログインが必要です（認証トークンを取得できません）。");
  }
  return { Authorization: `Bearer ${token}` };
};

// 失敗レスポンスから body の { message } を優先して取り出す。
const extractMessage = async (res: Response): Promise<string> => {
  try {
    const body = (await res.json()) as unknown;
    if (
      body &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message: unknown }).message === "string"
    ) {
      return (body as { message: string }).message;
    }
  } catch {
    // JSON でない / 空 body はステータス文言にフォールバック
  }
  return res.statusText || `HTTP ${res.status}`;
};

export interface RequestOptions {
  method?: string;
  body?: unknown;
}

// 認証付きで送信し、2xx 以外は ApiError を投げて Response を返す共通処理。
const send = async (path: string, opts: RequestOptions): Promise<Response> => {
  const auth = await authHeader();
  const hasBody = opts.body !== undefined;
  const res = await fetch(`${baseUrl()}${path}`, {
    method: opts.method ?? "GET",
    headers: {
      ...auth,
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    throw new ApiError(res.status, await extractMessage(res));
  }
  return res;
};

// JSON レスポンスを返す共通リクエスト（GET / POST / PUT）。
export const apiRequest = async <T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> => {
  const res = await send(path, opts);
  return (await res.json()) as T;
};

// 本文を返さないリクエスト（DELETE の 204 など）。成功可否だけを扱う。
export const apiRequestVoid = async (
  path: string,
  opts: RequestOptions = {},
): Promise<void> => {
  await send(path, opts);
};
