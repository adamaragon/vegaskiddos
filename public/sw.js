// Minimal service worker: enables installability + a graceful offline fallback
// for navigations. Network-first so content stays fresh.
const CACHE = "vk-shell-v2";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add("/")));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  if (e.request.mode !== "navigate") return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        caches.open(CACHE).then((c) => c.put("/", res.clone())).catch(() => {});
        return res;
      })
      .catch(() => caches.match("/"))
  );
});

// Web push: show the reminder notification the send-reminders job pushed.
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const title = d.title || "Vegas Kiddos 🌵";
  e.waitUntil(
    self.registration.showNotification(title, {
      body: d.body || "You've got a saved event coming up!",
      icon: "/icon-512.svg",
      badge: "/icon-512.svg",
      tag: d.tag || "vk-reminder",
      data: { url: d.url || "/my-list" },
    })
  );
});

// Focus an existing tab or open the target URL when the notification is tapped.
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/my-list";
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) { if ("focus" in w) { w.navigate(url); return w.focus(); } }
      return self.clients.openWindow(url);
    })
  );
});
