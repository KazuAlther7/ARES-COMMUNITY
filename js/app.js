(() => {
  const cfg = window.ARES_CONFIG || {};
  const ready = cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_ANON_KEY.includes("PASTE_") && window.supabase;
  const $ = (id) => document.getElementById(id);
  const empty = (el, msg) => { if (el) el.innerHTML = `<div class="empty-state">${msg}</div>`; };
  if (!ready) {
    empty($("tournament-list"), "Supabase belum dikonfigurasi. Isi anon/publishable key di js/config.js.");
    empty($("match-list"), "Match center akan aktif setelah Supabase terhubung.");
    empty($("team-list"), "Data tim akan muncul setelah Supabase terhubung.");
    return;
  }
  const client = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = (n) => new Intl.NumberFormat("id-ID").format(Number(n || 0));
  async function loadTournaments() {
    const { data, error } = await client.from("tournaments").select("*").order("created_at", {ascending:false}).limit(50);
    if (error) return empty($("tournament-list"), "Belum dapat memuat turnamen. Periksa SQL schema dan Supabase RLS.");
    if ($("stat-tournaments")) $("stat-tournaments").textContent = data.length;
    if ($("tournament-list")) $("tournament-list").innerHTML = data.length ? data.map(t => `<article class="tournament-card"><div class="card-top"><span class="tag">${esc((t.format || "TOURNAMENT").replaceAll("_"," "))}</span><span class="status">${esc(t.status || "upcoming")}</span></div><h3>${esc(t.name)}</h3><p>${esc(t.description || "Official ARES COMMUNITY tournament.")}</p><div class="card-meta"><span>PRIZE POOL</span><strong>Rp ${money(t.prize_pool)}</strong></div></article>`).join("") : '<div class="empty-state">Belum ada turnamen. Nantikan pengumuman berikutnya.</div>';
  }
  async function loadTeams() {
    const { data, error } = await client.from("teams").select("id,name,tag,logo_url,tournaments(name)").order("created_at",{ascending:false}).limit(50);
    if (error) return empty($("team-list"), "Data tim belum tersedia.");
    if ($("stat-teams")) $("stat-teams").textContent = data.length;
    if ($("team-list")) $("team-list").innerHTML = data.length ? data.map(t => `<article class="team-card"><div class="team-emblem">${t.logo_url ? `<img src="${esc(t.logo_url)}" alt="" style="width:100%;height:100%;object-fit:cover">` : esc((t.tag || t.name || "A").slice(0,2).toUpperCase())}</div><div><h3>${esc(t.name)}</h3><p>${esc(t.tag || "ARES CONTENDER")}</p></div></article>`).join("") : '<div class="empty-state">Belum ada tim terdaftar.</div>';
  }
  async function loadMatches() {
    const { data, error } = await client.from("matches").select("id,status,round_name,scheduled_at,team1:teams!matches_team1_id_fkey(name,tag),team2:teams!matches_team2_id_fkey(name,tag),score1,score2").in("status",["live","completed","scheduled"]).order("scheduled_at",{ascending:true}).limit(50);
    if (error) return empty($("match-list"), "Match center belum tersedia.");
    if ($("stat-live")) $("stat-live").textContent = data.filter(m => m.status === "live").length;
    if ($("match-list")) $("match-list").innerHTML = data.length ? data.map(m => `<article class="match-card"><div class="match-team"><span class="team-emblem">${esc((m.team1?.tag || m.team1?.name || "T1").slice(0,2).toUpperCase())}</span>${esc(m.team1?.name || "TBD")}</div><div class="score">${Number(m.score1 || 0)} : ${Number(m.score2 || 0)}<small>${esc(m.status.toUpperCase())} · ${esc(m.round_name || "MATCH")}</small></div><div class="match-team"><span>${esc(m.team2?.name || "TBD")}</span><span class="team-emblem">${esc((m.team2?.tag || m.team2?.name || "T2").slice(0,2).toUpperCase())}</span></div></article>`).join("") : '<div class="empty-state">Belum ada pertandingan. Jadwal akan ditampilkan di sini.</div>';
  }
  const home = !!$("stat-tournaments");
  async function refresh(){ await Promise.all([(home||$("tournament-list"))&&loadTournaments(),(home||$("team-list"))&&loadTeams(),(home||$("match-list"))&&loadMatches()]); }
  refresh();
  client.channel("ares-public-updates").on("postgres_changes",{event:"*",schema:"public",table:"tournaments"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"teams"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"matches"},refresh).subscribe();
})();
