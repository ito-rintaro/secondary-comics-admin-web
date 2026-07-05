import { Authenticator, ThemeProvider } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { authTheme, configureAuthLanguage } from "./authTheme";
import { enforceEditorOrSignOut } from "./editorGate";

configureAuthLanguage();

type RenderProps = {
  /** 現在ログイン中のユーザー名（メール）。 */
  username: string;
  /** ログアウト関数。サイドバーのログアウトボタンなどに渡す。 */
  signOut: () => void;
};

type Props = {
  /** editor 所属ユーザーがログイン済みのときだけ描画される本体。 */
  children: (props: RenderProps) => ReactNode;
};

/**
 * 認証 + editor グループゲート。権限判定はこの 1 か所に集約する（個別画面に散らさない）。
 *
 * 3 状態を明確に分ける：
 *   1. ログイン画面      … Cognito の Authenticator（未ログイン時）
 *   2. 権限なし画面      … ログインは通ったが editor 未所属 → signOut 済み
 *   3. アプリ本体        … editor 所属を確認できたときだけマウント
 *
 * editor 判定が済むまで本体を一切マウントしない（ちらつき防止）。
 * signOut() は Authenticator を即ログイン画面へ戻すため、「権限なし」画面は
 * Authenticator の"外側"（denied 状態）で描画する。
 */
export function AuthGate({ children }: Props) {
  const [denied, setDenied] = useState(false);

  if (denied) {
    return <DeniedScreen onRetry={() => setDenied(false)} />;
  }

  return (
    <ThemeProvider theme={authTheme} colorMode="dark">
      {/* メールでサインイン／サインアップさせる。 */}
      <Authenticator loginMechanisms={["email"]}>
        {({ signOut, user }) => (
          <EditorGate
            // user が変わるたびに判定し直す（別アカウントでのログインに追従）。
            key={user?.userId ?? user?.username ?? "anon"}
            username={
              user?.signInDetails?.loginId ?? user?.username ?? ""
            }
            signOut={signOut ?? (() => {})}
            onDenied={() => setDenied(true)}
          >
            {children}
          </EditorGate>
        )}
      </Authenticator>
    </ThemeProvider>
  );
}

/**
 * ログイン成功後、editor 所属を判定する内側ゲート。
 * 判定中はローディングを表示し、本体は一切マウントしない。
 */
function EditorGate({
  username,
  signOut,
  onDenied,
  children,
}: {
  username: string;
  signOut: () => void;
  onDenied: () => void;
  children: (props: RenderProps) => ReactNode;
}) {
  const [status, setStatus] = useState<"checking" | "granted">("checking");
  const decided = useRef(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      // editor なら true、未所属なら enforceEditorOrSignOut 内で signOut 済み。
      const ok = await enforceEditorOrSignOut();
      if (!active || decided.current) return;
      decided.current = true;
      if (ok) {
        setStatus("granted");
      } else {
        onDenied();
      }
    })();
    return () => {
      active = false;
    };
  }, [onDenied]);

  if (status !== "granted") {
    return (
      <div className="auth-status">
        <p className="auth-status__msg">権限を確認しています…</p>
      </div>
    );
  }

  return <>{children({ username, signOut })}</>;
}

/** 編集権限なし画面（editor 未所属）。既に signOut 済み。 */
function DeniedScreen({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="auth-denied">
      <div className="auth-denied__card">
        <div className="auth-denied__icon" aria-hidden="true">
          🔒
        </div>
        <h1 className="auth-denied__title">編集権限がありません</h1>
        <p className="auth-denied__text">
          このアカウントには編集権限がありません。
          <br />
          editor 権限を持つアカウントでサインインし直してください。
        </p>
        <button type="button" className="btn btn--primary" onClick={onRetry}>
          別のアカウントでサインイン
        </button>
      </div>
    </div>
  );
}
