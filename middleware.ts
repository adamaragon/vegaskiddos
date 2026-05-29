import { NextResponse, type NextRequest } from "next/server";

// ── Locale routing ──────────────────────────────────────────────────────────
// The URL is the source of truth for language, so search engines get real,
// crawlable Spanish pages instead of a cookie-gated variant:
//
//   /about      → English  (canonical tree)
//   /es/about   → Spanish  (rewritten internally to /about, lang forced to es)
//
// How it works:
//  • /es/* requests are *rewritten* (not redirected) to the un-prefixed path
//    with an `x-vk-lang: es` request header. getLang() reads that header, so
//    every server component renders Spanish — no route-tree duplication.
//  • On the English tree, a visitor who previously chose Spanish (vk_lang=es
//    cookie) is *redirected* to the /es equivalent. That keeps them in Spanish
//    when they click plain English internal <Link>s, without having to make
//    every link locale-aware. Crawlers send no cookie, so they stay on the
//    canonical English tree and discover /es via hreflang + the sitemap.
//  • `x-vk-path` carries the un-prefixed path so the layout can build the
//    reciprocal hreflang/canonical URLs.

const COOKIE = "vk_lang";

function withLangHeaders(req: NextRequest, lang: "en" | "es", path: string) {
  const headers = new Headers(req.headers);
  headers.set("x-vk-lang", lang);
  headers.set("x-vk-path", path);
  return headers;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const isEs = pathname === "/es" || pathname.startsWith("/es/");

  if (isEs) {
    // Strip the /es prefix for the underlying page; "/es" → "/".
    const path = pathname === "/es" ? "/" : pathname.slice(3);
    const url = req.nextUrl.clone();
    url.pathname = path;
    const res = NextResponse.rewrite(url, {
      request: { headers: withLangHeaders(req, "es", path) },
    });
    // Keep the preference cookie in sync so client components + future visits
    // resolve to Spanish.
    res.cookies.set(COOKIE, "es", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    return res;
  }

  // English tree. If the visitor previously chose Spanish, send them to /es so
  // plain English internal links keep them in their language.
  if (req.cookies.get(COOKIE)?.value === "es") {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/es" : `/es${pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  return NextResponse.next({
    request: { headers: withLangHeaders(req, "en", pathname) },
  });
}

export const config = {
  // Run on page routes only — skip API routes, Next internals, and any file
  // with an extension (sitemap.xml, robots.txt, icons, og image, etc.).
  matcher: ["/((?!api|_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
