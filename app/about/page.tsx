import { getLang } from "@/lib/lang-server";
import { t } from "@/lib/i18n";

export const metadata = {
  title: "About — Vegas Kiddos",
};

export default async function AboutPage() {
  const lang = await getLang();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="font-display text-4xl font-700 text-ink">
        {t(lang, "ab_title")} <span className="text-coral">Vegas</span>{" "}
        <span className="text-teal">Kiddos</span> 🌵
      </h1>
      <div className="mt-6 space-y-4 text-lg leading-relaxed text-ink/80">
        <p>{t(lang, "ab_lead")}</p>
        <p>{t(lang, "ab_p2")}</p>
        <h2 className="pt-2 font-display text-2xl font-600 text-ink">
          {t(lang, "ab_sources_h")}
        </h2>
        <ul className="list-inside list-disc space-y-1 text-base">
          <li>{t(lang, "ab_src_1")}</li>
          <li>{t(lang, "ab_src_2")}</li>
          <li>{t(lang, "ab_src_3")}</li>
          <li>{t(lang, "ab_src_4")}</li>
          <li>{t(lang, "ab_src_5")}</li>
        </ul>
        <h2 className="pt-2 font-display text-2xl font-600 text-ink">
          {t(lang, "ab_safety_h")}
        </h2>
        <p className="text-base">{t(lang, "ab_safety_p")}</p>
      </div>
    </div>
  );
}
