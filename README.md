このプロジェクトは [Next.js](https://nextjs.org) を用いて構築されています。

## 開発環境の起動

```bash
npm install
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開くとアプリが表示されます。

## Google ログイン（NextAuth）設定

Google 認証を利用するには、以下の環境変数を `.env.local` に設定してください。

```
GOOGLE_CLIENT_ID="Google Cloud Console で発行したクライアントID"
GOOGLE_CLIENT_SECRET="Google Cloud Console で発行したクライアントシークレット"
NEXTAUTH_SECRET="十分に長いランダム文字列"
NEXTAUTH_URL="http://localhost:3000"
SUPABASE_URL="https://<project>.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
```

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) で OAuth 2.0 クライアント ID を作成します。
   - 認証情報 > 認証情報を作成 > OAuth クライアント ID を選択
   - アプリケーションの種類: ウェブアプリケーション
   - 承認済みのリダイレクト URI に `http://localhost:3000/api/auth/callback/google` を追加
2. 発行されたクライアント ID / シークレットを `.env.local` に設定します。
3. `NEXTAUTH_SECRET` は `openssl rand -base64 32` などで生成してください。

環境変数を設定した後、開発サーバーを再起動すると、画面下部のバーから Google ログインを行えます。

## Supabase の利用手順

Supabase の利用手順:

1. [Supabase](https://supabase.com/) でプロジェクトを作成し、左メニュー「プロジェクト設定 > API」から URL と `service_role` キーを取得します。
   - URL を `SUPABASE_URL` に設定
   - `service_role` キーを `SUPABASE_SERVICE_ROLE_KEY` に設定（機密情報のため公開リポジトリにコミットしないでください）
2. Supabase SQL Editor で投稿テーブルを作成します。

```sql
create extension if not exists "uuid-ossp";

create table if not exists public.posts (
  id uuid default uuid_generate_v4() primary key,
  user_id text not null,
  description text not null,
  intensity integer,
  emoji text,
  latitude double precision,
  longitude double precision,
  inserted_at timestamp with time zone default timezone('utc'::text, now())
);
```

3. 必要に応じて Supabase 側で Row Level Security を有効化し、サービスロールキーで書き込みできるようにポリシーを設定してください。

## オープンデータ API

投稿データを JSON で公開しています。認証は不要です。

```
GET https://yamasekun.jp/api/open-data/posts/?from=2026-11-01&to=2026-11-18&municipality=青森県八戸市
```

### ライセンス

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja) です。利用するときは「ヤマセ君の知らせ（https://yamasekun.jp）」と出典を表示してください。

### パラメータ

すべて省略できます。

| パラメータ | 説明 | 既定値 |
| --- | --- | --- |
| `from` | 開始日（日本時間、`YYYY-MM-DD`） | `to` の 6 日前 |
| `to` | 終了日（日本時間、`YYYY-MM-DD`）。この日も含む | 今日 |
| `municipality` | 都道府県＋市区町村の完全一致（例: `青森県八戸市`） | なし |
| `smell_type` | においの種類。カンマ区切りで複数指定できる（`hoya` `iron` `umineko` `dog_food` `livestock`） | なし |
| `min_intensity` / `max_intensity` | においの強さ（0〜3） | なし |
| `order` | 投稿日時の並び順（`asc` / `desc`） | `desc` |
| `limit` | 1 回で返す件数（1〜1000） | `100` |
| `offset` | 読み飛ばす件数 | `0` |

不正な値を渡すと、`400` と `{ "error": { "code": "invalid_parameter", "message": "..." } }` を返します。

### レスポンス

```json
{
  "license": { "name": "CC BY 4.0", "url": "https://creativecommons.org/licenses/by/4.0/deed.ja" },
  "attribution": "ヤマセ君の知らせ（https://yamasekun.jp）",
  "query": { "from": "2026-11-12", "to": "2026-11-18", "municipality": null, "smell_type": null, "min_intensity": null, "max_intensity": null, "order": "desc", "limit": 100, "offset": 0 },
  "pagination": { "total": 3, "count": 3, "next": null },
  "data": [
    {
      "id": "6dc3510f-8c20-4483-b3f5-b588f1bf5420",
      "posted_at": "2026-11-15T22:41:31.063851+00:00",
      "intensity": 0,
      "smell_type": null,
      "smell_type_label": null,
      "emoji": "🐑",
      "latitude": 40.45,
      "longitude": 141.617,
      "municipality": "青森県階上町",
      "district": "大字赤保内",
      "weather": null,
      "temperature": 7.7,
      "wind": 1.3,
      "wind_direction": 292.5,
      "pressure": null,
      "normal_pressure": null
    }
  ]
}
```

- `pagination.next` は次のページの URL です。最後のページでは `null` になります。
- `posted_at` は UTC です。
- `intensity` が 0 の投稿は「におわない」報告で、`smell_type` は `null`、`emoji` に投稿者が選んだ絵文字が入ります。
- 気象値（`temperature` `wind` `wind_direction` `pressure` `normal_pressure` `weather`）は、投稿時点で投稿場所に最も近いアメダス観測点の観測値です。取得できなかった場合は `null` です。

### 公開していない項目

投稿者を特定できないよう、次の扱いにしています。

- 投稿者の ID と自由記述のコメントは含めません。
- 緯度経度は小数第 3 位（約 100m）に丸めています。

## 技術スタック

- Next.js 15 App Router
- TypeScript / React 19
- NextAuth.js (Google OAuth)
- Leaflet + React Leaflet
