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
  const client = window.ARES.client;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const money = (n) => new Intl.NumberFormat("id-ID").format(Number(n || 0));
  async function loadTournaments() {
    const { data, error } = await client.from("tournaments").select("*").order("created_at", {ascending:false}).limit(50);
    if (error) return empty($("tournament-list"), "Belum dapat memuat turnamen. Periksa SQL schema dan Supabase RLS.");
    if ($("stat-tournaments")) $("stat-tournaments").textContent = data.length;
    if ($("tournament-list")) $("tournament-list").innerHTML = data.length ? data.map(t => `<a class="tournament-card" href="tournament.html?id=${t.id}"><div class="card-top"><span class="tag">${esc((t.format || "TOURNAMENT").replaceAll("_"," "))}</span><span class="status">${esc(t.status || "upcoming")}</span></div><h3>${esc(t.name)}</h3><p>${esc(t.description || "Official ARES COMMUNITY tournament.")}</p><div class="card-meta"><span>PRIZE POOL</span><strong>Rp ${money(t.prize_pool)}</strong></div></a>`).join("") : '<div class="empty-state">Belum ada turnamen. Nantikan pengumuman berikutnya.</div>';
  }
  async function loadTeams() {
    const { data, error } = await client.from("teams").select("id,name,tag,logo_url,tournaments(name)").order("created_at",{ascending:false}).limit(50);
    if (error) return empty($("team-list"), "Data tim belum tersedia.");
    if ($("stat-teams")) $("stat-teams").textContent = data.length;
    const card = (t) => `<article class="team-card" data-team="${t.id}" style="cursor:pointer"><div class="team-emblem">${t.logo_url ? `<img src="${esc(t.logo_url)}" alt="" style="width:100%;height:100%;object-fit:cover">` : esc((t.tag || t.name || "A").slice(0,2).toUpperCase())}</div><div><h3>${esc(t.name)}</h3><p>${esc(t.tag || "ARES CONTENDER")}</p></div></article>`;
    const groups = {};
    data.forEach(t => (groups[t.tournaments?.name || "Belum masuk turnamen"] ||= []).push(t));
    if ($("team-list")) $("team-list").innerHTML = data.length ? Object.entries(groups).map(([n, ts]) => `<div class="group-title">${esc(n)} <small>${ts.length} TEAMS</small></div>${ts.map(card).join("")}`).join("") : '<div class="empty-state">Belum ada tim terdaftar.</div>';
  }
  async function loadMatches() {
    const { data, error } = await client.from("matches").select("id,tournament_id,round,position,round_name,status,winner_id,is_bye,scheduled_at,score1,score2,team1_id,team2_id,tournaments(name,status),team1:teams!matches_team1_id_fkey(id,name,tag,logo_url),team2:teams!matches_team2_id_fkey(id,name,tag,logo_url)").order("round").order("position").limit(300);
    if (error) return empty($("match-list"), "Match center belum tersedia.");
    const A = window.ARES; A.annotate(data, m => m.tournaments?.status);
    const rank = { live: 0, scheduled: 1, completed: 2 };
    const list = data.filter(m => !m.is_bye && m.team1 && m.team2).sort((a, b) => rank[a._st] - rank[b._st] || a._no - b._no);
    if ($("stat-live")) $("stat-live").textContent = list.filter(m => m._st === "live").length;
    if ($("match-list")) $("match-list").innerHTML = list.length ? list.map(m => `<a class="match-card" href="tournament.html?id=${m.tournament_id}"><div class="match-team">${A.logo(m.team1)}${esc(m.team1.name)}</div><div class="score">${Number(m.score1 || 0)} : ${Number(m.score2 || 0)}<small>${esc(m._st.toUpperCase())} · #${m._no} ${esc(m.round_name || "MATCH")} · BO${m._bo}</small><small>${esc(m.tournaments?.name || "")}</small></div><div class="match-team"><span>${esc(m.team2.name)}</span>${A.logo(m.team2)}</div></a>`).join("") : '<div class="empty-state">Belum ada pertandingan. Jadwal akan ditampilkan di sini.</div>';
  }
  const home = !!$("stat-tournaments");
  async function refresh(){ await Promise.all([(home||$("tournament-list"))&&loadTournaments(),(home||$("team-list"))&&loadTeams(),(home||$("match-list"))&&loadMatches()]); }
  refresh();
  client.channel("ares-public-updates").on("postgres_changes",{event:"*",schema:"public",table:"tournaments"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"teams"},refresh).on("postgres_changes",{event:"*",schema:"public",table:"matches"},refresh).subscribe();
})();
