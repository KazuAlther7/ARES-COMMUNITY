/* ARES service worker: terima Web Push + klik notifikasi. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("push", (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "ARES COMMUNITY", {
    body: d.body || "", icon: "assets/favicon-192.png", badge: "assets/favicon-192.png",
    tag: d.tag || undefined, data: { url: d.url || "./" }, renotify: false
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) if (c.url === url && "focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});
