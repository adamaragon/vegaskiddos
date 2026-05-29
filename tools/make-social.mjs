// Generates Facebook Page graphics (cover + profile) in the Vegas Kiddos brand,
// rendered via headless Chrome so we get the real Fredoka/Nunito webfonts.
// Output: assets/social/fb-cover.png (1640×624) + fb-profile.png (500×500).
// Run: node tools/make-social.mjs
import puppeteer from "puppeteer";
import fs from "node:fs";

const OUT = new URL("../assets/social/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

const FONTS = `@import url('https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@700;800&display=swap');`;

// Brand palette
const C = { sand: "#FFF8EE", coral: "#FF6B5E", coralDark: "#E8503F", sunny: "#FFC93C", teal: "#23C4B5", tealDark: "#0FA89A", grape: "#7B5EA7", ink: "#2D2A32" };

const star = (x, y, size, op = 0.35, rot = 0) =>
  `<svg style="position:absolute;left:${x}px;top:${y}px;opacity:${op};transform:rotate(${rot}deg)" width="${size}" height="${size}" viewBox="0 0 24 24" fill="#fff"><path d="M12 1l2.6 6.9L22 9l-5.6 4.6L18 22l-6-4-6 4 1.6-8.4L2 9l7.4-1.1z"/></svg>`;

const cover = `<!doctype html><html><head><meta charset="utf8"><style>
${FONTS}
*{margin:0;box-sizing:border-box}
.wrap{width:1640px;height:624px;position:relative;overflow:hidden;
  background:linear-gradient(118deg, ${C.grape} 0%, ${C.coral} 54%, ${C.sunny} 100%);
  font-family:'Fredoka',sans-serif}
.sun{position:absolute;right:-90px;top:-150px;width:460px;height:460px;border-radius:50%;
  background:radial-gradient(circle, rgba(255,224,138,.95), rgba(255,201,60,0) 70%)}
.glow{position:absolute;left:-120px;bottom:-180px;width:420px;height:420px;border-radius:50%;
  background:radial-gradient(circle, rgba(35,196,181,.55), rgba(35,196,181,0) 70%)}
.center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;padding:0 60px}
.mark{font-weight:700;font-size:124px;line-height:1;letter-spacing:-1px;text-shadow:0 5px 0 rgba(45,42,50,.10);display:flex;align-items:center;gap:18px}
.cactus{font-size:104px;filter:drop-shadow(0 5px 0 rgba(45,42,50,.10))}
.tag{font-family:'Nunito',sans-serif;font-weight:800;font-size:42px;margin-top:14px;text-shadow:0 2px 0 rgba(45,42,50,.10)}
.pill{font-family:'Nunito',sans-serif;font-weight:800;font-size:27px;margin-top:26px;background:#fff;color:${C.coralDark};padding:12px 30px;border-radius:999px;box-shadow:0 6px 0 rgba(45,42,50,.12)}
</style></head><body>
<div class="wrap">
  <div class="sun"></div><div class="glow"></div>
  ${star(140, 120, 46, 0.5, -12)}${star(1430, 150, 60, 0.4, 14)}${star(1500, 430, 38, 0.45, 8)}
  ${star(95, 430, 40, 0.4, 18)}${star(280, 500, 28, 0.35, -6)}${star(1300, 70, 30, 0.3, 0)}
  <div class="center">
    <div class="mark">Vegas Kiddos <span class="cactus">🌵</span></div>
    <div class="tag">Kid-safe fun, all over Las Vegas</div>
    <div class="pill">vegaskiddos.com</div>
  </div>
</div></body></html>`;

const profile = `<!doctype html><html><head><meta charset="utf8"><style>
${FONTS}
*{margin:0;box-sizing:border-box}
.wrap{width:500px;height:500px;position:relative;overflow:hidden;
  background:linear-gradient(135deg, ${C.teal} 0%, ${C.tealDark} 100%);
  font-family:'Fredoka',sans-serif;display:flex;align-items:center;justify-content:center}
.sun{position:absolute;right:-60px;top:-70px;width:240px;height:240px;border-radius:50%;
  background:radial-gradient(circle, rgba(255,224,138,.55), rgba(255,201,60,0) 70%)}
.inner{position:relative;text-align:center;color:#fff;z-index:2}
.cactus{font-size:230px;line-height:1;filter:drop-shadow(0 6px 0 rgba(45,42,50,.18))}
.name{font-weight:700;font-size:58px;line-height:.95;margin-top:-6px;letter-spacing:-.5px;text-shadow:0 3px 0 rgba(45,42,50,.16)}
</style></head><body>
<div class="wrap">
  <div class="sun"></div>
  ${star(70, 90, 40, 0.5, -10)}${star(400, 360, 46, 0.45, 12)}
  <div class="inner">
    <div class="cactus">🌵</div>
    <div class="name">Vegas<br>Kiddos</div>
  </div>
</div></body></html>`;

const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
async function shoot(html, w, h, file) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
  await new Promise((r) => setTimeout(r, 250));
  await page.screenshot({ path: new URL(file, OUT), type: "png", clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
  console.log(`✅ ${file} (${w}×${h} @2x)`);
}
await shoot(cover, 1640, 624, "fb-cover.png");
await shoot(profile, 500, 500, "fb-profile.png");
await browser.close();
console.log(`\nSaved to assets/social/`);
