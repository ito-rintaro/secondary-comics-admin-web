# secondary-comics-admin-web
プレミア漫画のコレクション管理とマーケット相場閲覧のWebアプリ。React / TypeScript
二次流通コミックの **市場相場（MarketRecord）** と **カタログ書誌マスタ（Catalog）** を
編集する管理用 Web ツール。当面は **モックデータ + localStorage** で完結し、将来 Lambda に
編集系 API が生えたらデータアクセス層（Repository）だけを差し替えて接続する。

> 仕様の正本は [`market-catalog-editor-spec.md`](./market-catalog-editor-spec.md)。
> データモデルは既存バックエンド `secondary-comics-backend`（`docs/openapi.yaml` /
> `lambda/src/domain/**`）と一致させている。

## 技術スタック

- React 19 / TypeScript (~6) / Vite（既存 web `secondary-comics-web` に統一）
- 状態管理ライブラリ・ルーターは不使用（依存は最小限）
- ホスティング：S3 + CloudFront（**既存 web とは別バケット・別ディストリビューション**）

## セットアップ

```bash
npm install
```

環境変数は `.env.example` を参照。`.env.dev` / `.env.prod` を作成する（コミットしない）。
当面 localStorage 完結のため、実質必須なのは画像配信元 `VITE_IMAGE_BASE_URL` のみ。

## 開発 / ビルド

```bash
npm run dev          # .env.dev を読んで開発サーバ起動
npm run build:dev    # tsc -b && vite build --mode dev（dev 用 dist/）
npm run build:prod   # tsc -b && vite build --mode prod（prod 用 dist/）
npm run lint         # ESLint
```

ビルド成果物は `dist/`（静的ファイルのみ）。S3 に置けばそのまま配信できる。

## アーキテクチャの要点

- **データアクセスは必ず Repository 越し**（[`src/data/CatalogRepository.ts`](src/data/CatalogRepository.ts) /
  [`src/data/MarketRepository.ts`](src/data/MarketRepository.ts)）。画面から直接 `localStorage` / `fetch`
  を触らない。実装の差し替えは [`src/config/container.ts`](src/config/container.ts) の 1 箇所に集約。
- **相場の導出**（[`src/lib/marketDerive.ts`](src/lib/marketDerive.ts)）：
  `price = history 末尾`、`change = (末尾-先頭)/先頭`（先頭 0 は 0）。`history` は
  ちょうど 12 要素・0 以上整数でなければ保存不可。UI からは入力させず導出値を表示。
- **画像 URL**（[`src/lib/imageUrl.ts`](src/lib/imageUrl.ts)）：既存 web の `imageSrc.ts` を写経。
  env は `VITE_IMAGE_BASE_URL`（ドメインのみ・末尾スラッシュ無し）、`/images/` はコード側で前置。
- 初回起動時、localStorage が空ならシード（[`src/data/seed/`](src/data/seed/)）を投入。破損データは
  シードで自己修復する。

## デプロイ（S3 配置）

`.github/workflows/deploy.yml`（既存 web 流用）:

- `main` push → dev バケットへ自動デプロイ / 手動実行で dev・prod を選択
- `VITE_*` は GitHub Environments (dev/prod) の Variables から注入
- **`AWS_S3_BUCKET` は admin 専用バケットを指すこと**（`--delete` sync が既存サイトを消さないため）

手動で置く場合:

```bash
npm run build:prod
aws s3 sync dist/ s3://<admin-専用バケット>/ --delete
```

## セキュリティ（配信面の保護）

編集ツールを **公開 CloudFront に素で置かない**。API 書込みに差し替えた瞬間、公開 URL の
誰でも触れる管理画面になる。配信構築時点で IP 制限（WAF）/ Basic 認証 / 署名付き Cookie /
Cognito 流用のいずれかを決めること（仕様書 §14-2）。

## 将来の API 接続

`VITE_USE_API=true` にし、`HttpCatalogRepository` / `HttpMarketRepository`（`fetch` 実装）を
用意して `container.ts` で返すよう差し替える。ベース URL は `VITE_API_BASE_URL`、認証が必要なら
`Authorization: Bearer <JWT>` を付与する（仕様書 §10）。
