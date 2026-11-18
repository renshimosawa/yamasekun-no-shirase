import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase";
import { getServerAuthSession } from "@/lib/auth";
import { getTodayDateRangeJst } from "@/lib/date";
import { reverseGeocode } from "@/lib/geocoding";
import { sendPushToTokens } from "@/lib/push-notifications";
import {
  isValidNeutralSmellEmoji,
  isValidSmellType,
  NEUTRAL_SMELL_EMOJI,
  SMELL_TYPE_LABELS,
  type SmellType,
} from "@/constants/smell";

type FcmTokenRecord = {
  token: string;
};

type CreatePostRequest = {
  description: string;
  smell_type: SmellType | null;
  latitude?: number | null;
  longitude?: number | null;
  intensity?: number | null;
  emoji?: string | null;
  temperature?: number | null;
  wind_direction?: number | null;
  weather?: string | null;
  wind?: number | null;
  pressure?: number | null;
  normal_pressure?: number | null;
};

const truncateText = (text: string, maxLength: number) =>
  text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;

async function notifyNewPost(post: {
  userId: string;
  description: string;
  insertedAt: string;
  intensity: number | null;
  smellType: SmellType | null;
  emoji: string | null;
}) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("fcm_tokens")
    .select("token")
    .neq("user_id", post.userId);

  if (error) {
    console.error("Failed to fetch FCM tokens", error);
    return;
  }

  const tokens = ((data as FcmTokenRecord[] | null) ?? []).map(
    (row) => row.token,
  );

  if (tokens.length === 0) {
    return;
  }

  const smellLabel =
    post.intensity === 0
      ? "ニュートラル"
      : post.smellType
        ? SMELL_TYPE_LABELS[post.smellType]
        : "未選択";
  const meta =
    post.intensity === 0
      ? `Lv0 ${post.emoji ?? NEUTRAL_SMELL_EMOJI}`
      : `Lv${post.intensity ?? "-"} ${smellLabel}`;

  await sendPushToTokens(tokens, {
    title: "新しい投稿があります",
    body: `${meta} - ${truncateText(post.description, 48)}`,
    link: "/",
    type: "new_post",
    data: { insertedAt: post.insertedAt },
  });
}

export async function POST(request: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CreatePostRequest;
    const { description, smell_type, latitude, longitude, intensity, emoji, temperature, wind_direction, weather, wind, pressure, normal_pressure } =
      body;

    if (!description || description.trim().length === 0) {
      return NextResponse.json(
        { error: "自由入力欄を入力してください" },
        { status: 400 },
      );
    }

    if (description.length > 50) {
      return NextResponse.json(
        { error: "自由入力欄は50文字以内で入力してください" },
        { status: 400 },
      );
    }

    const normalizedIntensity =
      typeof intensity === "number" && !Number.isNaN(intensity)
        ? Math.min(Math.max(Math.round(intensity), 0), 3)
        : null;

    if (smell_type !== null && !isValidSmellType(smell_type)) {
      return NextResponse.json(
        { error: "においタイプが不正です" },
        { status: 400 },
      );
    }

    const sanitizedEmoji =
      typeof emoji === "string" ? emoji.trim() || null : null;

    const sanitizedWeather =
      typeof weather === "string" ? weather.trim().slice(0, 100) || null : null;

    if (normalizedIntensity !== null && normalizedIntensity > 0) {
      if (!smell_type) {
        return NextResponse.json(
          { error: "においタイプを選択してください" },
          { status: 400 },
        );
      }
    }

    if (normalizedIntensity === 0) {
      if (!sanitizedEmoji || !isValidNeutralSmellEmoji(sanitizedEmoji)) {
        return NextResponse.json(
          { error: "ピン用の絵文字が不正です" },
          { status: 400 },
        );
      }
    }

    if (normalizedIntensity !== null && normalizedIntensity > 0) {
      if (sanitizedEmoji) {
        console.warn(
          "Ignoring emoji for non-neutral post submission",
          sanitizedEmoji,
        );
      }
    }

    const storedSmellType = normalizedIntensity === 0 ? null : smell_type;
    const storedEmoji =
      normalizedIntensity === 0
        ? (sanitizedEmoji ?? NEUTRAL_SMELL_EMOJI)
        : null;

    const supabase = getSupabaseAdmin();
    const insertedAt = new Date().toISOString();

    const geocoded =
      typeof latitude === "number" && typeof longitude === "number"
        ? await reverseGeocode(latitude, longitude)
        : { municipality: null, district: null, address: null };

    const { error } = await supabase.from("posts").insert({
      user_id: session.user.id,
      description,
      content: description,
      intensity: normalizedIntensity,
      smell_type: storedSmellType,
      emoji: storedEmoji,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      temperature: temperature ?? null,
      wind_direction: wind_direction ?? null,
      weather: sanitizedWeather,
      wind: wind ?? null,
      pressure: pressure ?? null,
      normal_pressure: normal_pressure ?? null,
      address: geocoded.address,
      municipality: geocoded.municipality,
      district: geocoded.district,
    });

    if (error) {
      console.error("Failed to insert post", error);
      return NextResponse.json(
        { error: "投稿の保存中にエラーが発生しました" },
        { status: 500 },
      );
    }

    void notifyNewPost({
      userId: session.user.id,
      description,
      insertedAt,
      intensity: normalizedIntensity,
      smellType: storedSmellType,
      emoji: storedEmoji,
    }).catch((notifyError) => {
      console.error("Failed to send FCM notification", notifyError);
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error on POST /api/posts", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    console.log("[DEBUG] SUPABASE_URL =", process.env.SUPABASE_URL);
    const supabase = getSupabaseAdmin();

    const { start, end } = getTodayDateRangeJst();

    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, description, intensity, smell_type, emoji, latitude, longitude, inserted_at, address, municipality, district, temperature, wind_direction, weather, wind, pressure, normal_pressure",
      )
      .gte("inserted_at", start)
      .lte("inserted_at", end)
      .order("inserted_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("Failed to fetch posts", error);
      return NextResponse.json(
        { error: "投稿の取得中にエラーが発生しました" },
        { status: 500 },
      );
    }

    return NextResponse.json({ posts: data }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error on GET /api/posts", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
