import type { Metadata } from "next";
import { getEvents } from "@/lib/data";
import { MyList } from "@/components/MyList";
import { getLang } from "@/lib/lang-server";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "My List — Vegas Kiddos",
  description: "Your saved kid-friendly events for weekend planning.",
};

export default async function MyListPage() {
  const lang = await getLang();
  const events = await getEvents(lang);
  return <MyList events={events} lang={lang} />;
}
