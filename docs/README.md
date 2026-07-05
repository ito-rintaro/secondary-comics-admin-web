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
   LocalXxxRepository (localStorage)        HttpXxxRepository (fetch / 実 API)
```

- **画面から直接 `localStorage` / `fetch` を触らない。** 必ず Repository interface 越し。
- モック（localStorage）→ 実 API（Lambda）の切替は `container.ts` の差し替えのみで完結する。
  `VITE_USE_API === "true"` で `HttpXxxRepository`、それ以外は `LocalXxxRepository`。

## ディレクトリ構成

| パス | 役割 |
|---|---|
| `src/domain/` | 型定義（バックエンド `domain/**` / `openapi.yaml` と一致） |
| `src/data/` | Repository interface（`CatalogRepository.ts` / `MarketRepository.ts` / `ImageRepository.ts`） |
| `src/data/localStorage/` | localStorage 実装 + JSON ストアヘルパ（`ImageRepository` は data: URL 化） |
| `src/data/http/` | 実 API 実装（`httpClient.ts` + `HttpCatalogRepository` / `HttpMarketRepository` / `HttpImageRepository`） |
| `src/data/seed/` | 初期シード（起動時に localStorage が空なら投入） |
| `src/lib/` | `marketDerive.ts`（§8 導出）・`imageUrl.ts`（画像解決）・`imageValidation.ts`（アップロード検証）・`format.ts`・`errorMessage.ts` |
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
  - 画像を Web からアップロードする機能の設計は
    [`image-upload-design.md`](./image-upload-design.md)（署名付き PUT 方式・設計中）

## 編集系 API 接続（`src/data/http/`）

- 契約は [`openapi.yaml`](./openapi.yaml)。`VITE_USE_API === "true"` のとき `container.ts` が
  `HttpXxxRepository` を返し、`VITE_API_BASE_URL` 宛に接続する。
- **対応範囲は追加・編集・削除（create / update / delete）。** 削除は
  `DELETE /catalogs/{id}` / `DELETE /market/{id}`（成功時 204・本文なし）。失敗
  （403/404 等）は各ページが捕捉してバナー表示する（`Catalog/MarketPage`）。
- 本文なしの 204 は `httpClient.ts` の `apiRequestVoid`（JSON を読まない）で扱う。
- **認証**: `httpClient.ts` が Cognito の **ID トークン**を `Authorization: Bearer` で送る
  （editor グループ判定に使う `cognito:groups` は ID トークンに載るため）。
- **マーケットの書誌は catalogId 参照**: `POST/PUT /market` の `NewMarketInput` は
  `catalogId / seller / condition / history` のみで、書誌（title/author/… / flags）は
  サーバが参照カタログから導出する。そのため `MarketForm` はカタログ選択を必須にし、
  書誌は選択カタログからの読み取り専用プレビューにしている。`catalogId` は入力専用で、
  保存・返却型の `MarketRecord` には持たせない（localStorage 実装は無視する）。
- **ステージ**: リクエストは `VITE_API_BASE_URL + /catalogs` の形で組み立てる。API Gateway が
  名前付きステージ（例 `/dev`）なら `VITE_API_BASE_URL` 末尾に含める（`$default` なら不要）。
- **エラー**: 2xx 以外はレスポンス body の `{ message }` を拾って `ApiError` を投げ、
  フォーム / バナーに表示する（400 / 401 / 403 / 404）。

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

`.env.example` を参照。`.env.dev` / `.env.prod` を作成（コミットしない）。localStorage 完結の
モックモードでは実質必須は `VITE_IMAGE_BASE_URL` のみ。**実 API に接続する場合**は
`VITE_USE_API=true` と `VITE_API_BASE_URL`（+ 必要ならステージ）を設定する。

## デプロイ / インフラ上の注意

- **`AWS_S3_BUCKET` は admin 専用バケットを指すこと。** `s3 sync --delete` を既存 web の
  バケットに向けると既存サイトが消える（仕様書 §14-1）。
- 編集ツールを公開 CloudFront に素で置かない。API 書込みへ切り替える前に、IP 制限 / Basic 認証 /
  署名付き Cookie / Cognito 流用のいずれかで配信面を保護する（仕様書 §14-2）。
