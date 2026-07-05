# 指示書：市場・カタログ データ編集ツール（新レポジトリ / admin web）

> この文書は **新しいフロントエンド用レポジトリ（admin web）** を新規作成するための指示書です。
> 新レポジトリで作業する Claude Code / 開発者は、この指示書を起点に実装してください。
> データモデルは既存バックエンド [`secondary-comics-backend`] の
> `docs/openapi.yaml` および `lambda/src/domain/**` と **必ず一致** させること。
>
> **本版は既存 web（`secondary-comics-web`）のインフラ構成レビューを反映した修正版です。**
> 既存 web と食い違うと事故・二重管理になる箇所を §3 / §10 / §14 に明記しています。
> 「既存 web と同じインフラに揃える」ことを最優先の制約とします。

---

## 1. 目的・背景

- 既存の `secondary-comics-backend`（DynamoDB + Lambda + API Gateway）は、
  **参照系（GET）のみ** を提供している：
  - `GET /collection` … ログイン中ユーザーのコレクション
  - `GET /market` … マーケット相場（全ユーザー共通）
  - `GET /catalogs` … カタログ書誌マスタ（全ユーザー共通）
- **編集系（作成・更新・削除）の API はまだ存在しない。**
- 本レポジトリの目的は、**マーケット相場データ（MarketRecord）と
  カタログ書誌マスタ（Catalog）を編集する管理用 Web ツール** を作ること。
- API が未整備のため、**当面はモックデータ + localStorage で完結** させる。
  将来 Lambda 側に編集系 API が生えたら、データアクセス層だけを差し替えて接続する。

### この編集ツールが扱わないもの
- コレクション（CollectionItem）はユーザー個人資産であり、本ツールの対象外。
- 認証（Cognito ログイン）は当面「機能としては」不要。
  ただし **配信面の保護は最初から必要**（§14-2 参照）。将来 API 接続時に JWT を付与する（§10）。

---

## 2. 成果物

- 静的 Web アプリ 1 本（ビルド成果物を **S3 に配置し CloudFront で配信**）。
  - 既存 Web と同じホスティング方式（S3 + CloudFront、API は Lambda に問い合わせ）に揃える。
  - **ただしバケット・CloudFront ディストリビューションは既存 web とは必ず別にする**（§14-1）。
- 画面：
  1. **カタログ管理**（Catalog の一覧 / 新規作成 / 編集 / 削除）
  2. **マーケット相場管理**（MarketRecord の一覧 / 新規作成 / 編集 / 削除）
- 初期データ（モックシード）を同梱し、編集結果は localStorage に永続化する。

---

## 3. 技術・ホスティング方針（既存 web に統一）

| 項目 | 方針 | 既存 web との対応 |
|------|------|------|
| 配信 | ビルド後の静的ファイルを **S3 に置き CloudFront** で配信 | 同方式。**別バケット・別配信**（§14-1）|
| 言語 | **TypeScript**（backend と統一、型を流用）| 同じ（TS `~6.0`）|
| フレームワーク | **React 19** を推奨（既存 web と揃える）| 既存 web は React 19 |
| ビルド | **`tsc -b && vite build`**（型チェック込み）。出力 `dist/` を S3 へ | 既存 `package.json` と同じ |
| Lint | **ESLint（flat config）** を既存 web から流用 | `eslint.config.js` を写経 |
| CI | **GitHub Actions / Node 22** で S3 sync | 既存 `deploy.yml` を流用 |
| データ源 | 当面 **モック + localStorage**。API 呼び出しは `Repository` 抽象の裏に隠す（§7）| — |
| 画像 | `imageUrl` は **S3 オブジェクトキー（ファイル名のみ）**。表示時に **コード側で** `CloudFront ドメイン + "/images/"` を前置 | `src/presentation/imageSrc.ts` を写経（§10）|
| 環境変数 | **既存 web と同名の `VITE_*`**。`.env.dev` / `.env.prod` を `--mode` で切替 | §14-3 に一覧 |

> 重要：**データアクセスを直に `fetch`/`localStorage` で書かない**。必ず §7 の
> Repository インターフェース越しにアクセスすること。これにより
> 「モック → 実 API」の差し替えが 1 ファイルで済む。
>
> 重要：`vite build` 単体ではなく **`tsc -b && vite build`** にする（既存 web と同じ。型を backend と一致させる方針と整合）。

---

