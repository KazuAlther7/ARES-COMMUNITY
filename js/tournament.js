(() => {
  const { client, esc, money, logo } = window.ARES;
  const $ = (id) => document.getElementById(id);
  const id = new URLSearchParams(location.search).get("id");
  if (!client || !id) { $("t-head").innerHTML = '<div class="empty-state">Turnamen tidak ditemukan atau Supabase belum terhubung.</div>'; $("bracket").innerHTML = ""; return; }

  const slot = (t, score, win, bye) => `<div class="slot ${win ? "win" : ""} ${t ? "" : "tbd"}" ${t ? `data-team="${t.id}"` : ""}>${t ? logo(t) : '<span class="team-emblem">?</span>'}<span class="slot-name">${t ? esc(t.name) : (bye ? "BYE" : "TBD")}</span><b>${t ? Number(score || 0) : ""}</b></div>`;

  async function load() {
    const [{ data: t, error }, { data: ms }, { data: teams }] = await Promise.all([
      client.from("tournaments").select("*").eq("id", id).single(),
      client.from("matches").select("*, team1:teams!matches_team1_id_fkey(id,name,tag,logo_url), team2:teams!matches_team2_id_fkey(id,name,tag,logo_url)").eq("tournament_id", id).order("round").order("position"),
      client.from("teams").select("id,name,tag,logo_url").eq("tournament_id", id).order("created_at")
    ]);
    if (error || !t) { $("t-head").innerHTML = '<div class="empty-state">Turnamen tidak ditemukan.</div>'; return; }
    document.title = `${t.name} — ARES COMMUNITY`;
    const champ = t.champion_id && (teams || []).find(x => x.id === t.champion_id);
    $("t-head").innerHTML = `<div class="t-hero" ${t.banner_url ? `style="background-image:linear-gradient(90deg,#0b0c0ef2,#0b0c0e99),url('${esc(t.banner_url)}')"` : ""}>
      ${t.logo_url ? `<img class="t-logo" src="${esc(t.logo_url)}" alt="">` : ""}
      <div><div class="eyebrow">${esc((t.format || "").replaceAll("_", " ").toUpperCase())} · ${esc((t.status || "upcoming").toUpperCase())}</div>
      <h1 class="t-title">${esc(t.name)}</h1>
      <div class="t-meta"><span>PRIZE POOL <b>Rp ${money(t.prize_pool)}</b></span>${t.start_date ? `<span>START <b>${new Date(t.start_date).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</b></span>` : ""}<span>TEAMS <b>${(teams || []).length}${t.max_teams ? " / " + t.max_teams : ""}</b></span></div>
      ${window.ARES.admin.on ? `<div class="admin-bar"><a href="admin.html#tournaments">Edit / Generate bracket ↗</a><a href="admin.html#teams:${t.id}">Kelola tim ↗</a><a href="admin.html#matches:${t.id}">Semua match ↗</a></div>` : ""}${champ ? `<div class="champion">🏆 CHAMPION · <b data-team="${champ.id}" style="cursor:pointer">${esc(champ.name)}</b></div>` : ""}</div></div>`;

    const rounds = {};
    (ms || []).forEach(m => (rounds[m.round] ||= []).push(m));
    const keys = Object.keys(rounds).sort((a, b) => a - b);
    window.__ms = ms || [];
    $("t-live").textContent = (ms || []).some(m => m.status === "live") ? "● LIVE NOW" : "";
    $("bracket").innerHTML = keys.length ? keys.map(r => `<div class="b-round"><div class="b-title">${esc(rounds[r][0].round_name || "Round " + r)}</div><div class="b-matches">${rounds[r].map(m => {
      const w = m.winner_id;
      return `<div class="b-match ${m.status === "live" ? "is-live" : ""}">${slot(m.team1, m.score1, w && w === m.team1_id)}${slot(m.team2, m.score2, w && w === m.team2_id, m.is_bye)}${window.ARES.admin.on && m.team1_id && m.team2_id && !m.is_bye ? `<div class="b-edit" data-mid="${m.id}"><input type="number" min="0" class="sc" name="s1" value="${m.score1 ?? 0}"><span>:</span><input type="number" min="0" class="sc" name="s2" value="${m.score2 ?? 0}"><select name="status">${["scheduled","live","completed"].map(s => `<option ${s === m.status ? "selected" : ""}>${s}</option>`).join("")}</select><button type="button" data-msave>SAVE</button></div>` : ""}<div class="b-foot">${m.status === "live" ? '<i class="live-dot"></i>LIVE' : esc((m.status || "scheduled").toUpperCase())}${m.scheduled_at ? " · " + new Date(m.scheduled_at).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" }) : ""}</div></div>`;
    }).join("")}</div></div>`).join("") : '<div class="empty-state">Bracket belum dibuat oleh admin.</div>';

    $("t-info").innerHTML = `${t.description ? `<div class="eyebrow">ABOUT</div><p class="prose">${esc(t.description)}</p>` : ""}
      ${t.rules ? `<div class="eyebrow" style="margin-top:28px">RULES</div><p class="prose" style="white-space:pre-line">${esc(t.rules)}</p>` : ""}
      ${(teams || []).length ? `<div class="eyebrow" style="margin-top:28px">PARTICIPATING TEAMS</div><div class="team-grid">${teams.map(x => `<article class="team-card" data-team="${x.id}" style="cursor:pointer">${logo(x, "lg")}<div><h3>${esc(x.name)}</h3><p>${esc(x.tag || "")}</p></div></article>`).join("")}</div>` : ""}`;
  }
  load();
  window.addEventListener("ares-admin", load);
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-msave]"); if (!b) return;
    const box = b.closest(".b-edit"), m = (window.__ms || []).find(x => x.id === box.dataset.mid), q = (n) => box.querySelector(`[name=${n}]`).value;
    try { b.disabled = true; await window.ARES.saveMatchResult(m, +q("s1") || 0, +q("s2") || 0, q("status")); load(); }
    catch (err) { alert(err.message || err); b.disabled = false; }
  });
  client.channel("ares-t-" + id)
    .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, load)
    .on("postgres_changes", { event: "*", schema: "public", table: "tournaments" }, load)
    .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, load).subscribe();
})();
