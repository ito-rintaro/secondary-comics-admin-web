import { useState } from "react";
import { CatalogPage } from "./features/catalog/CatalogPage";
import { MarketPage } from "./features/market/MarketPage";

type Tab = "catalog" | "market";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "catalog", label: "カタログ", icon: "📚" },
  { key: "market", label: "マーケット", icon: "📈" },
];

// アプリのシェル。左サイドバーにタブを縦並びで置き、右側に各画面を表示する（指示書 §9 共通）。
// ルーティングライブラリは使わずローカル state で切替（依存は最小限・§11）。
export default function App() {
  const [tab, setTab] = useState<Tab>("catalog");

  return (
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
        <p className="sidebar__note muted">
          データは localStorage に保存されます（モックモード）。
        </p>
      </aside>

      <main className="content">
        {tab === "catalog" ? <CatalogPage /> : <MarketPage />}
      </main>
    </div>
  );
}
