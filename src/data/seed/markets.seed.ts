import type { MarketSale } from "../../domain/MarketSale";

// マーケット成約ログの初期シード（指示書 §5）。
// 「1 レコード＝1 価格」の成約イベント列。catalogId は catalogs.seed.ts の id を参照する。
// 相場サマリ（price/change/history）はこの成約ログを deriveSummaries で畳み込んで導出する
// ため、ここには置かない。同一 catalog に複数成約を積み上げることで相場が形成される。
// soldAt は直近 12 ヶ月に散らしてあり、月次バケットに畳むと滑らかな系列になる。
// 書誌（title/author/publisher/volume/flags/imageUrl）は各 Catalog 由来の値を複製している。
// 成約 0 件の catalog（cat-002 / cat-007 / cat-009 / cat-010）は summary に現れない。
const akiraFlags = { firstEd: true, obi: true, special: false };
const kimetsuFlags = { firstEd: true, obi: true, special: false };
const dbFlags = { firstEd: false, obi: false, special: false };
const yyhFlags = { firstEd: true, obi: true, special: true };
const kiseijuFlags = { firstEd: false, obi: true, special: false };
const berserkFlags = { firstEd: true, obi: false, special: false };

export const marketSeed: MarketSale[] = [
  // ── cat-001 AKIRA：右肩上がり（30,000 → 35,400 円）──
  { id: "mk0", catalogId: "cat-001", title: "AKIRA 全6巻 初版帯付 美品セット", author: "大友克洋", publisher: "講談社", volume: "全6巻", flags: akiraFlags, imageUrl: "619333a5ab646_991428d170c6d9fab761e61feeffbd6b.jpg", condition: "A", price: 30000, soldAt: "2025-08-10", seller: "コレクター田中" },
  { id: "mk1", catalogId: "cat-001", title: "AKIRA 全6巻 初版帯付 美品セット", author: "大友克洋", publisher: "講談社", volume: "全6巻", flags: akiraFlags, imageUrl: "619333a5ab646_991428d170c6d9fab761e61feeffbd6b.jpg", condition: "A", price: 31000, soldAt: "2025-10-05", seller: "まんだらけ" },
  { id: "mk2", catalogId: "cat-001", title: "AKIRA 全6巻 初版帯付 美品セット", author: "大友克洋", publisher: "講談社", volume: "全6巻", flags: akiraFlags, imageUrl: "619333a5ab646_991428d170c6d9fab761e61feeffbd6b.jpg", condition: "A", price: 32500, soldAt: "2025-12-20", seller: "駿河屋" },
  { id: "mk3", catalogId: "cat-001", title: "AKIRA 全6巻 初版帯付 美品セット", author: "大友克洋", publisher: "講談社", volume: "全6巻", flags: akiraFlags, imageUrl: "619333a5ab646_991428d170c6d9fab761e61feeffbd6b.jpg", condition: "B", price: 33600, soldAt: "2026-02-14", seller: "ヤフオク" },
  { id: "mk4", catalogId: "cat-001", title: "AKIRA 全6巻 初版帯付 美品セット", author: "大友克洋", publisher: "講談社", volume: "全6巻", flags: akiraFlags, imageUrl: "619333a5ab646_991428d170c6d9fab761e61feeffbd6b.jpg", condition: "A", price: 34800, soldAt: "2026-04-18", seller: "コレクター佐藤" },
  { id: "mk5", catalogId: "cat-001", title: "AKIRA 全6巻 初版帯付 美品セット", author: "大友克洋", publisher: "講談社", volume: "全6巻", flags: akiraFlags, imageUrl: "619333a5ab646_991428d170c6d9fab761e61feeffbd6b.jpg", condition: "A", price: 35400, soldAt: "2026-07-05", seller: "コレクター田中" },

  // ── cat-005 幽☆遊☆白書 直筆サイン：急騰（52,000 → 67,600 円）──
  { id: "mk6", catalogId: "cat-005", title: "幽☆遊☆白書 直筆サイン入り 第1巻", author: "冨樫義博", publisher: "集英社", volume: "第1巻", flags: yyhFlags, imageUrl: "", condition: "A", price: 52000, soldAt: "2025-09-12", seller: "mangavault" },
  { id: "mk7", catalogId: "cat-005", title: "幽☆遊☆白書 直筆サイン入り 第1巻", author: "冨樫義博", publisher: "集英社", volume: "第1巻", flags: yyhFlags, imageUrl: "", condition: "A", price: 62000, soldAt: "2026-03-15", seller: "レア本堂" },
  { id: "mk8", catalogId: "cat-005", title: "幽☆遊☆白書 直筆サイン入り 第1巻", author: "冨樫義博", publisher: "集英社", volume: "第1巻", flags: yyhFlags, imageUrl: "", condition: "A", price: 67600, soldAt: "2026-06-20", seller: "mangavault" },

  // ── cat-003 鬼滅の刃 第1巻 初版：緩やかに上昇（12,000 → 15,200 円）──
  { id: "mk9", catalogId: "cat-003", title: "鬼滅の刃 第1巻 初版帯付", author: "吾峠呼世晴", publisher: "集英社", volume: "第1巻", flags: kimetsuFlags, imageUrl: "", condition: "S", price: 12000, soldAt: "2025-09-01", seller: "駿河屋" },
  { id: "mk10", catalogId: "cat-003", title: "鬼滅の刃 第1巻 初版帯付", author: "吾峠呼世晴", publisher: "集英社", volume: "第1巻", flags: kimetsuFlags, imageUrl: "", condition: "A", price: 13500, soldAt: "2026-01-10", seller: "メルカリ" },
  { id: "mk11", catalogId: "cat-003", title: "鬼滅の刃 第1巻 初版帯付", author: "吾峠呼世晴", publisher: "集英社", volume: "第1巻", flags: kimetsuFlags, imageUrl: "", condition: "S", price: 14800, soldAt: "2026-05-22", seller: "ブックオフ" },
  { id: "mk12", catalogId: "cat-003", title: "鬼滅の刃 第1巻 初版帯付", author: "吾峠呼世晴", publisher: "集英社", volume: "第1巻", flags: kimetsuFlags, imageUrl: "", condition: "S", price: 15200, soldAt: "2026-07-01", seller: "駿河屋" },

  // ── cat-004 ドラゴンボール 完全版：下落（42,000 → 38,200 円）──
  { id: "mk13", catalogId: "cat-004", title: "ドラゴンボール 完全版 全34巻セット", author: "鳥山明", publisher: "集英社", volume: "全34巻", flags: dbFlags, imageUrl: "", condition: "B", price: 42000, soldAt: "2025-08-25", seller: "まんだらけ" },
  { id: "mk14", catalogId: "cat-004", title: "ドラゴンボール 完全版 全34巻セット", author: "鳥山明", publisher: "集英社", volume: "全34巻", flags: dbFlags, imageUrl: "", condition: "B", price: 40500, soldAt: "2025-12-05", seller: "ヤフオク" },
  { id: "mk15", catalogId: "cat-004", title: "ドラゴンボール 完全版 全34巻セット", author: "鳥山明", publisher: "集英社", volume: "全34巻", flags: dbFlags, imageUrl: "", condition: "C", price: 39000, soldAt: "2026-03-30", seller: "ブックオフ" },
  { id: "mk16", catalogId: "cat-004", title: "ドラゴンボール 完全版 全34巻セット", author: "鳥山明", publisher: "集英社", volume: "全34巻", flags: dbFlags, imageUrl: "", condition: "B", price: 38200, soldAt: "2026-06-28", seller: "駿河屋" },

  // ── cat-006 寄生獣 完全版：微増（6,000 → 6,800 円）──
  { id: "mk17", catalogId: "cat-006", title: "寄生獣 完全版 全8巻", author: "岩明均", publisher: "講談社", volume: "全8巻", flags: kiseijuFlags, imageUrl: "", condition: "A", price: 6000, soldAt: "2025-10-12", seller: "ブックオフ" },
  { id: "mk18", catalogId: "cat-006", title: "寄生獣 完全版 全8巻", author: "岩明均", publisher: "講談社", volume: "全8巻", flags: kiseijuFlags, imageUrl: "", condition: "A", price: 6300, soldAt: "2026-02-08", seller: "メルカリ" },
  { id: "mk19", catalogId: "cat-006", title: "寄生獣 完全版 全8巻", author: "岩明均", publisher: "講談社", volume: "全8巻", flags: kiseijuFlags, imageUrl: "", condition: "A", price: 6800, soldAt: "2026-06-15", seller: "駿河屋" },

  // ── cat-008 ベルセルク 第1巻 初版：上昇（8,000 → 11,000 円）──
  { id: "mk20", catalogId: "cat-008", title: "ベルセルク 第1巻 初版", author: "三浦建太郎", publisher: "白泉社 / ヤングアニマル", volume: "第1巻", flags: berserkFlags, imageUrl: "", condition: "B", price: 8000, soldAt: "2025-09-18", seller: "ヤフオク" },
  { id: "mk21", catalogId: "cat-008", title: "ベルセルク 第1巻 初版", author: "三浦建太郎", publisher: "白泉社 / ヤングアニマル", volume: "第1巻", flags: berserkFlags, imageUrl: "", condition: "B", price: 9200, soldAt: "2026-01-25", seller: "まんだらけ" },
  { id: "mk22", catalogId: "cat-008", title: "ベルセルク 第1巻 初版", author: "三浦建太郎", publisher: "白泉社 / ヤングアニマル", volume: "第1巻", flags: berserkFlags, imageUrl: "", condition: "A", price: 10500, soldAt: "2026-05-10", seller: "コレクター佐藤" },
  { id: "mk23", catalogId: "cat-008", title: "ベルセルク 第1巻 初版", author: "三浦建太郎", publisher: "白泉社 / ヤングアニマル", volume: "第1巻", flags: berserkFlags, imageUrl: "", condition: "B", price: 11000, soldAt: "2026-07-03", seller: "ヤフオク" },
];
