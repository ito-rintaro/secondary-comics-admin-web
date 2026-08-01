import type { Catalog } from "../domain/Catalog";
import type { NewMarketInput } from "../data/MarketRepository";
import { validatePrice, validateSoldAt } from "./marketDerive";
import {
  buildHeaderIndex,
  cellAt,
  isBlankRow,
  type CsvErrorRow,
  type CsvImportResult as CsvImportResultOf,
} from "./csv";

// CSV から成約（MarketSale）を一括作成するための、パース + 検証ロジック（純粋関数）。
// UI・リポジトリに依存しないため単体でテストしやすい。API は成約 1 件ずつの
// POST /market のみなので、ここでは各行を NewMarketInput に落とすところまでを担い、
// 実際の登録ループは呼び出し側（MarketCsvImport）が marketRepository.create で行う。
// CSV パーサ・エラー行の型は csv.ts の共通実装（catalogCsv.ts と共有）を使う。

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

export type { CsvErrorRow };
export type CsvImportResult = CsvImportResultOf<CsvValidRow>;

// パース済みの行配列を検証し、有効行（NewMarketInput）とエラー行に振り分ける。
export function mapRows(
  rows: string[][],
  catalogs: Catalog[],
): CsvImportResult {
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

  const catalogById = new Map(catalogs.map((c) => [c.id, c]));
  const cell = (cells: string[], col: string): string =>
    cellAt(cells, index, col);

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
