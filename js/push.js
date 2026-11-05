/* Follow tim + notifikasi 5 menit sebelum match.
   Push asli (browser tertutup) butuh VAPID_PUBLIC_KEY + edge function send-push (lihat supabase/update-push.sql).
   Tanpa itu: notifikasi tetap muncul selama situs terbuka (fallback polling). */
(function () {
  const LEAD = 5 * 60000, LS = "ares_follow", SENT = "ares_notified";
  const A = () => window.ARES, cfg = () => window.ARES_CONFIG || {};
  const norm = (s) => String(s || "").trim().toLowerCase();
  const rd = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (_) { return d; } };
  const wr = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const list = () => rd(LS, []);
  const supported = () => "Notification" in window && "serviceWorker" in navigator;
  const b64 = (s) => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
  let reg = null;
  async function getReg() {
    if (reg) return reg;
    try { reg = await navigator.serviceWorker.register("sw.js"); await navigator.serviceWorker.ready; } catch (_) { reg = null; }
    return reg;
  }
  async function sync() { // simpan langganan + daftar tim ke DB (hanya kalau push asli aktif)
    const key = cfg().VAPID_PUBLIC_KEY, r = await getReg(); if (!key || !r || !A()?.client) return false;
    let sub = await r.pushManager.getSubscription();
    if (!sub) sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
    const j = sub.toJSON(), teams = list();
    if (!teams.length) { await A().client.rpc("push_remove", { p_endpoint: j.endpoint }); await sub.unsubscribe().catch(() => {}); return true; }
    const { error } = await A().client.rpc("push_save", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_teams: teams });
    return !error;
  }
  async function follow(name) {
    if (!supported()) throw new Error("Browser ini tidak mendukung notifikasi.");
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission !== "granted") throw new Error("Izin notifikasi ditolak. Aktifkan di pengaturan browser.");
    const l = list(), k = norm(name); if (!l.includes(k)) l.push(k); wr(LS, l.slice(-30));
    await getReg(); sync().catch(() => {}); poll();
  }
  async function unfollow(name) { wr(LS, list().filter(x => x !== norm(name))); sync().catch(() => {}); }
  const isFollowing = (name) => list().includes(norm(name));

  let busy = false;
  async function poll() { // fallback: situs terbuka
    if (busy) return; busy = true; try { await poll1(); } finally { busy = false; }
  }
  async function poll1() {
    if (!supported() || Notification.permission !== "granted" || !list().length || !A()?.client) return;
    const now = Date.now(), sent = rd(SENT, {});
    Object.keys(sent).forEach(k => { if (now - sent[k] > 864e5) delete sent[k]; });
    const { data } = await A().client.from("matches").select("id,scheduled_at,round_name,is_bye,winner_id,status,tournament_id,team1:teams!matches_team1_id_fkey(name),team2:teams!matches_team2_id_fkey(name)")
      .gt("scheduled_at", new Date(now).toISOString()).lte("scheduled_at", new Date(now + LEAD).toISOString()).neq("status", "completed");
    const f = list(), r = await getReg();
    for (const m of data || []) {
      if (m.is_bye || m.winner_id || !m.team1 || !m.team2 || sent[m.id]) continue;
      const n1 = norm(m.team1.name), n2 = norm(m.team2.name); if (!f.includes(n1) && !f.includes(n2)) continue;
      sent[m.id] = now;
      const t = new Date(m.scheduled_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Jakarta" }).replace(":", ".");
      const o = { body: `${m.team1.name} vs ${m.team2.name} · ${t} WIB${m.round_name ? " · " + m.round_name : ""}`, icon: "assets/favicon-192.png", tag: "m" + m.id, data: { url: "tournament.html?id=" + m.tournament_id } };
      if (r) r.showNotification("ARES · Match 5 menit lagi", o); else new Notification("ARES · Match 5 menit lagi", o);
    }
    wr(SENT, sent);
  }
  if (supported()) { setInterval(poll, 60000); setTimeout(() => { if (list().length && Notification.permission === "granted") { getReg(); poll(); } }, 3000); }
  window.ARES_PUSH = { follow, unfollow, isFollowing, list, supported, poll, real: () => !!cfg().VAPID_PUBLIC_KEY };
})();
