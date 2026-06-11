"use client";

// Footer link that re-opens the cookie consent banner. Lets anyone change
// their choice later — including US visitors who were auto-granted and never
// saw the banner, and EU visitors withdrawing consent.
export function CookieSettingsLink({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("vk:cookie-settings"))}
      className="text-left hover:text-coral"
    >
      {label}
    </button>
  );
}
