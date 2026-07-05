# 開発ドキュメント（market-catalog-editor）

市場相場（MarketRecord）とカタログ書誌マスタ（Catalog）を編集する管理用 Web ツールの
開発者向けドキュメント。仕様の正本は
[`../market-catalog-editor-spec.md`](../market-catalog-editor-spec.md)。

## アーキテクチャ概要

```
UI (features/*)
   └─ 依存するのは interface のみ ─┐
                                  ▼
             CatalogRepository / MarketRepository  (data/*.ts)
                                  ▲
      具体実装の選択は config/container.ts の 1 箇所に集約
                                  │
        ┌─────────────────────────┴───────────────┐
   LocalXxxRepository (localStorage)        HttpXxxRepository (将来 / fetch)
```

- **画面から直接 `localStorage` / `fetch` を触らない。** 必ず Repository interface 越し。
- モック（localStorage）→ 実 API（Lambda）の切替は `container.ts` の差し替えのみで完結する。

## ディレクトリ構成

| パス | 役割 |
|---|---|
| `src/domain/` | 型定義（バックエンド `domain/**` / `openapi.yaml` と一致） |
| `src/data/` | Repository interface（`CatalogRepository.ts` / `MarketRepository.ts`） |
| `src/data/localStorage/` | localStorage 実装 + JSON ストアヘルパ |
| `src/data/seed/` | 初期シード（起動時に localStorage が空なら投入） |
| `src/lib/` | `marketDerive.ts`（§8 導出）・`imageUrl.ts`（画像解決）・`format.ts` |
| `src/features/catalog/` | カタログ CRUD 画面 |
| `src/features/market/` | マーケット CRUD 画面 |
| `src/features/common/` | Thumbnail / ConfirmDialog / Sparkline |
| `src/config/container.ts` | 依存の組み立て（DI） |

## ドメインルール

- **相場の導出（`src/lib/marketDerive.ts`）**
  - `price = history[history.length - 1]`（末尾）
  - `change = (末尾 - 先頭) / 先頭`（先頭 0 のときは 0）
  - `history` はちょうど 12 要素・各要素 0 以上の整数でなければ保存不可
  - シード生成・create・update から共用し、保存前に必ず再導出する
- **id / listedAt 採番（localStorage 実装）**
  - Catalog … `cat-XXX`（既存最大 +1、3 桁ゼロ埋め）
  - Market … `mk{n}`（既存最大 +1）／ `listedAt` は既存最大 +1
- **画像 URL（`src/lib/imageUrl.ts`）**
  - `imageUrl` は S3 オブジェクトキー（ファイル名のみ）
  - `VITE_IMAGE_BASE_URL`（ドメインのみ・末尾スラッシュ無し）＋ コード側で `/images/` 前置
  - 既存 web `src/presentation/imageSrc.ts` と同一挙動

## UI レイアウト

- 左サイドバーにタブ（カタログ / マーケット）を縦並び、右側に各画面。
- 720px 以下ではサイドバーを上部の横並びバーに自動で切り替える。
- ルーター・状態管理ライブラリは不使用（`App.tsx` のローカル state で切替）。

## 認証・認可（editor グループゲート）

- 既存バックエンドと同じ Cognito User Pool でサインインする（Amplify Auth・SRP）。
- **`editor` グループ所属ユーザーだけが本体に到達できる。** 未所属ユーザーはログイン後に
  即 `signOut()` し、「編集権限がありません」画面を表示する。
- 判定は [`src/presentation/auth/AuthGate.tsx`](../src/presentation/auth/AuthGate.tsx) の
  1 か所に集約し、個別画面に権限チェックを散らさない。**editor 判定が済むまで本体を一切
  マウントしない**（ちらつき防止）。3 状態（ログイン画面 / 権限なし画面 / 本体）を明確に分離。
- グループ判定は [`src/presentation/auth/editorGate.ts`](../src/presentation/auth/editorGate.ts)。
  `cognito:groups` は配列・文字列の両形式を吸収してから判定する。
- FE のゲートは UX 制御であり、**セキュリティの最終防衛線は編集 API の 403**（サーバ側）。
  グループ変更はトークン再発行（再ログイン）まで反映されない点は運用で周知する。

## 開発コマンド

```bash
npm install
npm run dev          # .env.dev を読んで開発サーバ
npm run build:dev    # tsc -b && vite build --mode dev
npm run build:prod   # tsc -b && vite build --mode prod
npm run lint         # ESLint
```

## 環境変数

`.env.example` を参照。`.env.dev` / `.env.prod` を作成（コミットしない）。当面 localStorage
完結のため実質必須は `VITE_IMAGE_BASE_URL` のみ。残りは将来の API / 認証接続用に予約。

## デプロイ / インフラ上の注意

- **`AWS_S3_BUCKET` は admin 専用バケットを指すこと。** `s3 sync --delete` を既存 web の
  バケットに向けると既存サイトが消える（仕様書 §14-1）。
- 編集ツールを公開 CloudFront に素で置かない。API 書込みへ切り替える前に、IP 制限 / Basic 認証 /
  署名付き Cookie / Cognito 流用のいずれかで配信面を保護する（仕様書 §14-2）。
