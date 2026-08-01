# 開発ドキュメント（market-catalog-editor）

マーケット成約ログ（MarketSale）・相場サマリ（MarketSummary）とカタログ書誌マスタ（Catalog）を
編集する管理用 Web ツールの開発者向けドキュメント。仕様の正本は
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
| `src/lib/` | `marketDerive.ts`（成約ログ→相場サマリの畳み込み・成約入力の検証）・`csv.ts`（CSV パーサ + 取込結果の共通型）・`marketCsv.ts` / `catalogCsv.ts`（各ドメインの列定義・検証・入力への変換）・`imageUrl.ts`（画像解決）・`imageValidation.ts`（アップロード検証）・`format.ts`・`errorMessage.ts` |
| `src/features/catalog/` | カタログ CRUD 画面（`CatalogForm` 単票入力 + `CatalogCsvImport` CSV 一括取込） |
| `src/features/market/` | マーケット CRUD 画面（`MarketForm` 単票入力 + `MarketCsvImport` CSV 一括取込） |
| `src/features/common/` | Thumbnail / ConfirmDialog / Sparkline |
| `src/config/container.ts` | 依存の組み立て（DI） |

## ドメインルール

- **マーケットは 2 層構造**
  - **成約ログ `MarketSale`（`GET /market`）** … 1 レコード＝1 価格の append-only な取引ログ。
    editor の CRUD 対象。書誌はサーバが `catalogId` 参照の Catalog から合成する。
  - **相場サマリ `MarketSummary`（`GET /market/summary`）** … catalog 単位に集計した読み取りモデル。
    相場一覧カード・価格チャートの供給源。`price` / `change` / `history[12]` は導出値。
    **成約が 1 件以上ある catalog のみ**返る（0 件は含まれない）。
- **相場サマリの導出（`src/lib/marketDerive.ts` の `deriveSummaries`）**
  - サーバ（`GET /market/summary`）の集計を、モックモードでも同じ畳み込みで再現する。
  - 直近 12 ヶ月の月バケットに成約価格を振り分け、月内平均。欠損月は前方フィル、
    最初の成約より前はバックフィルして `history[12]` を成立させる（末尾＝当月）。
  - `price = history` 末尾、`change = (末尾 - 先頭) / 先頭`（先頭 0 のときは 0）。
  - 実 API では `HttpMarketRepository` が `/market/summary` をそのまま呼ぶため、この畳み込みは
    モック（`LocalMarketRepository`）専用。
  - 成約入力の検証 `validatePrice`（0 以上の整数）/ `validateSoldAt`（実在暦日・未来日許容）も提供。
- **id 採番（localStorage 実装）**
  - Catalog … `cat-XXX`（既存最大 +1、3 桁ゼロ埋め）
  - MarketSale … `mk{n}`（既存最大 +1）。保存形が変わったため保存キーは `editor:markets:v2`
    （旧 `editor:markets` の非互換データは読まない）。
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
- **マーケット成約の入力は単一成約**: `POST/PUT /market` の `NewMarketInput` は
  `catalogId / condition / price / soldAt / seller` のみで、書誌（title/author/… / flags）は
  サーバが参照カタログから合成する。そのため `MarketForm` はカタログ選択を必須にし、
  書誌は選択カタログからの読み取り専用プレビューにしている。相場（現在価格・変化率・チャート）は
  成約を積み重ねて `GET /market/summary` 側で自動算出されるため、フォームは history を入力しない。
  なお `MarketSale` は `catalogId` を保持するため、編集時はカタログを再選択せず初期選択できる。
- **`condition` は鑑定記録（自由文字列・任意）**: 型・契約は `string`（空文字可。`NewMarketInput`
  では必須から外れている）。分類（グレード体系）が未確定のため保存層は縛らない。ただし
  **入力画面（`MarketForm`）だけ** GBA ランクとして **0〜10.0・0.1 刻み** に制限し、`validateGbaRank`
  で検証する（未鑑定は空欄可）。制限は UI に閉じており、体系が変われば `validateGbaRank` の
  差し替えだけで済む。表示（成約ログ）では空文字なら「—」を出す。
- **`seller` は販売元（自由文字列・空文字可）**: 型・契約は `string` のまま。ただし
  **入力画面（`MarketForm`）だけ** 主要販売元を **メルカリ / ヤフオク / ebay / その他** の
  セレクトから選ばせる（`SELLER_PRESETS` + 「その他」）。「その他」を選ぶと自由入力欄が出て、
  プリセット外の個別ショップ名（既存データの「駿河屋」等）も入力・保持できる。編集時は既存値が
  プリセットなら選択、そうでなければ「その他」＋自由入力に自動で振り分ける。制限は UI に閉じており、
  選択肢が変わってもこのフォームの差し替えだけで済む。
