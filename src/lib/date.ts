const JAPAN_TZ = "Asia/Tokyo";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** 日本時間で指定した日時の日付を YYYY-MM-DD で返す */
export const toJstDateString = (date: Date) => {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: JAPAN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
};

/** YYYY-MM-DD が実在する日付かどうか */
export const isValidDateString = (value: string) => {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
};

/** YYYY-MM-DD に日数を足した日付を返す */
export const addDays = (dateString: string, days: number) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

/** 日本時間の日付（YYYY-MM-DD）の開始・終了時刻を ISO 文字列で返す */
export const getJstDateRange = (fromDate: string, toDate = fromDate) => ({
  start: new Date(`${fromDate}T00:00:00+09:00`).toISOString(),
  end: new Date(`${toDate}T23:59:59.999+09:00`).toISOString(),
});

/** 日本時間の「今日」の開始・終了時刻を ISO 文字列で返す */
export const getTodayDateRangeJst = () =>
  getJstDateRange(toJstDateString(new Date()));
