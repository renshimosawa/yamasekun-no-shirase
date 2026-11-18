import { NextResponse } from "next/server";

import { sendPushToTokens } from "@/lib/push-notifications";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Supabase の 1 リクエストあたりの最大取得件数（既定 1000）に合わせて分割取得する
const PAGE_SIZE = 1000;

const REMINDER_TITLE = "今、ヤマセにおいますか？";
const REMINDER_BODY = "におわなくても大丈夫。今のにおいを報告してください。";
// FloatingPostButton がこのクエリを見て投稿フォームを開く
const REMINDER_LINK = "/?post=1";

type FcmTokenRow = {
  token: string;
};

async function fetchAllFcmTokens() {
  const supabase = getSupabaseAdmin();
  const rows: FcmTokenRow[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from("fcm_tokens")
      .select("token")
      .order("token")
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      throw error;
    }

    const page = (data as FcmTokenRow[] | null) ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) {
      return rows;
    }
  }
}

/**
 * 毎日 12:00（JST）に Vercel Cron から呼ばれ、
 * 通知を許可している全ユーザーに投稿を促す通知を送る。
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not configured.");
    return NextResponse.json(
      { error: "Cron is not configured" },
      { status: 500 },
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tokens = (await fetchAllFcmTokens()).map((row) => row.token);

    const result = await sendPushToTokens(tokens, {
      title: REMINDER_TITLE,
      body: REMINDER_BODY,
      link: REMINDER_LINK,
      type: "daily_reminder",
    });

    if (!result) {
      return NextResponse.json(
        { error: "Firebase admin is not configured" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (error) {
    console.error("Unexpected error on GET /api/cron/daily-reminder", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