## 4. ディレクトリ構成（例）

```
market-catalog-editor/
  index.html
  src/
    domain/                … 型定義（バックエンドと一致させる。§5）
      Condition.ts
      ConditionFlags.ts
      Catalog.ts
      MarketRecord.ts
    data/                  … データアクセス層（§7）
      CatalogRepository.ts       … interface
      MarketRepository.ts        … interface
      localStorage/
        LocalCatalogRepository.ts
        LocalMarketRepository.ts
      seed/
        catalogs.seed.ts
        markets.seed.ts
    features/
      catalog/             … カタログ一覧・フォーム
      market/              … 相場一覧・フォーム
    lib/
      marketDerive.ts      … price / change の導出（§8）
      imageUrl.ts          … CloudFront + /images/ 前置（既存 web の imageSrc.ts を写経。§10）
    main.tsx
  .env.dev                 … dev 用（コミットしない。§14-3）
  .env.prod                … prod 用（コミットしない。§14-3）
  .env.example             … 変数名の例（コミットする。§14-3）
  .github/workflows/
    deploy.yml             … 既存 web の deploy.yml を流用（バケット名のみ差し替え。§14-4）
  docs/
    README.md
  package.json
  vite.config.ts
```

---

## 5. データモデル（バックエンドと一致させること）

以下の型は **既存バックエンドからの写し**。フィールドの増減・改名は禁止。
（出典：`lambda/src/domain/**` および `docs/openapi.yaml`）

```typescript
// 状態ランク。S=新品・美品 / A=良い / B=並 / C=傷み・難あり
export type Condition = "S" | "A" | "B" | "C";

// 付帯状態フラグ
export interface ConditionFlags {
  firstEd: boolean;  // 初版か
  obi: boolean;      // 帯付きか
  special: boolean;  // 特装・サイン等の特別仕様か
}

// 書誌マスタ 1 件。Collection / MarketRecord が参照する hub。
export interface Catalog {
  id: string;            // カタログ識別子（"cat-001" 形式）
  title: string;         // 作品名
  author: string;        // 著者
  publisher: string;     // 出版社 / レーベル
  volume: string;        // 巻数（"全6巻" "第1巻" 等の自由文字列）
  year: string;          // 発行年（文字列）
  flags: ConditionFlags; // 付帯状態フラグ（初版/帯/特装）
  imageUrl: string;      // S3 オブジェクトキー（ファイル名のみ。空文字可）
}

// マーケット相場レコード 1 件（全ユーザー共通＝グローバル）。
export interface MarketRecord {
  id: string;            // レコード識別子（"mk0" 形式）
  title: string;         // 作品名
  author: string;        // 著者
  publisher: string;     // 出版社 / レーベル
  volume: string;        // 巻数
  seller: string;        // 出品者 / ショップ名
  condition: Condition;  // 状態ランク
  flags: ConditionFlags; // 付帯状態フラグ
  history: number[];     // 直近12ヶ月の価格推移（円）。要素数12・末尾が現在価格
  price: number;         // 現在価格（円）。history の末尾と一致
  change: number;        // 期間変化率 (末尾-先頭)/先頭。0.18 なら +18%
  listedAt: number;      // 新着ソート用の連番（大きいほど新しい）
  imageUrl: string;      // S3 オブジェクトキー（ファイル名のみ。空文字可）
}
```

> 補足：現状の `MarketRecord` は `title/author/publisher/volume` を **自前で保持**
> しており `catalogId` を持たない（バックエンドの現行定義に合わせる）。
> カタログを選んで書誌を prefill する UI 補助を付けるのは可（§9 の任意項目）が、
> **保存する型に `catalogId` を勝手に足さないこと**。

---

## 6. モックデータ（初期シード）

`docs/openapi.yaml` の `examples`（`CatalogList` / `MarketList`）を基に、
**各 8〜12 件程度** のシードを `src/data/seed/*.seed.ts` に用意する。要件：

- Catalog：`id` は `cat-001`, `cat-002`, … の連番。作品はバラけさせる
  （AKIRA / 鬼滅の刃 / ドラゴンボール など既存 example を含めてよい）。
- MarketRecord：`id` は `mk0`, `mk1`, …。`history` は必ず **12 要素**、
  `price` は `history` 末尾、`change` は `(末尾-先頭)/先頭`、
  `listedAt` は連番（新しいほど大）とする（§8 の導出を満たすこと）。
