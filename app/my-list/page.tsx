import type { Metadata } from "next";
import { getEvents } from "@/lib/data";
import { MyList } from "@/components/MyList";

export const revalidate = 600;
export const metadata: Metadata = {
  title: "My List — Vegas Kiddos",
  description: "Your saved kid-friendly events for weekend planning.",
};

export default async function MyListPage() {
  const events = await getEvents();
  return <MyList events={events} />;
}
