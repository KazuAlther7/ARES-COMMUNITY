// Hall of Fame: leaderboard trophy = jumlah turnamen yang dijuarai. Tim yg sama di banyak turnamen digabung lewat nama.
(() => {
  const { client, esc, logo } = window.ARES, host = document.getElementById("hof-list");
  if (!client) { host.innerHTML = '<div class="empty-state">Supabase belum terhubung.</div>'; return; }
  const key = (n) => String(n || "").trim().toLowerCase();
  async function load() {
    const A = window.ARES;
    const { data: ts, error } = await client.from("tournaments").select("id,name,game,status,champion_id,is_hidden,start_date,created_at").not("champion_id", "is", null);
    if (error) { host.innerHTML = '<div class="empty-state">Belum dapat memuat Hall of Fame.</div>'; return; }
    const list = (ts || []).filter(t => A.admin.on || !t.is_hidden);
    const { data: teams } = list.length ? await client.from("teams").select("id,name,tag,logo_url").in("id", list.map(t => t.champion_id)) : { data: [] };
    const { data: hid } = await client.from("hall_hidden").select("name_key"); // tabel belum dibuat → anggap kosong
    const hidden = new Set((hid || []).map(x => x.name_key)), tm = Object.fromEntries((teams || []).map(x => [x.id, x]));
    const by = {};
    list.forEach(t => {
      const team = tm[t.champion_id]; if (!team) return;
      const e = (by[key(team.name)] ||= { key: key(team.name), team, wins: [], last: "" });
      const at = t.start_date || t.created_at || "";
      e.wins.push({ name: t.name, game: t.game, at });
      if (at >= e.last) { e.last = at; e.team = team; }
    });
    window.__hof = by;
    const all = Object.values(by).sort((a, b) => b.wins.length - a.wins.length || String(b.last).localeCompare(String(a.last)) || a.team.name.localeCompare(b.team.name));
    all.forEach(e => e.wins.sort((a, b) => String(b.at).localeCompare(String(a.at))));
    const shown = all.filter(e => A.admin.on || !hidden.has(e.key));
    let rank = 0, prev = -1;
    host.innerHTML = shown.length ? shown.map((e, i) => {
      if (e.wins.length !== prev) { rank = i + 1; prev = e.wins.length; }
      const hd = hidden.has(e.key);
      const n = e.wins.length, lg = e.team.logo_url, last = e.last ? new Date(e.last).toLocaleDateString("id-ID", { month: "short", year: "numeric" }).toUpperCase() : "";
      const title = ["BRONZE", "ELITE", "MASTER", "EPIC", "DIAMOND", "LEGENDARY", "MYTHIC", "COLOSSAL", "GLORY"][n - 1] || "IMMORTAL";
      const cups = '<i class="ico ico-trophy"></i>'.repeat(Math.min(n, 6)) + (n > 6 ? `<em>+${n - 6}</em>` : "");
      return `<article class="hof-row r${Math.min(rank, 4)} t${Math.min(n, 10)}${hd ? " is-hid" : ""}" data-hof="${e.team.id}">${lg ? `<img class="hof-bg" src="${esc(lg)}" alt="">` : '<i class="ico ico-trophy hof-bg-ico"></i>'}<div class="hof-rank">${rank}</div>${logo(e.team, "lg")}<div class="hof-main"><span class="hof-title">${title}</span><h3>${esc(e.team.name)}${hd ? ' <small>· DISEMBUNYIKAN</small>' : ""}</h3><div class="hof-cups">${cups}</div></div><div class="hof-count"><b>${n}</b><small><i class="ico ico-trophy"></i> ${n > 1 ? "TROPHIES" : "TROPHY"}</small>${last ? `<em>TERAKHIR JUARA · ${last}</em>` : ""}</div>${A.admin.on ? `<button type="button" class="hof-hide" data-hhide="${esc(e.key)}" data-state="${hd ? 1 : 0}">${hd ? "TAMPILKAN" : "SEMBUNYIKAN"}</button>` : ""}</article>`;
    }).join("") : '<div class="empty-state">Belum ada juara. Selesaikan turnamen untuk mengisi Hall of Fame.</div>';
  }
  host.addEventListener("click", async (e) => {
    const row = e.target.closest("[data-hof]");
    if (row && !e.target.closest("[data-hhide]")) { const ent = Object.values(window.__hof || {}).find(x => x.team.id === row.dataset.hof); if (ent) window.ARES.showTeamHof(ent.team); return; }
    const b = e.target.closest("[data-hhide]"); if (!b) return;
    e.stopPropagation(); b.disabled = true;
    const k = b.dataset.hhide, r = b.dataset.state === "1" ? await client.from("hall_hidden").delete().eq("name_key", k) : await client.from("hall_hidden").insert({ name_key: k });
    if (r.error) { const m = r.error.message || "", c = r.error.code || ""; alert(c === "42P01" || c === "PGRST205" || /does not exist|schema cache/i.test(m) ? "Tabel hall_hidden belum ada. Jalankan supabase/update-hall-of-fame.sql di Supabase SQL Editor." : /row-level security|policy|permission/i.test(m) ? "Ditolak oleh RLS database. Jalankan supabase/fix-admin-policies.sql di Supabase SQL Editor.\n\n" + m : m); }
    load();
  });
  window.addEventListener("ares-admin", load);
  load(); setInterval(load, 60000);
})();