- `imageUrl` は空文字 `""` でよい（画像未配置でも動くこと）。

初回起動時、localStorage が空ならシードを流し込む（§7）。

---

## 7. データアクセス層（差し替え可能にする）

**目的**：モック（localStorage）→ 実 API（Lambda）を **1 実装の交換だけ** で
切り替えられるようにする。画面コードは interface にのみ依存する。

```typescript
// src/data/CatalogRepository.ts
export interface CatalogRepository {
  list(): Promise<Catalog[]>;
  get(id: string): Promise<Catalog | null>;
  create(input: Omit<Catalog, "id">): Promise<Catalog>; // id はリポジトリが採番
  update(id: string, patch: Partial<Omit<Catalog, "id">>): Promise<Catalog>;
  remove(id: string): Promise<void>;
}

// src/data/MarketRepository.ts
export interface MarketRepository {
  list(): Promise<MarketRecord[]>;
  get(id: string): Promise<MarketRecord | null>;
  create(input: Omit<MarketRecord, "id" | "price" | "change">): Promise<MarketRecord>;
  update(id: string, patch: Partial<Omit<MarketRecord, "id">>): Promise<MarketRecord>;
  remove(id: string): Promise<void>;
}
```

### localStorage 実装の要件
- キーは `editor:catalogs` / `editor:markets`（JSON 配列）。
- 起動時に未初期化ならシード（§6）を書き込む。
- `create` は id を採番（Catalog は `cat-XXX`、Market は `mk{n}`）。
- `MarketRepository` の `create`/`update` では、保存前に **price/change を再導出**（§8）。
- 全メソッドは `Promise` を返す（将来の `fetch` 実装と同じシグネチャにするため）。

> すべて非同期 API にしておくこと。将来 `LocalXxxRepository` を
> `HttpXxxRepository`（`fetch` 実装）に差し替えるだけで API 接続へ移行できる。
> `fetch` 実装のベース URL は既存 web と同じ `VITE_API_BASE_URL` を使う（§14-3）。

---

## 8. 相場レコードの導出ルール（必ず実装）

`MarketRecord` は入力の一部を **導出値** として計算する。UI から直接編集させない：

- `price` = `history[history.length - 1]`（history 末尾）
- `change` = `(末尾 - 先頭) / 先頭`（先頭が 0 のときは `0`）
- バリデーション：
  - `history` は **要素数ちょうど 12**、各要素は 0 以上の整数。
  - `history` が 12 要素でなければ保存不可（フォームでエラー表示）。

`src/lib/marketDerive.ts` にまとめ、シード生成・create・update から共用する。

---

## 9. 画面仕様

### 共通
- ナビゲーションで「カタログ」「マーケット」を切替。
- 一覧はテーブル or カード。**検索 / 並べ替えはクライアント側**（既存 API 方針と同じ）。
- 削除は確認ダイアログを挟む。
- 保存・削除後は一覧を再取得して反映。

### 9-1. カタログ管理（Catalog CRUD）
- 一覧：`title / author / publisher / volume / year / flags`、サムネイル（imageUrl）。
- フォーム項目：`title, author, publisher, volume, year, flags(firstEd/obi/special), imageUrl`。
  - `id` は作成時にリポジトリが採番（`cat-XXX`）。編集時は読み取り専用表示。
- バリデーション：`title` 必須。その他は空文字許容（既存仕様に準拠）。

### 9-2. マーケット相場管理（MarketRecord CRUD）
- 一覧：`title / seller / condition / price / change`、価格推移スパークライン（任意）。
  - `change` は符号で色分けすると見やすい（+緑 / −赤）。
- フォーム項目：`title, author, publisher, volume, seller, condition, flags, history(12点), imageUrl`。
  - `price` / `change` は **入力させず導出結果を表示**（§8）。
  - `listedAt` は作成時に自動採番（既存最大 +1）。
- バリデーション：`history` は 12 要素の 0 以上整数（§8）。`title` 必須。
- 任意補助：既存 Catalog を選んで `title/author/publisher/volume/imageUrl` を prefill
  するボタンを付けてよい（保存する型に `catalogId` は足さない）。

---

## 10. 画像・将来の API 連携（既存 web に揃える）

