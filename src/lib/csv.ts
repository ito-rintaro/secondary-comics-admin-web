// CSV 一括取込の共通部品（パース + 取込結果の型）。
// marketCsv.ts / catalogCsv.ts の双方から使う。ここには「どのドメインの CSV か」に
// 依存する知識を置かない（列名・検証規則は各 *Csv.ts 側が持つ）。

/** 行の取込に失敗した理由をまとめたもの（プレビューのエラー行）。 */
export interface CsvErrorRow {
  rowNumber: number;
  messages: string[]; // その行の全エラー理由
  raw: string[]; // 生のセル配列（プレビューで原文を見せる）
}

/** 取込プレビューの結果。TValid は機能ごとの有効行型（NewMarketInput / Catalog 等を包む）。 */
export interface CsvImportResult<TValid> {
  valid: TValid[];
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
export const isBlankRow = (cells: string[]): boolean =>
  cells.every((c) => c.trim() === "");

// ヘッダ行から「列名 → 列インデックス」の対応を作る。前後空白と大文字小文字は無視し、
// 既知の列（knownColumns）のうち存在したものだけを載せる（未知の列は無視）。
export function buildHeaderIndex(
  header: string[],
  knownColumns: readonly string[],
): Record<string, number> {
  const trimmed = header.map((h) => h.trim());
  const index: Record<string, number> = {};
  for (const col of knownColumns) {
    const at = trimmed.findIndex(
      (h) => h.toLowerCase() === col.toLowerCase(),
    );
    if (at !== -1) index[col] = at;
  }
  return index;
}

// 列インデックス経由でセルを取り出す（未定義列・欠損セルは空文字）。
export const cellAt = (
  cells: string[],
  index: Record<string, number>,
  col: string,
): string => (cells[index[col]] ?? "").trim();
