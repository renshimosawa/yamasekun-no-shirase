import "server-only";

import { getFirebaseAdminMessaging } from "@/lib/firebase-admin";
import { getSupabaseAdmin } from "@/lib/supabase";

const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "https://yamasekun.jp";

// sendEachForMulticast は 1 回あたり 500 トークンまで
const MULTICAST_TOKEN_LIMIT = 500;

const INVALID_TOKEN_ERROR_CODES = new Set([
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
]);

export type PushPayload = {
  title: string;
  body: string;
  /** 通知タップ時に開くアプリ内パス */
  link: string;
  /** 通知の種類（data.type に入る） */
  type: string;
  data?: Record<string, string>;
};

export type PushResult = {
  tokenCount: number;
  successCount: number;
  failureCount: number;
  invalidTokenCount: number;
};

/**
 * FCM トークンにプッシュ通知を送り、無効になったトークンを fcm_tokens から削除する。
 * Firebase Admin の設定がない場合は null を返す。
 */
export async function sendPushToTokens(
  rawTokens: string[],
  payload: PushPayload,
): Promise<PushResult | null> {
  const messaging = getFirebaseAdminMessaging();
  if (!messaging) {
    return null;
  }

  const tokens = Array.from(
    new Set(rawTokens.map((token) => token?.trim()).filter(Boolean)),
  );

  const result: PushResult = {
    tokenCount: tokens.length,
    successCount: 0,
    failureCount: 0,
    invalidTokenCount: 0,
  };

  if (tokens.length === 0) {
    return result;
  }

  const invalidTokens: string[] = [];
  const failedCodes: string[] = [];

  for (let i = 0; i < tokens.length; i += MULTICAST_TOKEN_LIMIT) {
    const chunk = tokens.slice(i, i + MULTICAST_TOKEN_LIMIT);
    const response = await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      webpush: {
        fcmOptions: {
          link: payload.link,
        },
        notification: {
          icon: `${APP_ORIGIN}/favicon.png`,
          badge: `${APP_ORIGIN}/favicon.png`,
        },
      },
      data: {
        ...payload.data,
        type: payload.type,
        link: payload.link,
      },
    });

    result.successCount += response.successCount;
    result.failureCount += response.failureCount;

    response.responses.forEach((sendResult, index) => {
      if (sendResult.success) {
        return;
      }
      const code = sendResult.error?.code ?? "unknown_error";
      failedCodes.push(code);
      if (INVALID_TOKEN_ERROR_CODES.has(code)) {
        invalidTokens.push(chunk[index]);
      }
    });
  }

  result.invalidTokenCount = invalidTokens.length;

  console.info("FCM multicast result", {
    type: payload.type,
    ...result,
    failedCodes,
  });

  if (invalidTokens.length > 0) {
    const { error } = await getSupabaseAdmin()
      .from("fcm_tokens")
      .delete()
      .in("token", invalidTokens);

    if (error) {
      console.error("Failed to cleanup invalid FCM tokens", error);
    }
  }

  return result;
}