### 画像 URL の解決（既存 web と完全一致させる）
- `imageUrl` は **ファイル名（S3 オブジェクトキー）のみ** を保持。
- 表示は `src/lib/imageUrl.ts` で `CloudFront ドメイン + "/images/" + imageUrl` を組み立てる。
- **既存 web の `src/presentation/imageSrc.ts` をそのまま写経すること。** 具体的には：
  - 環境変数名は **`VITE_IMAGE_BASE_URL`**（※指示書旧版の `VITE_CDN_BASE` は誤り。既存 web に合わせて `VITE_IMAGE_BASE_URL` に統一）。
  - env にはドメインだけを入れ（末尾スラッシュ無し）、**`/images/` の前置はコード側**で行う。
  - 空文字はプレースホルダ、絶対 URL / dataURL はそのまま通す、それ以外はキーとして解決。
  - 未設定でも壊れないこと。
- **画像の配信元 CloudFront は既存 web と同じ `/images/` オリジンを指す**こと。
  admin が編集する `imageUrl` キーは既存 web が表示する画像資産と同一のため、ここがズレると表示が割れる。

参考（既存 web の実装。これを写経する）：

```typescript
const BASE_URL =
  (import.meta.env.VITE_IMAGE_BASE_URL ?? '').replace(/\/+$/, '') + '/images';

const isAbsolute = (s: string): boolean => /^(https?:|data:)/i.test(s);

export const resolveImageSrc = (imageUrl: string | undefined): string => {
  const value = imageUrl?.trim() ?? '';
  if (!value) return '';
  if (isAbsolute(value)) return value;
  return `${BASE_URL}/${value.replace(/^\/+/, '')}`;
};
```

### 将来の API 連携
- 将来 Lambda に編集系 API（想定：`POST/PUT/DELETE /catalogs`, `POST/PUT/DELETE /market`）が
  生えたら、§7 の Repository を `fetch` 実装に差し替える。
  - ベース URL は既存 web と同名の `VITE_API_BASE_URL` を使う。
  - レスポンス型は本ツールの `Catalog` / `MarketRecord` と一致させる。
  - 認証が必要になれば `Authorization: Bearer <JWT>` を付ける（既存 `docs/openapi.yaml` 準拠）。

---

## 11. 制約・非機能

- 既存バックエンドの型・命名・enum（`Condition`, `MarketSource` 等）から逸脱しない。
- 破壊的操作（削除・全消去）はワンクッション置く。
- localStorage が壊れた／古い形式でも、シードで復旧できるフォールバックを持つ。
- 依存は最小限（重量級の状態管理ライブラリは不要）。

---

## 12. 完了条件（Definition of Done）

- [ ] `npm run dev` で起動し、カタログ・マーケット両画面が動作する。
- [ ] Catalog を新規作成・編集・削除でき、リロード後も localStorage で保持される。
- [ ] MarketRecord を新規作成・編集・削除でき、`price`/`change` が §8 どおり導出される。
- [ ] `history` が 12 要素でない入力は保存できずエラー表示される。
- [ ] データアクセスがすべて `CatalogRepository` / `MarketRepository` 越しで、
      画面から直接 localStorage/fetch を触っていない。
- [ ] `tsc -b && vite build` が通り、`dist/` が静的ファイルのみで、S3 に置けば配信できる。
- [ ] 型定義が `docs/openapi.yaml` / バックエンド `domain/**` と一致している。
- [ ] **画像解決が既存 web の `imageSrc.ts` と同一挙動**（env 名 `VITE_IMAGE_BASE_URL`、`/images/` 前置はコード側）。
- [ ] **デプロイ先が既存 web とは別の S3 バケット / CloudFront** で、`--delete` sync が既存サイトに影響しない。

---

## 13. 作業手順（新レポジトリ側 Claude Code への指示）

1. Vite + React + TypeScript でプロジェクト初期化（`market-catalog-editor`）。既存 web の `tsconfig.*` / `eslint.config.js` を流用。
2. §5 の型を `src/domain/` に作成（バックエンドからの写し）。
3. §7 の Repository インターフェースと localStorage 実装、§8 の導出ユーティリティを実装。
4. §6 のシードを用意し、初回起動で localStorage に投入。
5. §9 の 2 画面（Catalog CRUD / Market CRUD）を実装。
6. §10 の imageUrl 組み立て（既存 `imageSrc.ts` を写経）・CDN ベースの環境変数化（`VITE_IMAGE_BASE_URL`）。
7. §14 のインフラ（別バケット・deploy.yml 流用・env 二環境・配信保護）を整える。
8. §12 の DoD を上から順に満たし、`README.md` に起動・ビルド・S3 配置手順を記載。

