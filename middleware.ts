import { NextResponse, type NextRequest } from "next/server";

// ── Locale routing ──────────────────────────────────────────────────────────
// Language now lives in the route as the [lang] segment, so every page renders
// statically (no headers() in the render path). The public URL scheme is
// unchanged — English at the root, Spanish under /es:
//
//   /about      → English  (rewritten internally to /en/about; URL stays /about)
//   /es/about   → Spanish  (maps natively to the [lang]=es tree, no rewrite)
//
// How it works:
//  • /es/* already matches app/[lang]/* with lang=es, so it passes through
//    untouched (we only refresh the preference cookie).
//  • Un-prefixed English paths are *rewritten* to /en/* so they hit the
//    [lang]=en tree, while the address bar keeps the canonical root URL.
//  • /en/* is internal-only: if a visitor (or a stale link) hits it directly,
//    redirect to the canonical un-prefixed URL to avoid duplicate content.
//  • A visitor who previously chose Spanish (vk_lang=es cookie) is redirected
//    from the English tree to the /es equivalent, so plain internal <Link>s
//    keep them in Spanish. Crawlers send no cookie → they stay on the canonical
//    English tree and discover /es via hreflang + the sitemap.

const COOKIE = "vk_lang";
const COOKIE_OPTS = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // /en/* is an internal rewrite target, never a public URL → canonicalize.
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/en" ? "/" : pathname.slice(3);
    return NextResponse.redirect(url);
  }

  // Spanish tree: already maps to [lang]=es. Just keep the preference cookie.
  if (pathname === "/es" || pathname.startsWith("/es/")) {
    const res = NextResponse.next();
    res.cookies.set(COOKIE, "es", COOKIE_OPTS);
    return res;
  }

  // English tree. Returning Spanish visitors are bounced to the /es equivalent.
  if (req.cookies.get(COOKIE)?.value === "es") {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/es" : `/es${pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  // Rewrite the un-prefixed English path onto the [lang]=en tree, URL unchanged.
  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? "/en" : `/en${pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Run on page routes only — skip API routes, Next internals, root metadata
  // routes (sitemap/robots/manifest/opengraph-image/icon), and any file with an
  // extension. These live outside the [lang] tree and must not be rewritten.
  matcher: [
    "/((?!api|_next/static|_next/image|opengraph-image|icon|apple-icon|manifest|sitemap|robots|.*\\.[\\w]+$).*)",
  ],
};
