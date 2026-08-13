import Link from "next/link";
import { cookies, headers } from "next/headers";
import { t, type Lang } from "@/lib/i18n";
import { homePath } from "@/lib/eventUrl";

async function langOf(): Promise<Lang> {
  const path = (await headers()).get("x-url") || (await headers()).get("referer") || "";
  if (path.includes("/es")) return "es";
  if ((await cookies()).get("vk_lang")?.value === "es") return "es";
  return "en";
}

export default async function NotFound() {
  const lang = await langOf();
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="animate-wiggle text-7xl">🌵</p>
      <h1 className="mt-4 font-display text-4xl font-700">{t(lang, "nf_title")}</h1>
      <p className="mt-2 text-ink/70">{t(lang, "nf_body")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href={homePath(lang)} className="hover-pop rounded-full bg-coral-btn px-5 py-3 font-800 text-white shadow-pop">
          {t(lang, "nf_browse")}
        </Link>
        <Link href={lang === "es" ? "/es/this-weekend" : "/this-weekend"} className="rounded-full border-2 border-ink/15 px-5 py-3 font-800 text-ink/70 transition hover:border-teal">
          {t(lang, "nf_weekend")}
        </Link>
      </div>
    </div>
  );
}
