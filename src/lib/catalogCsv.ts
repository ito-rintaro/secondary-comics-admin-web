import type { Catalog } from "../domain/Catalog";
import {
  buildHeaderIndex,
  cellAt,
  isBlankRow,
  type CsvErrorRow,
  type CsvImportResult,
} from "./csv";

// CSV からカタログ（書誌マスタ）を一括作成するための、パース + 検証ロジック（純粋関数）。
// UI・リポジトリに依存しない。API は 1 件ずつの POST /catalogs のみなので、ここでは各行を
// NewCatalogInput（= Omit<Catalog, "id">。id はサーバ / リポジトリが採番）に落とすところまでを
// 担い、実際の登録ループは呼び出し側（CatalogCsvImport）が catalogRepository.create で行う
// （marketCsv.ts と同方針）。

// 想定するヘッダ列。title のみ必須（NewCatalogInput と同じ。他はサーバ側で既定値補完）。
// imageUrl は列に持たない: 画像はアップロード専用（設計メモ §7.1 で CatalogForm から
// キー手入力欄を撤去済み）で、キーの実在検証もできないため。取込直後は空文字にし、
// 画像は後から編集画面で付ける。
const REQUIRED_COLUMNS = ["title"] as const;
const OPTIONAL_COLUMNS = [
  "author",
  "publisher",
  "volume",
  "year",
  "firstEd",
  "obi",
  "special",
] as const;
const KNOWN_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const FLAG_COLUMNS = ["firstEd", "obi", "special"] as const;

export interface CatalogCsvValidRow {
  rowNumber: number; // 元 CSV の行番号（ヘッダ = 1、最初のデータ行 = 2）
  input: Omit<Catalog, "id">; // catalogRepository.create に渡す形
  warnings: string[]; // 登録は妨げないが人の目で確認したい事柄（重複の可能性など）
}

export type CatalogCsvImportResult = CsvImportResult<CatalogCsvValidRow>;

// 真偽値セルの受理表記。表記ゆれ（全角・大文字小文字）を吸収して比較する。
const TRUE_TOKENS = ["true", "1", "yes", "y", "o", "○", "◯", "はい"];
const FALSE_TOKENS = ["false", "0", "no", "n", "x", "×", "-", "いいえ"];

// 表記ゆれを潰した比較用キー（全角/半角・大文字小文字・前後空白を無視）。
const normalize = (s: string): string =>
  s.normalize("NFKC").trim().toLowerCase();

// 真偽値セルを解釈する。空欄は false（フラグ無し）。解釈できなければ null。
export function parseBool(raw: string): boolean | null {
  const v = normalize(raw);
  if (v === "") return false;
  if (TRUE_TOKENS.includes(v)) return true;
  if (FALSE_TOKENS.includes(v)) return false;
  return null;
}

// 重複判定のキー。カタログにはサーバ採番の id しか一意キーが無いため、
// 書誌の組み合わせ（title + author + volume）で「同じ本らしさ」を見る。
const duplicateKey = (
  c: Pick<Catalog, "title" | "author" | "volume">,
): string => [c.title, c.author, c.volume].map(normalize).join("|");

// パース済みの行配列を検証し、有効行（CatalogFormValues）とエラー行に振り分ける。
// existing は重複警告のための既存カタログ一覧（判定のみに使い、登録は妨げない）。
export function mapRows(
  rows: string[][],
  existing: Catalog[],
): CatalogCsvImportResult {
  if (rows.length === 0) {
    return { valid: [], errors: [], headerError: "CSV が空です。" };
  }

  // 1 行目 = ヘッダ。列名 → 列インデックスの対応を作る（大文字小文字は無視）。
  const index = buildHeaderIndex(rows[0], KNOWN_COLUMNS);

  const missing = REQUIRED_COLUMNS.filter((c) => !(c in index));
  if (missing.length > 0) {
    return {
      valid: [],
      errors: [],
      headerError: `必須列がありません: ${missing.join(", ")}（想定ヘッダ: ${KNOWN_COLUMNS.join(", ")}）`,
    };
  }

  // 既存カタログの重複キー → id。同じキーが複数あれば最初の 1 件を代表にする。
  const existingByKey = new Map<string, string>();
  for (const c of existing) {
    const key = duplicateKey(c);
    if (!existingByKey.has(key)) existingByKey.set(key, c.id);
  }
  // CSV 内で先に現れた行の重複キー → 行番号。
  const seenInCsv = new Map<string, number>();

  const cell = (cells: string[], col: string): string =>
    cellAt(cells, index, col);

  const valid: CatalogCsvValidRow[] = [];
  const errors: CsvErrorRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (isBlankRow(cells)) continue; // 空行はスキップ
    const rowNumber = i + 1; // 人間可読な行番号（1 始まり、ヘッダ込み）
    const messages: string[] = [];
    const warnings: string[] = [];

    const title = cell(cells, "title");
    const author = cell(cells, "author");
    const publisher = cell(cells, "publisher");
    const volume = cell(cells, "volume");
    const year = cell(cells, "year");

    if (title === "") messages.push("title が空です。");

    // flags は 3 列それぞれを真偽値として解釈する。解釈できない値はエラーにして、
    // 誤った値が黙って false に落ちないようにする。
    const flags = { firstEd: false, obi: false, special: false };
    for (const col of FLAG_COLUMNS) {
      const rawFlag = cell(cells, col);
      const parsed = parseBool(rawFlag);
      if (parsed === null) {
        messages.push(
          `${col} は true / false（1 / 0・yes / no・○ / × も可）で入力してください: ${rawFlag}`,
        );
        continue;
      }
      flags[col] = parsed;
    }

    if (messages.length > 0) {
      errors.push({ rowNumber, messages, raw: cells });
      continue;
    }

    // 以降は警告（登録はブロックしない）。
    // year は Catalog 上は自由文字列だが、西暦 4 桁でなければ列ずれの可能性があるため知らせる。
    if (year !== "" && !/\d{4}/.test(year)) {
      warnings.push(`year が西暦 4 桁を含みません: ${year}`);
    }

    const key = duplicateKey({ title, author, volume });
    const existingId = existingByKey.get(key);
    if (existingId) {
      warnings.push(`既存カタログと重複の可能性: ${existingId}`);
    }
    const seenAt = seenInCsv.get(key);
    if (seenAt) {
      warnings.push(`CSV 内の行 ${seenAt} と重複の可能性`);
    } else {
      seenInCsv.set(key, rowNumber);
    }

    valid.push({
      rowNumber,
      warnings,
      input: {
        title,
        author,
        publisher,
        volume,
        year,
        flags,
        imageUrl: "", // CSV では扱わない（取込後に編集画面からアップロードする）
      },
    });
  }

  return { valid, errors, headerError: null };
}
