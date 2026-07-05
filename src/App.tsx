import { useState } from "react";
import { AuthGate } from "./presentation/auth/AuthGate";
import { CatalogPage } from "./features/catalog/CatalogPage";
import { MarketPage } from "./features/market/MarketPage";

type Tab = "catalog" | "market";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "catalog", label: "カタログ", icon: "📚" },
  { key: "market", label: "マーケット", icon: "📈" },
];

// アプリのシェル。editor グループ所属ユーザーだけが AuthGate を通過して本体に到達する。
// 左サイドバーにタブを縦並びで置き、右側に各画面を表示する（指示書 §9 共通）。
export default function App() {
  const [tab, setTab] = useState<Tab>("catalog");

  return (
    <AuthGate>
      {({ username, signOut }) => (
        <div className="app">
          <aside className="sidebar">
            <h1 className="sidebar__title">
              市場・カタログ
              <span className="sidebar__subtitle">編集ツール</span>
            </h1>
            <nav className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className={tab === t.key ? "tab tab--active" : "tab"}
                  aria-current={tab === t.key ? "page" : undefined}
                  onClick={() => setTab(t.key)}
                >
                  <span className="tab__icon" aria-hidden="true">
                    {t.icon}
                  </span>
                  {t.label}
                </button>
              ))}
            </nav>

            <div className="sidebar__user">
              <span className="sidebar__username" title={username}>
                {username}
              </span>
              <button
                type="button"
                className="btn btn--sm sidebar__logout"
                onClick={signOut}
              >
                ログアウト
              </button>
              <p className="sidebar__note muted">
                データは localStorage に保存されます（モックモード）。
              </p>
            </div>
          </aside>

          <main className="content">
            {tab === "catalog" ? <CatalogPage /> : <MarketPage />}
          </main>
        </div>
      )}
    </AuthGate>
  );
}
