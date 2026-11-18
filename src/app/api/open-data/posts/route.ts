import { NextResponse } from "next/server";

import {
  isValidSmellType,
  SMELL_TYPE_LABELS,
  type SmellType,
} from "@/constants/smell";
import {
  addDays,
  getJstDateRange,
  isValidDateString,
  toJstDateString,
} from "@/lib/date";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "https://yamasekun.jp";

const LICENSE = {
  name: "CC BY 4.0",
  url: "https://creativecommons.org/licenses/by/4.0/deed.ja",
};
const ATTRIBUTION = `ヤマセ君の知らせ（${SITE_URL}）`;

const DEFAULT_RANGE_DAYS = 7;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 1000;
const MIN_INTENSITY = 0;
const MAX_INTENSITY = 3;
const MAX_MUNICIPALITY_LENGTH = 50;
// 小数第 3 位（約 100m）に丸めて、投稿者の位置を特定しにくくする
const COORDINATE_PRECISION = 1000;

// user_id と自由記述（description / content）は公開しない。
// address は municipality + district をつなげただけなので省く
const PUBLIC_COLUMNS = [
  "id",
  "inserted_at",
  "intensity",
  "smell_type",
  "emoji",
  "latitude",
  "longitude",
  "municipality",
  "district",
  "weather",
  "temperature",
  "wind",
  "wind_direction",
  "pressure",
  "normal_pressure",
].join(", ");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

type PostRow = {
  id: string;
  inserted_at: string;
  intensity: number | null;
  smell_type: string | null;
  emoji: string | null;
  latitude: number | null;
  longitude: number | null;
  municipality: string | null;
  district: string | null;
  weather: string | null;
  temperature: number | null;
  wind: number | null;
  wind_direction: number | null;
  pressure: number | null;
  normal_pressure: number | null;
};

type OpenDataQuery = {
  from: string;
  to: string;
  municipality: string | null;
  smellTypes: SmellType[] | null;
  minIntensity: number | null;
  maxIntensity: number | null;
  order: "asc" | "desc";
  limit: number;
  offset: number;
};

type ParseResult =
  | { ok: true; query: OpenDataQuery }
  | { ok: false; message: string };

const parseInteger = (value: string | null) => {
  if (value === null || value.trim() === "") {
    return null;
  }
  return /^-?\d+$/.test(value.trim()) ? Number(value) : Number.NaN;
};

function parseQuery(params: URLSearchParams): ParseResult {
  const today = toJstDateString(new Date());
  const to = params.get("to")?.trim() || today;
  const from = params.get("from")?.trim() || addDays(to, -(DEFAULT_RANGE_DAYS - 1));

  if (!isValidDateString(from) || !isValidDateString(to)) {
    return {
      ok: false,
      message: "from と to は YYYY-MM-DD 形式の日付で指定してください。",
    };
  }
  if (from > to) {
    return { ok: false, message: "from は to 以前の日付にしてください。" };
  }

  const municipality = params.get("municipality")?.trim() || null;
  if (municipality && municipality.length > MAX_MUNICIPALITY_LENGTH) {
    return {
      ok: false,
      message: `municipality は ${MAX_MUNICIPALITY_LENGTH} 文字以内で指定してください。`,
    };
  }

  const rawSmellTypes = params.get("smell_type")?.trim();
  let smellTypes: SmellType[] | null = null;
  if (rawSmellTypes) {
    const values = rawSmellTypes.split(",").map((value) => value.trim());
    const invalid = values.filter((value) => !isValidSmellType(value));
    if (invalid.length > 0) {
      return {
        ok: false,
        message: `smell_type に不正な値があります: ${invalid.join(", ")}`,
      };
    }
    smellTypes = values as SmellType[];
  }

  const minIntensity = parseInteger(params.get("min_intensity"));
  const maxIntensity = parseInteger(params.get("max_intensity"));
  for (const [name, value] of [
    ["min_intensity", minIntensity],
    ["max_intensity", maxIntensity],
  ] as const) {
    if (
      value !== null &&
      (!Number.isInteger(value) || value < MIN_INTENSITY || value > MAX_INTENSITY)
    ) {
      return {
        ok: false,
        message: `${name} は ${MIN_INTENSITY}〜${MAX_INTENSITY} の整数で指定してください。`,
      };
    }
  }
  if (minIntensity !== null && maxIntensity !== null && minIntensity > maxIntensity) {
    return {
      ok: false,
      message: "min_intensity は max_intensity 以下にしてください。",
    };
  }

  const order = params.get("order")?.trim() || "desc";
  if (order !== "asc" && order !== "desc") {
    return { ok: false, message: "order は asc か desc で指定してください。" };
  }

  const limit = parseInteger(params.get("limit")) ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return {
      ok: false,
      message: `limit は 1〜${MAX_LIMIT} の整数で指定してください。`,
    };
  }

  const offset = parseInteger(params.get("offset")) ?? 0;
  if (!Number.isInteger(offset) || offset < 0) {
    return { ok: false, message: "offset は 0 以上の整数で指定してください。" };
  }

  return {
    ok: true,
    query: {
      from,
      to,
      municipality,
      smellTypes,
      minIntensity,
      maxIntensity,
      order,
      limit,
      offset,
    },
  };
}

