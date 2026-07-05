// localStorage を JSON 配列として読み書きする薄いヘルパ。
// 破損／古い形式でも例外を投げず、フォールバック（シード）で復旧できるようにする（指示書 §11）。

/**
 * key の内容を配列として読む。未初期化なら seed を書き込んで返す。
 * JSON が壊れている／配列でない場合も seed で自己修復する。
 */
export const readOrSeed = <T>(key: string, seed: readonly T[]): T[] => {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    writeArray(key, seed);
    return [...seed];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      // 古い形式・想定外の構造 → シードで復旧
      writeArray(key, seed);
      return [...seed];
    }
    return parsed as T[];
  } catch {
    // 壊れた JSON → シードで復旧
    writeArray(key, seed);
    return [...seed];
  }
};

/** 配列を key に保存する。 */
export const writeArray = <T>(key: string, value: readonly T[]): void => {
  localStorage.setItem(key, JSON.stringify(value));
};
