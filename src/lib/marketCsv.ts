import type { Catalog } from "../domain/Catalog";
import type { NewMarketInput } from "../data/MarketRepository";
import { validatePrice, validateSoldAt } from "./marketDerive";

// CSV から成約（MarketSale）を一括作成するための、パース + 検証ロジック（純粋関数）。
// UI・リポジトリに依存しないため単体でテストしやすい。API は成約 1 件ずつの
// POST /market のみなので、ここでは各行を NewMarketInput に落とすところまでを担い、
// 実際の登録ループは呼び出し側（MarketCsvImport）が marketRepository.create で行う。

// 想定するヘッダ列。catalogId / price / soldAt は必須、condition / seller は任意。
// 書誌（title/author/…）は catalogId 参照の Catalog から合成するため CSV には含めない
// （MarketForm と同じ方針。実 API ではサーバが合成し、モックはフォームが埋めた値を保存する）。
const REQUIRED_COLUMNS = ["catalogId", "price", "soldAt"] as const;
const OPTIONAL_COLUMNS = ["condition", "seller"] as const;
const KNOWN_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

export interface CsvValidRow {
  rowNumber: number; // 元 CSV の行番号（ヘッダ = 1、最初のデータ行 = 2）
  input: NewMarketInput;
  catalogTitle: string; // プレビュー表示用（選択 Catalog の title）
}

export interface CsvErrorRow {
  rowNumber: number;
  messages: string[]; // その行の全エラー理由
  raw: string[]; // 生のセル配列（プレビューで原文を見せる）
}

export interface CsvImportResult {
  valid: CsvValidRow[];
  errors: CsvErrorRow[];
  headerError: string | null; // 必須列欠落など、全体を止める致命的エラー
}

// 最小限の RFC4180 風 CSV パーサ。ダブルクォート囲み・"" エスケープ・カンマ・
// CRLF/LF に対応する。先頭 BOM は除去する。空文字なら空配列。
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  if (src === "") return [];

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++; // エスケープされた二重引用符
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      endField();
    } else if (ch === "\n") {
      endRow();
    } else if (ch === "\r") {
      // CRLF の CR は無視（次の \n で行確定）。単独 CR も行末とみなす。
      if (src[i + 1] !== "\n") endRow();
    } else {
      field += ch;
    }
  }
  // 末尾に改行が無い場合の最終行を確定する（field/row に残りがあれば）。
  if (field !== "" || row.length > 0) endRow();

  return rows;
}

// 行が完全に空（全セルが空文字）かどうか。末尾の空行や区切りだけの行を捨てる。
const isBlankRow = (cells: string[]): boolean =>
  cells.every((c) => c.trim() === "");

// パース済みの行配列を検証し、有効行（NewMarketInput）とエラー行に振り分ける。
export function mapRows(
  rows: string[][],
  catalogs: Catalog[],
): CsvImportResult {
  if (rows.length === 0) {
    return { valid: [], errors: [], headerError: "CSV が空です。" };
  }

  // 1 行目 = ヘッダ。前後空白を除去して列名 → 列インデックスの対応を作る。
  const header = rows[0].map((h) => h.trim());
  const index: Record<string, number> = {};
  for (const col of KNOWN_COLUMNS) {
    // 大文字小文字を無視して一致させる。
    const at = header.findIndex(
      (h) => h.toLowerCase() === col.toLowerCase(),
    );
    if (at !== -1) index[col] = at;
  }

  const missing = REQUIRED_COLUMNS.filter((c) => !(c in index));
  if (missing.length > 0) {
    return {
      valid: [],
      errors: [],
      headerError: `必須列がありません: ${missing.join(", ")}（想定ヘッダ: ${KNOWN_COLUMNS.join(", ")}）`,
    };
  }

  const catalogById = new Map(catalogs.map((c) => [c.id, c]));
  const cell = (cells: string[], col: string): string =>
    (cells[index[col]] ?? "").trim();

  const valid: CsvValidRow[] = [];
  const errors: CsvErrorRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (isBlankRow(cells)) continue; // 空行はスキップ
    const rowNumber = i + 1; // 人間可読な行番号（1 始まり、ヘッダ込み）
    const messages: string[] = [];

    const catalogId = cell(cells, "catalogId");
    const priceStr = cell(cells, "price");
    const soldAt = cell(cells, "soldAt");
    const condition = cell(cells, "condition");
    const seller = cell(cells, "seller");

    const catalog = catalogById.get(catalogId);
    if (catalogId === "") {
      messages.push("catalogId が空です。");
    } else if (!catalog) {
      messages.push(`catalogId が存在しません: ${catalogId}`);
    }

    const price = Number(priceStr);
    if (priceStr === "") {
      messages.push("price が空です。");
    } else if (!validatePrice(price)) {
      messages.push(`price は 0 以上の整数で入力してください: ${priceStr}`);
    }

    if (soldAt === "") {
      messages.push("soldAt が空です。");
    } else if (!validateSoldAt(soldAt)) {
      messages.push(`soldAt は実在する日付（YYYY-MM-DD）で入力してください: ${soldAt}`);
    }

    if (messages.length > 0 || !catalog) {
      errors.push({ rowNumber, messages, raw: cells });
      continue;
    }

    // 有効行。書誌 / flags は参照カタログから埋める（MarketForm.handleSubmit と同じ）。
    // condition / seller は自由文字列としてそのまま採用する（GBA 形式は強制しない）。
    valid.push({
      rowNumber,
      catalogTitle: catalog.title,
      input: {
        catalogId: catalog.id,
        condition,
        price,
        soldAt,
        seller,
        title: catalog.title,
        author: catalog.author,
        publisher: catalog.publisher,
        volume: catalog.volume,
        flags: catalog.flags,
        imageUrl: catalog.imageUrl,
      },
    });
  }

  return { valid, errors, headerError: null };
}
