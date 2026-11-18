import type { Metadata } from "next";
import Link from "next/link";

const SITE_URL = "https://yamasekun.jp";
const API_EXAMPLE_PATH =
  "/api/open-data/posts/?from=2026-11-01&to=2026-11-18&municipality=青森県八戸市";

export const metadata: Metadata = {
  title: "オープンデータについて | ヤマセ君の知らせ",
  description:
    "ヤマセ君の知らせに投稿されたにおいのデータを、CC BY 4.0 のオープンデータとして公開しています。公開する内容と使い方を説明します。",
  alternates: { canonical: "/open-data/" },
};

const linkClassName =
  "text-blue-800 underline underline-offset-4 hover:decoration-2";

const API_PARAMETERS = [
  {
    name: "from / to",
    description:
      "期間。日本時間の日付を YYYY-MM-DD で指定します。省略すると今日までの 7 日間です。",
  },
  {
    name: "municipality",
    description: "市区町村。「青森県八戸市」のように都道府県から指定します。",
  },
  {
    name: "smell_type",
    description:
      "においの種類。hoya（ホヤ）、iron（鉄）、umineko（ウミネコ）、dog_food（ドッグフード）、livestock（家畜）から、カンマ区切りで複数指定できます。",
  },
  {
    name: "min_intensity / max_intensity",
    description: "においの強さの範囲（0〜3）。",
  },
  {
    name: "order",
    description: "並び順。asc（古い順）か desc（新しい順）。省略すると desc です。",
  },
  {
    name: "limit / offset",
    description:
      "1 回で返す件数（最大 1000、省略すると 100）と、読み飛ばす件数。続きは応答の pagination.next の URL で取得できます。",
  },
];

export default function OpenDataPage() {
  return (
    <div className="min-h-[100svh] bg-white text-slate-900">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 pb-16 pt-10 text-base leading-relaxed sm:px-8">
        <p>
          <Link href="/" className={linkClassName}>
            ← 地図に戻る
          </Link>
        </p>

        <header className="flex flex-col gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">オープンデータについて</h1>
          <p>
            ヤマセ君の知らせに投稿されたデータは、誰でも自由に使えるオープンデータとして公開しています。
          </p>
        </header>

        <section className="flex flex-col gap-3" aria-labelledby="published">
          <h2 id="published" className="text-xl font-bold">
            公開する内容
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>においの強さ（0〜3）と種類</li>
            <li>「におわない」と投稿したときに選んだ絵文字</li>
            <li>投稿日時</li>
            <li>
              おおよその投稿場所（緯度経度を約 100m 単位に丸めたもの）と、市区町村・町名
            </li>
            <li>投稿時点の気象データ（投稿場所に最も近いアメダス観測点の値）</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="not-published">
          <h2 id="not-published" className="text-xl font-bold">
            公開しない内容
          </h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>自由入力欄のコメント</li>
            <li>
              投稿者のアカウントの情報など、誰が投稿したかが分かる情報。同じ人の投稿どうしを結びつける情報も含めません。
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="target">
          <h2 id="target" className="text-xl font-bold">
            対象となる投稿
          </h2>
          <p>
            これまでの投稿も含め、すべての投稿が対象です。その日の投稿は
            <Link href="/mypage" className={linkClassName}>
              マイページ
            </Link>
            から削除でき、削除するとオープンデータからも消えます。反映には最大 15 分ほどかかります。
          </p>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="license">
          <h2 id="license" className="text-xl font-bold">
            利用条件
          </h2>
          <p>
            <a
              href="https://creativecommons.org/licenses/by/4.0/deed.ja"
              className={linkClassName}
            >
              クリエイティブ・コモンズ 表示 4.0 国際（CC BY 4.0）
            </a>
            で公開しています。商用利用も含めて自由に使えます。使うときは、次のように出典を表示してください。
          </p>
          <p className="rounded-lg border border-slate-500 bg-slate-100 px-4 py-3 font-medium">
            出典：ヤマセ君の知らせ（{SITE_URL}）
          </p>
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="api">
          <h2 id="api" className="text-xl font-bold">
            データの取得方法
          </h2>
          <p>
            次の URL に条件を付けてアクセスすると、JSON 形式でデータを取得できます。登録や API キーは不要です。
          </p>
          <p className="break-all rounded-lg border border-slate-500 bg-slate-100 px-4 py-3 font-mono">
            <a href={API_EXAMPLE_PATH} className={linkClassName}>
              {SITE_URL}
              {API_EXAMPLE_PATH}
            </a>
          </p>
          <h3 className="mt-2 text-lg font-bold">指定できる条件</h3>
          <dl className="flex flex-col gap-3">
            {API_PARAMETERS.map((parameter) => (
              <div key={parameter.name}>
                <dt className="font-mono font-bold">{parameter.name}</dt>
                <dd className="pl-4">{parameter.description}</dd>
              </div>
            ))}
          </dl>
          <p>
            条件はすべて省略できます。不正な値を指定すると、理由を書いたエラーを返します。
          </p>
        </section>
      </main>
    </div>
  );
}