- **CSV からの成約一括取込（`MarketCsvImport` + `src/lib/marketCsv.ts`）**: 成約ログビューの
  「CSV から追加」からファイルを選び、`catalogId / price / soldAt / condition / seller` 列を持つ
  CSV を取り込む。API に一括エンドポイントは無いため、**登録は有効行を 1 件ずつ `POST /market`
  で逐次実行**する（`marketRepository.create` のループ）。`catalogId` 列で既存 Catalog を参照し、
  書誌は単票の `MarketForm` と同様に参照カタログから合成する（新規ライブラリは足さず自前パーサ）。
  検証は `marketDerive.ts` の `validatePrice` / `validateSoldAt` を再利用し、**プレビューで有効行 /
  エラー行（理由付き）に振り分けてから登録**する。必須列（`catalogId` / `price` / `soldAt`）欠落は
  ヘッダエラーとして全体を止める。動作確認用のサンプルは
  [`sample-market-sales.csv`](./sample-market-sales.csv)（全行有効）と
  [`sample-market-sales-with-errors.csv`](./sample-market-sales-with-errors.csv)（エラー混在）。
- **CSV からのカタログ一括取込（`CatalogCsvImport` + `src/lib/catalogCsv.ts`）**: カタログ一覧の
  「CSV から追加」からファイルを選び、`title / author / publisher / volume / year / firstEd / obi /
  special` 列を持つ CSV を取り込む。マーケット側と同じ流れ（**プレビューで有効行 / エラー行に
  振り分け → 有効行を 1 件ずつ `POST /catalogs` で逐次実行**）で、`title` のみ必須
  （`NewCatalogInput` と同じ。欠落はヘッダエラーで全体を止める）。設計判断は 3 点:
  - **`imageUrl` 列は持たない** … 画像はアップロード専用（[`image-upload-design.md`](./image-upload-design.md)
    §7.1 で `CatalogForm` からキー手入力欄を撤去済み）で、キーの実在検証もできないため。
    取込直後は空文字とし、画像は後から編集画面でアップロードする。
  - **flags は `firstEd` / `obi` / `special` の 3 列** … `true/false`・`1/0`・`yes/no`・`○/×`
    （全角・大文字小文字は問わない）を受理し、空欄は `false`。解釈できない値は**エラー行**にして、
    誤った値が黙って `false` に落ちないようにする。
  - **重複は警告のみで登録はブロックしない** … カタログはサーバ採番の `id` しか一意キーが無いため、
    `title + author + volume`（NFKC 正規化）で既存カタログ・CSV 内の先行行との重複を検知し、
    プレビューに警告として出す。同名別版（版元違い・復刻版など）の正当な登録もあるため最終判断は人に委ねる。
    `year` が西暦 4 桁を含まない場合も列ずれ検知のため警告を出す（`Catalog.year` は自由文字列なのでエラーにはしない）。

  動作確認用のサンプルは [`sample-catalogs.csv`](./sample-catalogs.csv)（全行有効）と
  [`sample-catalogs-with-errors.csv`](./sample-catalogs-with-errors.csv)（エラー行 + 警告行の混在）。
- **CSV の共通部品（`src/lib/csv.ts`）**: RFC4180 風パーサ（BOM 除去・`""` エスケープ・CRLF/LF）、
  空行判定、ヘッダ列の解決、取込結果の型 `CsvImportResult<TValid>` / `CsvErrorRow` を置く。
  列定義・検証規則はドメイン側（`marketCsv.ts` / `catalogCsv.ts`）が持ち、ここには入れない。
  CSV ライブラリは追加していない（依存を増やさない方針）。
- **成約ログの絞り込み取得**: `GET /market?catalogId=...` を指定するとその catalog の成約を
  `soldAt` 降順で返す（個別の相場推移詳細向け）。現行 FE の `list()` は全件取得で、この
  クエリは未使用（将来の詳細ビュー用の拡張余地）。
- **ステージ**: リクエストは `VITE_API_BASE_URL + /catalogs` の形で組み立てる。API Gateway が
  名前付きステージ（例 `/dev`）なら `VITE_API_BASE_URL` 末尾に含める（`$default` なら不要）。
- **エラー**: 2xx 以外はレスポンス body の `{ message }` を拾って `ApiError` を投げ、
  フォーム / バナーに表示する（400 / 401 / 403 / 404）。

## UI レイアウト

- 左サイドバーにタブ（カタログ / マーケット）を縦並び、右側に各画面。
- マーケット画面は「相場サマリ（読み取り・チャート）」と「成約ログ（編集・削除・追加）」を
  1 画面内のセグメントトグルで切り替える。
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
