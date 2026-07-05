import type { MarketRecord } from "../../domain/MarketRecord";
import { deriveMarketValues } from "../../lib/marketDerive";

// マーケット相場レコードの初期シード（指示書 §6）。
// openapi.yaml の MarketList example を含む。id は mk0 からの連番、listedAt も連番。
// price / change は §8 の導出関数で確定させる（手計算のズレを防ぐため deriveMarketValues を通す）。
type MarketSeedInput = Omit<MarketRecord, "price" | "change">;

const rawMarketSeed: MarketSeedInput[] = [
  {
    id: "mk0",
    title: "AKIRA 全6巻 初版帯付 美品セット",
    author: "大友克洋",
    publisher: "講談社",
    volume: "全6巻",
    seller: "コレクター田中",
    condition: "A",
    flags: { firstEd: true, obi: true, special: false },
    history: [
      30000, 30500, 31000, 31800, 32500, 33000, 33600, 34200, 34800, 35100,
      35400, 35400,
    ],
    listedAt: 0,
    imageUrl: "619333a5ab646_991428d170c6d9fab761e61feeffbd6b.jpg",
  },
  {
    id: "mk1",
    title: "幽☆遊☆白書 直筆サイン入り 第1巻",
    author: "冨樫義博",
    publisher: "集英社",
    volume: "第1巻",
    seller: "mangavault",
    condition: "A",
    flags: { firstEd: true, obi: true, special: true },
    history: [
      52000, 53500, 55000, 57000, 59000, 60500, 62000, 63500, 65000, 66500,
      67500, 67600,
    ],
    listedAt: 1,
    imageUrl: "",
  },
  {
    id: "mk2",
    title: "鬼滅の刃 第1巻 初版帯付",
    author: "吾峠呼世晴",
    publisher: "集英社",
    volume: "第1巻",
    seller: "駿河屋",
    condition: "S",
    flags: { firstEd: true, obi: true, special: false },
    history: [
      12000, 12500, 13000, 12800, 13200, 13500, 14000, 14200, 14500, 14800,
      15000, 15200,
    ],
    listedAt: 2,
    imageUrl: "",
  },
  {
    id: "mk3",
    title: "ドラゴンボール 完全版 全34巻セット",
    author: "鳥山明",
    publisher: "集英社",
    volume: "全34巻",
    seller: "まんだらけ",
    condition: "B",
    flags: { firstEd: false, obi: false, special: false },
    history: [
      42000, 41500, 41000, 40800, 40500, 40000, 39800, 39500, 39000, 38800,
      38500, 38200,
    ],
    listedAt: 3,
    imageUrl: "",
  },
  {
    id: "mk4",
    title: "寄生獣 完全版 全8巻",
    author: "岩明均",
    publisher: "講談社",
    volume: "全8巻",
    seller: "ブックオフ",
    condition: "A",
    flags: { firstEd: false, obi: true, special: false },
    history: [
      6000, 6100, 6050, 6200, 6300, 6250, 6400, 6500, 6450, 6600, 6700, 6800,
    ],
    listedAt: 4,
    imageUrl: "",
  },
  {
    id: "mk5",
    title: "ベルセルク 第1巻 初版",
    author: "三浦建太郎",
    publisher: "白泉社",
    volume: "第1巻",
    seller: "ヤフオク",
    condition: "B",
    flags: { firstEd: true, obi: false, special: false },
    history: [
      8000, 8200, 8500, 8800, 9000, 9200, 9500, 9800, 10000, 10200, 10500,
      11000,
    ],
    listedAt: 5,
    imageUrl: "",
  },
  {
    id: "mk6",
    title: "スラムダンク 新装再編版 全20巻",
    author: "井上雄彦",
    publisher: "集英社",
    volume: "全20巻",
    seller: "メルカリ",
    condition: "S",
    flags: { firstEd: false, obi: true, special: false },
    history: [
      13000, 13000, 12800, 13100, 13300, 13500, 13400, 13600, 13800, 13700,
      13900, 14000,
    ],
    listedAt: 6,
    imageUrl: "",
  },
  {
    id: "mk7",
    title: "ジョジョの奇妙な冒険 第1部 全5巻",
    author: "荒木飛呂彦",
    publisher: "集英社",
    volume: "全5巻",
    seller: "コレクター佐藤",
    condition: "C",
    flags: { firstEd: false, obi: false, special: false },
    history: [
      5000, 4900, 4950, 4800, 4850, 4700, 4750, 4600, 4650, 4500, 4550, 4400,
    ],
    listedAt: 7,
    imageUrl: "",
  },
  {
    id: "mk8",
    title: "銀河鉄道999 愛蔵版 特装セット",
    author: "松本零士",
    publisher: "少年画報社",
    volume: "全12巻",
    seller: "レトロ書房",
    condition: "A",
    flags: { firstEd: false, obi: true, special: true },
    history: [
      22000, 22500, 23000, 23200, 23800, 24000, 24500, 25000, 25200, 25800,
      26000, 26500,
    ],
    listedAt: 8,
    imageUrl: "",
  },
];

// price / change を §8 の導出で確定させたシード。
export const marketSeed: MarketRecord[] = rawMarketSeed.map(deriveMarketValues);