const roundCoordinate = (value: number | null) =>
  value === null
    ? null
    : Math.round(value * COORDINATE_PRECISION) / COORDINATE_PRECISION;

const toPublicRecord = (row: PostRow) => ({
  id: row.id,
  posted_at: row.inserted_at,
  intensity: row.intensity,
  smell_type: row.smell_type,
  smell_type_label:
    row.smell_type && isValidSmellType(row.smell_type)
      ? SMELL_TYPE_LABELS[row.smell_type]
      : null,
  emoji: row.emoji,
  latitude: roundCoordinate(row.latitude),
  longitude: roundCoordinate(row.longitude),
  municipality: row.municipality,
  district: row.district,
  weather: row.weather,
  temperature: row.temperature,
  wind: row.wind,
  wind_direction: row.wind_direction,
  pressure: row.pressure,
  normal_pressure: row.normal_pressure,
});

const errorResponse = (status: number, code: string, message: string) =>
  NextResponse.json(
    { error: { code, message } },
    { status, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } },
  );

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

/**
 * ヤマセ君の投稿データをオープンデータ（CC BY 4.0）として返す。
 * 投稿者の特定につながる user_id・自由記述は含めず、緯度経度は約 100m に丸める。
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const parsed = parseQuery(requestUrl.searchParams);
  if (!parsed.ok) {
    return errorResponse(400, "invalid_parameter", parsed.message);
  }

  const { query } = parsed;
  const { start, end } = getJstDateRange(query.from, query.to);
  const ascending = query.order === "asc";

  try {
    let builder = getSupabaseAdmin()
      .from("posts")
      .select(PUBLIC_COLUMNS, { count: "exact" })
      .gte("inserted_at", start)
      .lte("inserted_at", end);

    if (query.municipality) {
      builder = builder.eq("municipality", query.municipality);
    }
    if (query.smellTypes) {
      builder = builder.in("smell_type", query.smellTypes);
    }
    if (query.minIntensity !== null) {
      builder = builder.gte("intensity", query.minIntensity);
    }
    if (query.maxIntensity !== null) {
      builder = builder.lte("intensity", query.maxIntensity);
    }

    const { data, count, error } = await builder
      .order("inserted_at", { ascending })
      .order("id", { ascending })
      .range(query.offset, query.offset + query.limit - 1);

    if (error) {
      console.error("Failed to fetch open data posts", error);
      return errorResponse(500, "internal_error", "データの取得に失敗しました。");
    }

    const records = ((data as unknown as PostRow[] | null) ?? []).map(
      toPublicRecord,
    );
    const total = count ?? records.length;
    const nextOffset = query.offset + query.limit;
    let next: string | null = null;
    if (nextOffset < total) {
      const nextUrl = new URL(requestUrl);
      nextUrl.searchParams.set("offset", String(nextOffset));
      next = nextUrl.toString();
    }

    return NextResponse.json(
      {
        license: LICENSE,
        attribution: ATTRIBUTION,
        query: {
          from: query.from,
          to: query.to,
          municipality: query.municipality,
          smell_type: query.smellTypes,
          min_intensity: query.minIntensity,
          max_intensity: query.maxIntensity,
          order: query.order,
          limit: query.limit,
          offset: query.offset,
        },
        pagination: {
          total,
          count: records.length,
          next,
        },
        data: records,
      },
      {
        status: 200,
        headers: {
          ...CORS_HEADERS,
          // 同じ URL への連続アクセスは Vercel の CDN で返し、DB への負荷を抑える
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    console.error("Unexpected error on GET /api/open-data/posts", error);
    return errorResponse(500, "internal_error", "データの取得に失敗しました。");
  }
}
