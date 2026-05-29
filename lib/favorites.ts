// Client-side personalization stored in localStorage — no account needed.
// Favorites + remembered kid ages. Components listen for the "vk-prefs" event
// to stay in sync.

const FAV_KEY = "vk_favs";
const AGE_KEY = "vk_ages";

function read(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}
function write(key: string, val: string[]) {
  localStorage.setItem(key, JSON.stringify(val));
  window.dispatchEvent(new Event("vk-prefs"));
}

export function getFavorites(): string[] {
  return read(FAV_KEY);
}
export function isFavorite(id: string): boolean {
  return read(FAV_KEY).includes(id);
}
export function toggleFavorite(id: string): boolean {
  const f = read(FAV_KEY);
  const i = f.indexOf(id);
  if (i >= 0) f.splice(i, 1);
  else f.push(id);
  write(FAV_KEY, f);
  return f.includes(id);
}

// Remembered kid age tiers (auto-applied as a filter).
export function getSavedAges(): string[] {
  return read(AGE_KEY);
}
export function saveAges(ages: string[]) {
  write(AGE_KEY, ages);
}