> 参考にすべき既存ファイル：
> - バックエンド：`docs/openapi.yaml`、`lambda/src/domain/catalog/Catalog.ts`、
>   `lambda/src/domain/market/MarketRecord.ts`、`lambda/src/domain/collection/{Condition,ConditionFlags}.ts`
> - 既存 web（`secondary-comics-web`）：`src/presentation/imageSrc.ts`、`vite.config.ts`、
>   `package.json`、`eslint.config.js`、`.env.example`、`.github/workflows/deploy.yml`

---

## 14. インフラ統一の要件（既存 web レビュー反映・最重要）

> 既存 web（`secondary-comics-web`）のインフラ構成をレビューした結果、
> 旧版の指示書には既存とズレる／事故につながる点があった。以下で潰す。

### 14-1. 【最重要・事故防止】S3 バケット・CloudFront は既存 web と別にする
- 既存 web の `deploy.yml` は `aws s3 sync dist/ s3://<bucket>/ --delete` を使う。
  `--delete` は「ローカル `dist/` に無いオブジェクトを削除」するため、
  **admin を既存 web と同じバケットへ sync すると既存サイトが丸ごと消える**。
- したがって admin は **専用の S3 バケット + 専用の CloudFront ディストリビューション**を用意する。
- もし同一 CloudFront の `/admin/` サブパスに相乗りする構成にする場合は：
  - `vite.config.ts` に **`base: '/admin/'`** を設定する。
  - `--delete` は **プレフィックス限定**（`s3 sync dist/ s3://<bucket>/admin/ --delete`）にし、
    ルートを消さないこと。
  - 原則は「別ディストリビューションでルート配信」を推奨（相乗りは事故リスクが高い）。

### 14-2. 【セキュリティ】配信面を公開しない
- 既存 web は Cognito（aws-amplify）で保護されている。
- admin は「認証機能」は当面不要でも、**編集ツールを公開 CloudFront に素で置かない**。
  localStorage 段階は無害だが、§10 で書込み API に差し替えた瞬間、
  公開 URL の誰でも触れる管理画面になる。
- 最低限、次のいずれかを **配信構築時点で** 決めておく：
  - CloudFront + WAF で IP 制限（社内 IP のみ）
  - Basic 認証（CloudFront Functions / Lambda@Edge）
  - CloudFront 署名付き Cookie/URL
  - 既存 web の Cognito を流用したアクセス制御
- 「後で付ける」だと配信構成をやり直すことになるため、最初に方針を固定する。

### 14-3. 環境変数（既存 web と同名・二環境）
- 既存 web と同じく `.env.dev` / `.env.prod` を用意し、Vite の `--mode` で切り替える。
  `.env.example` のみコミットし、`.env.dev` / `.env.prod` は **コミットしない**（`.gitignore` に既存 web と同じ設定を入れる）。
- CI（GitHub Actions）では `.env` を置かず、**GitHub Environments (dev/prod) の Variables** から同名の `VITE_*` を build ステップに注入する。
- npm scripts も既存 web に合わせる：
  - `"dev": "vite --mode dev"`
  - `"build:dev": "tsc -b && vite build --mode dev"`
  - `"build:prod": "tsc -b && vite build --mode prod"`

#### admin で実際に使う変数（当面 localStorage のため一部は将来用）

本ツールは当面 localStorage で完結するため、**必須は画像配信元だけ**。
残りは将来の API / 認証接続用に、既存 web と同名で予約しておく。

`.env.dev`（開発・検証用。既存 web の dev 値を流用 = 同じ CloudFront/API を指す）：

```bash
# ── admin で今すぐ使う ──────────────────────────────
# 画像配信元（CloudFront ドメイン。末尾スラッシュ無し / "/images/" はコード側で前置）
# 既存 web と同じオリジンを指すこと（画像資産を共有するため）
VITE_IMAGE_BASE_URL=https://d1hcydkbqi86gl.cloudfront.net

# 'true' で実 API に接続、未設定/それ以外は localStorage モック。
# 編集系 API が未実装のため admin は当面 false 固定。
VITE_USE_API=false

# ── 将来 API / 認証接続時に使う（今は予約。既存 web dev の値）────
VITE_AWS_REGION=ap-northeast-1
VITE_API_BASE_URL=https://upu69qvm0e.execute-api.ap-northeast-1.amazonaws.com
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_lvEOCAFnu
VITE_COGNITO_CLIENT_ID=2mpap5bool3cskl6uujogpm2n7
```

