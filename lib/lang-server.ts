import { cookies } from "next/headers";
import type { Lang } from "./i18n";

// Current locale from the vk_lang cookie (server components only).
export async function getLang(): Promise<Lang> {
  const c = await cookies();
  return c.get("vk_lang")?.value === "es" ? "es" : "en";
}
