// Shared description sanitizer for scrape ingest + one-off Airtable cleanup.
// Strips HTML/JS/CSS/markdown artifacts and leaves parent-facing prose.

export const DESCRIPTION_MAX_LEN = 600;

const OPENERS = new Set(["(", "{", "["]);
const CLOSERS = { ")": "(", "}": "{", "]": "[" };

/** True when text still looks like markup, CSS, JS, or a scrape dump. */
export function looksLikeCode(text) {
  const s = String(text || "");
  if (!s.trim()) return false;
  return (
    /<(div|p|br|span|script|style|table|ul|li|ol|h[1-6]|img|iframe|section|article|strong|em|font|td|tr|hr)\b/i.test(s) ||
    /<\/[a-z]/i.test(s) ||
    /\bstyle\s*=/i.test(s) ||
    /\bonclick\b|\bonmouseover\b|\bjavascript:/i.test(s) ||
    /&nbsp;|&lt;|&gt;|&quot;|&#\d+;|&#x[0-9a-f]+;/i.test(s) ||
    /function\s*\(/.test(s) ||
    /jQuery\s*\(|window\.advanced_ads|\.unslider\(|\$familslider/i.test(s) ||
    /\bwindow\.[a-zA-Z_]/.test(s) ||
    /```/.test(s) ||
    /\{\s*[a-z-]+\s*:\s*[^}]{0,80}(px|em|%|block|none|auto)/i.test(s) ||
    /\b(display|font-size|margin|padding|background)\s*:\s*[^;]{1,40};/i.test(s) ||
    /^\s*[\{\[][\s\S]{0,80}"[^"]+"\s*:/.test(s)
  );
}

export function fallbackDescription({ title, venue } = {}) {
  const t = String(title || "").replace(/\s+/g, " ").trim();
  const v = String(venue || "").replace(/\s+/g, " ").trim();
  if (t && v && !t.toLowerCase().includes(v.toLowerCase())) return `${t} at ${v}.`;
  if (t) return /[.!?]$/.test(t) ? t : `${t}.`;
  if (v) return `${v}.`;
  return "";
}

function skipBalanced(s, openIndex) {
  const open = s[openIndex];
  if (!OPENERS.has(open)) return openIndex + 1;
  const stack = [open];
  let quote = null;
  for (let i = openIndex + 1; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (OPENERS.has(c)) stack.push(c);
    else if (CLOSERS[c]) {
      if (stack[stack.length - 1] === CLOSERS[c]) stack.pop();
      if (stack.length === 0) return i + 1;
    }
  }
  return s.length;
}

function skipCallChain(s, i) {
  while (i < s.length) {
    const rest = s.slice(i);
    const m = rest.match(/^\s*\.[a-zA-Z_$][\w$]*\s*\(/);
    if (!m) break;
    const openAt = i + m[0].length - 1;
    i = skipBalanced(s, openAt);
  }
  while (i < s.length && /[\s;]/.test(s[i])) i++;
  return i;
}

function stripEmbeddedJs(s) {
  let out = s;
  let guard = 0;
  while (guard++ < 30) {
    const starters = [
      /(?:Sponsors\s+)?\(\s*window\./i,
      /jQuery\s*\(/,
      /\$[a-zA-Z_$][\w$]*\s*\./,
      /function\s*\(/,
    ];
    let hit = null;
    for (const re of starters) {
      const m = re.exec(out);
      if (m && (hit == null || m.index < hit.index)) hit = { m, re };
    }
    if (!hit) break;
    const start = hit.m.index;
    const token = hit.m[0];
    let end;
    if (token.startsWith("function")) {
      const paren = out.indexOf("(", start);
      if (paren < 0) break;
      const afterParen = skipBalanced(out, paren);
      const brace = out.slice(afterParen).match(/^\s*\{/);
      if (brace) {
        const b = afterParen + brace[0].length - 1;
        end = skipCallChain(out, skipBalanced(out, b));
      } else {
        end = skipCallChain(out, afterParen);
      }
    } else if (out[start] === "(" || /^\s*\(/.test(token) || /Sponsors/i.test(token)) {
      const openAt = out.indexOf("(", start);
      if (openAt < 0) break;
      end = skipCallChain(out, skipBalanced(out, openAt));
    } else {
      const openAt = out.indexOf("(", start);
      if (openAt < 0) {
        out = out.slice(0, start) + " " + out.slice(start + token.length);
        continue;
      }
      end = skipCallChain(out, skipBalanced(out, openAt));
    }
    out = `${out.slice(0, start)} ${out.slice(end)}`;
  }
  out = out.replace(/\s*Sponsors\s*\([^)]*$/gi, "");
  out = out.replace(/\(\s*window\.[a-zA-Z0-9_]*\s*$/gi, "");
  out = out.replace(/\s+Sponsors?\s*$/gi, "");
  out = out.replace(/\s+Spon[a-z]*\s*$/gi, "");
  out = out.replace(/\s+Sp\s*$/g, "");
  return out;
}

export function stripMarkup(html) {
  if (!html) return "";
  return String(html)
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/```[\s\S]*$/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&rsquo;|&#8217;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\.([a-z])\./gi, "$1")
    .replace(/\s*[—–-]{3,}\s*/g, "\n•••\n")
    .replace(/[ \t]+/g, " ");
}

/**
 * Turn a scraped description into readable prose.
 * Never invents copy. Returns "" when nothing salvageable remains.
 */
export function sanitizeDescription(text) {
  if (!text) return "";
  let s = stripMarkup(String(text));
  s = stripEmbeddedJs(s);
  s = s
    .split("\n")
    .map((l) => l.trim())
    .filter(
      (l) =>
        l !== "" &&
        !/^(sponsors?|advertisements?|advertisement)$/i.test(l) &&
        !/^[(){};.]+$/.test(l) &&
        !/function\s*\(|\.unslider\(|jQuery\(|\bwindow\.[a-z]/i.test(l),
    )
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (looksLikeCode(s)) return "";
  return s.slice(0, DESCRIPTION_MAX_LEN);
}