`.env.prod`（本番用。バックエンド本番構築後に値を差し替える）：

```bash
# ── admin で今すぐ使う ──────────────────────────────
VITE_IMAGE_BASE_URL=            # TODO: 本番 CloudFront ドメイン（既存 web prod と同じ）
VITE_USE_API=false             # 編集系 API 実装後に true

# ── 将来 API / 認証接続時に使う（今は空・TODO）──────────
VITE_AWS_REGION=ap-northeast-1
VITE_API_BASE_URL=             # TODO: 本番 API Gateway
VITE_COGNITO_USER_POOL_ID=     # TODO
VITE_COGNITO_CLIENT_ID=        # TODO
```

`.env.example`（コミットする。値はダミー）：

```bash
VITE_IMAGE_BASE_URL=https://xxxxxxxxxxxxxx.cloudfront.net
VITE_USE_API=false
VITE_AWS_REGION=ap-northeast-1
VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.ap-northeast-1.amazonaws.com
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

> メモ：これらは **クライアントに埋め込まれる公開値**（Cognito ID 等も秘匿情報ではない）。
> それでも環境ごとに変わるためファイル管理し、コミットはしない、という既存 web の運用に揃える。

### 14-4. CI（deploy.yml）は既存 web を流用
- 既存 web の `.github/workflows/deploy.yml` をコピーし、**バケット名（`AWS_S3_BUCKET`）を admin 用に差し替える**だけにする。
- 構成は既存と同じ：
  - `main` への push → dev バケットへ自動デプロイ。
  - `workflow_dispatch`（手動）→ dev/prod を選んでデプロイ。
  - GitHub Environments (dev/prod) の Variables から `VITE_*` を注入。
  - `concurrency` で dev/prod を別グループにする。
- 必要な GitHub Secrets / Variables（既存 web と同じ運用）：

| 種別 | 名前 | 内容 |
|---|---|---|
| Secret | `AWS_ACCESS_KEY_ID` | デプロイ用 IAM ユーザーのアクセスキー ID |
| Secret | `AWS_SECRET_ACCESS_KEY` | 同シークレット |
| Variable | `AWS_S3_BUCKET` | **admin 専用**バケット名（`s3://` 不要）|
| Variable | `VITE_IMAGE_BASE_URL` 他 `VITE_*` | §14-3 の値 |

- IAM は既存 web と同じく **バケット限定の最小権限**（`ListBucket` / `PutObject` / `DeleteObject` を admin バケットに限定）。

### 14-5. SPA 配信の注意（既存 web と同じ挙動になる点）
- クライアントルーティングを入れる場合、CloudFront で **403/404 → `/index.html`（200）** のエラーレスポンス設定が必要（リポ外の infra 設定）。
- 既存 web の `deploy.yml` は **CloudFront invalidation を行っていない**。admin も同じ挙動になるため、
  デプロイ後にキャッシュが残る可能性を認識しておく（必要なら invalidation ステップを別途足す。既存 web と揃えるなら足さない）。

---

## 付録：既存 web レビューで判明した「旧指示書との差分」まとめ

| # | 旧指示書 | 既存 web の実態 | 本版での対応 |
|---|---|---|---|
| 1 | 画像 env は `VITE_CDN_BASE` | `VITE_IMAGE_BASE_URL` + コード側で `/images/` 前置 | `VITE_IMAGE_BASE_URL` に統一・`imageSrc.ts` 写経（§10）|
| 2 | バケット言及なし | `s3 sync --delete` を使用 | **別バケット・別 CloudFront 必須**（§14-1）|
| 3 | 認証不要とだけ記載 | Cognito で保護 | 配信面の保護方針を先に決める（§14-2）|
| 4 | env は単発・dev/prod 分離なし | `.env.dev`/`.env.prod` + `--mode` + GitHub Environments | 二環境運用に統一（§14-3）|
| 5 | `vite build` のみ | `tsc -b && vite build` | 型チェック込みに統一（§3, §14-3）|
| 6 | フレームワーク不問 | React 19 / TS ~6 / Vite ^8 / eslint flat / Node 22 | 既存 web に揃える（§3）|
