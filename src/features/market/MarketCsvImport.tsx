import { useRef, useState } from "react";
import type { Catalog } from "../../domain/Catalog";
import { marketRepository } from "../../config/container";
import { parseCsv, mapRows, type CsvImportResult } from "../../lib/marketCsv";
import { formatYen } from "../../lib/format";
import { errorMessage } from "../../lib/errorMessage";
import { Thumbnail } from "../common/Thumbnail";

// CSV から成約を一括作成するビュー（プレビュー確認後に登録）。
// 1) ファイル選択 → parseCsv → mapRows で有効行 / エラー行に振り分けてプレビュー。
// 2) 「登録」で有効行を逐次 marketRepository.create（API は 1 件ずつの POST /market のみ）。
//    1 行の失敗でも続行し、成功 / 失敗件数を最後にまとめて表示する。
// 書誌は mapRows が選択 Catalog から埋めた NewMarketInput をそのまま送る（MarketForm と同方針）。

type SubmitState =
  | { kind: "idle" }
  | { kind: "running"; done: number; total: number }
  | { kind: "finished"; success: number; failures: { rowNumber: number; message: string }[] };

export function MarketCsvImport({
  catalogs,
  onDone,
  onCancel,
}: {
  catalogs: Catalog[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [result, setResult] = useState<CsvImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submit, setSubmit] = useState<SubmitState>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setSubmit({ kind: "idle" });
    setParseError(null);
    setFileName(file.name);
    try {
      const text = await file.text();
      setResult(mapRows(parseCsv(text), catalogs));
    } catch (e) {
      setResult(null);
      setParseError(errorMessage(e));
    }
  };

  const handleRegister = async () => {
    if (!result || result.valid.length === 0) return;
    const total = result.valid.length;
    const failures: { rowNumber: number; message: string }[] = [];
    setSubmit({ kind: "running", done: 0, total });
    for (let i = 0; i < result.valid.length; i++) {
      const row = result.valid[i];
      try {
        await marketRepository.create(row.input);
      } catch (e) {
        failures.push({ rowNumber: row.rowNumber, message: errorMessage(e) });
      }
      setSubmit({ kind: "running", done: i + 1, total });
    }
    setSubmit({ kind: "finished", success: total - failures.length, failures });
  };

  const running = submit.kind === "running";
  const finished = submit.kind === "finished";

  return (
    <section className="form">
      <h2 className="form__title">CSV から成約を一括作成</h2>

      <p className="field__hint muted">
        ヘッダ行に <code>catalogId, price, soldAt, condition, seller</code>{" "}
        を含む CSV を選択してください（catalogId / price / soldAt は必須、condition /
        seller は任意）。書誌は catalogId が参照する既存カタログから設定されます。
      </p>

      <div className="field">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          disabled={running}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
        {fileName && <span className="muted">選択中: {fileName}</span>}
      </div>

      {parseError && <p className="form__error">{parseError}</p>}

      {result?.headerError && (
        <p className="form__error">{result.headerError}</p>
      )}

      {result && !result.headerError && (
        <>
          {/* 有効行プレビュー */}
          <h3 className="form__title">
            登録対象 <span className="badge">{result.valid.length} 件</span>
          </h3>
          {result.valid.length === 0 ? (
            <p className="muted">登録できる有効な行がありません。</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th></th>
                    <th>行</th>
                    <th>title</th>
                    <th>catalogId</th>
                    <th className="num">price</th>
                    <th>soldAt</th>
                    <th>condition</th>
                    <th>seller</th>
                  </tr>
                </thead>
                <tbody>
                  {result.valid.map((r) => (
                    <tr key={r.rowNumber}>
                      <td>
                        <Thumbnail
                          imageUrl={r.input.imageUrl}
                          alt={r.catalogTitle}
                        />
                      </td>
                      <td className="mono">{r.rowNumber}</td>
                      <td>{r.catalogTitle}</td>
                      <td className="mono">{r.input.catalogId}</td>
                      <td className="num">{formatYen(r.input.price)}</td>
                      <td className="mono">{r.input.soldAt}</td>
                      <td>
                        {r.input.condition ? (
                          <span className="badge">{r.input.condition}</span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>{r.input.seller || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* エラー行プレビュー */}
          {result.errors.length > 0 && (
            <>
              <h3 className="form__title">
                取り込めない行{" "}
                <span className="badge">{result.errors.length} 件</span>
              </h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>行</th>
                      <th>理由</th>
                      <th>原文</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((r) => (
                      <tr key={r.rowNumber}>
                        <td className="mono">{r.rowNumber}</td>
                        <td>
                          {r.messages.map((m, i) => (
                            <div key={i} className="neg">
                              {m}
                            </div>
                          ))}
                        </td>
                        <td className="mono">{r.raw.join(" , ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}

      {/* 登録結果サマリ */}
      {finished && (
        <div className="field">
          <p>
            登録完了: 成功 {submit.success} 件
            {submit.failures.length > 0 && ` / 失敗 ${submit.failures.length} 件`}
          </p>
          {submit.failures.length > 0 && (
            <ul>
              {submit.failures.map((f) => (
                <li key={f.rowNumber} className="neg">
                  行 {f.rowNumber}: {f.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="form__actions">
        {finished ? (
          <button type="button" className="btn btn--primary" onClick={onDone}>
            一覧へ戻る
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn"
              onClick={onCancel}
              disabled={running}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleRegister}
              disabled={
                running ||
                !result ||
                !!result.headerError ||
                result.valid.length === 0
              }
            >
              {running
                ? `登録中… ${submit.done}/${submit.total}`
                : `${result?.valid.length ?? 0} 件を登録`}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
