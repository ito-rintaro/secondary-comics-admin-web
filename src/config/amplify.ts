import { Amplify } from "aws-amplify";

/**
 * Amplify（Cognito 認証）の初期化。
 * アプリ起動時に main.tsx で 1 回だけ import される。
 * 設定値は .env の VITE_* から取得する（ハードコードしない）。
 * 既存バックエンドと同じ User Pool（ap-northeast-1_lvEOCAFnu）を使う。
 */
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    },
  },
});
