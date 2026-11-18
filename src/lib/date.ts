const JAPAN_TZ = "Asia/Tokyo";

/** 日本時間の「今日」の開始・終了時刻を ISO 文字列で返す */
export const getTodayDateRangeJst = () => {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: JAPAN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  const { year, month, day } = parts;
  const start = new Date(`${year}-${month}-${day}T00:00:00+09:00`);
  const end = new Date(`${year}-${month}-${day}T23:59:59.999+09:00`);

  return { start: start.toISOString(), end: end.toISOString() };
};
