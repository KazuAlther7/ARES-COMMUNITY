(() => {
  const { client, esc } = window.ARES, host = document.getElementById("pred-list");
  if (!client) { host.innerHTML = '<div class="empty-state">Supabase belum terhubung.</div>'; return; }
  async function load() {
    const { data: all, error } = await client.from("tournaments").select("*").eq("predictions_enabled", true).order("created_at", { ascending: false });
    if (error) { host.innerHTML = '<div class="empty-state">Belum dapat memuat. Jalankan supabase/update-juara3-game-predictions.sql di Supabase dulu.</div>'; return; }
    const list = window.ARES.admin.on ? all : all.filter(t => !t.is_hidden);
    if (!list.length) { host.innerHTML = '<div class="empty-state">Belum ada turnamen dengan Predictions aktif.</div>'; return; }
    // kerangka dibuat sekali; isi tiap turnamen di-refresh tanpa menghapus ketikan pengunjung
    if (host.dataset.ids !== list.map(t => t.id).join()) {
      host.dataset.ids = list.map(t => t.id).join();
      host.innerHTML = list.map(t => `<div class="pred-block"><h3><a href="tournament.html?id=${t.id}">${esc(t.name)}</a>${t.game ? ` <small>${esc(t.game)}</small>` : ""}</h3><div data-pbody="${t.id}"></div></div>`).join("");
    }
    await Promise.all(list.map(async t => {
      const { data: teams } = await client.from("teams").select("id,name,tag,logo_url").eq("tournament_id", t.id).order("created_at");
      await window.ARES.renderPredict(host.querySelector(`[data-pbody="${t.id}"]`), t, teams || []);
    }));
  }
  load(); setInterval(load, 30000);
})();
